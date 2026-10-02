// Cross-cutting rules checked over every M1 operation of the public client.
import { describe, expect, it } from "vitest";
import {
  HemClient,
  HemDeviceError,
  HemError,
  HemTlsRequiredError,
  HemValidationError,
  type ApprovalAttempt,
} from "../../../src/index.js";
import { jsonResponse, emptyResponse } from "../../support/fake-fetch.js";
import { fakeDevice, jwtClaims, makeJwt, nowSec, type FakeDevice } from "../../support/device.js";
import { memoryApprovalRelay, RELAY_EPK } from "../../support/approval.js";
import { LOGIN_VECTOR as V } from "../../support/vectors.js";

const KID = "00112233445566778899aabbccddeeff";
const ALLOWED_HEADERS = new Set(["content-type", "authorization", "content-disposition"]);
const KEY = { kid: KID, created: 1, updated: 2, type: "AES256", label: "k", descr: "AQ==" };
const PAGE = { offset: 0, deleted: 0, total: 1, listed: 1, list: [KEY] };

/** A device answering every M1 endpoint. */
function m1Device(base = "https://my.ence.do"): FakeDevice {
  return fakeDevice(base)
    .on("GET /api/system/status", () => jsonResponse(200, { ctx: 1, uptime: 1, temp: 30, fls_state: 0, time: nowSec() }))
    .on("GET /api/system/version", () => jsonResponse(200, { hwv: "h", fwv: "1.2.2", fwk: "AQ==", fws: "Ag==" }))
    .on("GET /api/system/checkin", () => jsonResponse(200, { check: "check" }))
    .on("POST /api/system/checkin", () => jsonResponse(200, { status: "OK" }))
    .on("POST /api/auth/ext/request", () => jsonResponse(200, { authreq: makeJwt({ iat: nowSec() }), epk: RELAY_EPK }))
    .on("POST /api/auth/ext/token", (r) =>
      jsonResponse(200, { token: makeJwt({ sub: "app=", exp: nowSec() + 900, reply: (r.json as { authreply: string }).authreply }) }),
    )
    .on("POST /api/keymgmt/create", () => jsonResponse(200, { kid: KID }))
    .on(`GET /api/keymgmt/get/${KID}`, () => jsonResponse(200, { type: "AES256", updated: 2 }))
    .on("POST /api/keymgmt/search", () => jsonResponse(200, PAGE))
    .on("GET /api/keymgmt/list*", () => jsonResponse(200, PAGE))
    .on("POST /api/crypto/hmac/hash", () => jsonResponse(200, { mac: "AAAA" }))
    .on("POST /api/crypto/cipher/wrap", () => jsonResponse(200, { wrapped: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }))
    .on("POST /api/crypto/cipher/unwrap", () => jsonResponse(200, { unwrapped: "AAAAAAAAAAAAAAAAAAAAAA==" }));
}

function m1Client(d: FakeDevice, base = "https://my.ence.do") {
  return new HemClient({
    url: base,
    fetch: d.fetch,
    passphrase: V.passphrase,
    checkinRelay: { exchange: async () => "checked" },
    approvalRelay: memoryApprovalRelay({ state: "approved", authreply: "reply" }),
  });
}

type Op = (c: HemClient) => Promise<unknown>;
const drain = async (it: AsyncIterable<unknown>) => {
  for await (const _ of it) void _;
};

/** Every authenticated M1 operation and the scope ARCHITECTURE.md §6 lists for it. */
const AUTHENTICATED: [string, string, Op][] = [
  ["keys.create", "keymgmt:gen", (c) => c.keys.create({ label: "k", type: "AES256" })],
  ["keys.get", `keymgmt:use:${KID}`, (c) => c.keys.get(KID.toUpperCase())],
  ["keys.search", "keymgmt:search", (c) => c.keys.search({ description: Uint8Array.of(1) })],
  ["keys.findByDescription", "keymgmt:search", (c) => c.keys.findByDescription(Uint8Array.of(1))],
  ["keys.list", "keymgmt:list", (c) => c.keys.list()],
  ["keys.iterate", "keymgmt:list", (c) => drain(c.keys.iterate())],
  ["crypto.hmac", `keymgmt:use:${KID}`, (c) => c.crypto.hmac({ kid: KID.toUpperCase(), message: Uint8Array.of(1) })],
  ["crypto.wrap", `keymgmt:use:${KID}`, (c) => c.crypto.wrap({ kid: KID, data: new Uint8Array(16) })],
  ["crypto.unwrap", `keymgmt:use:${KID}`, (c) => c.crypto.unwrap({ kid: KID, data: new Uint8Array(24) })],
];

const attempt = (): ApprovalAttempt => ({ scope: "keymgmt:list", id: "event-1", authreq: "a", epk: RELAY_EPK });

/** Every M1 operation that needs no token. */
const PUBLIC: [string, Op][] = [
  ["system.status", (c) => c.system.status()],
  ["system.version", (c) => c.system.version()],
  ["system.health", (c) => c.system.health()],
  ["system.getCheckin", (c) => c.system.getCheckin()],
  ["system.postCheckin", (c) => c.system.postCheckin("checked")],
  ["system.checkin", (c) => c.system.checkin()],
  ["auth.getChallenge", (c) => c.auth.getChallenge()],
  ["auth.login", (c) => c.auth.login("keymgmt:upd")],
  ["auth.extRequest", (c) => c.auth.extRequest({ epk: RELAY_EPK, scope: "keymgmt:list" })],
  ["auth.extToken", (c) => c.auth.extToken({ authreply: "r", scope: "keymgmt:del" })],
  ["auth.beginApproval", (c) => c.auth.beginApproval("keymgmt:list")],
  ["auth.pollApproval", (c) => c.auth.pollApproval(attempt())],
  ["auth.waitForApproval", (c) => c.auth.waitForApproval(attempt())],
  ["auth.approve", (c) => c.auth.approve("keymgmt:list")],
];

const LOCAL = ["auth.logout", "auth.getRole"]; // no request at all

/** The device route each authenticated operation uses. */
const ROUTE: Record<string, string[]> = {
  "keys.create": ["POST /api/keymgmt/create"],
  "keys.get": [`GET /api/keymgmt/get/${KID}`],
  "keys.search": ["POST /api/keymgmt/search"],
  "keys.findByDescription": ["POST /api/keymgmt/search"],
  "keys.list": ["GET /api/keymgmt/list"],
  "keys.iterate": ["GET /api/keymgmt/list/0/15"],
  "crypto.hmac": ["POST /api/crypto/hmac/hash"],
  "crypto.wrap": ["POST /api/crypto/cipher/wrap"],
  "crypto.unwrap": ["POST /api/crypto/cipher/unwrap"],
};

const loginScopes = (d: FakeDevice) =>
  d.fetch.calls
    .filter((x) => x.method === "POST" && x.url.endsWith("/api/auth/token"))
    .map((x) => jwtClaims((x.json as { auth: string }).auth)["scope"]);

describe("coverage of the table", () => {
  // verifies: REQ-TEST-001
  it("lists every operation of every namespace", () => {
    const c = m1Client(m1Device());
    const actual = (["auth", "system", "keys", "crypto"] as const).flatMap((ns) =>
      Object.getOwnPropertyNames(Object.getPrototypeOf(c[ns]))
        .filter((m) => m !== "constructor")
        .map((m) => `${ns}.${m}`),
    );
    const listed = [...AUTHENTICATED.map(([n]) => n), ...PUBLIC.map(([n]) => n), ...LOCAL];
    expect(new Set(actual)).toEqual(new Set(listed));
  });
});

describe("scope selection", () => {
  // verifies: REQ-AUTH-005
  it.each(AUTHENTICATED)("%s logs in for exactly %s and sends it as a Bearer token", async (_name, scope, op) => {
    const d = m1Device();
    await op(m1Client(d));
    expect(loginScopes(d)).toEqual([scope]);
    const authenticated = d.fetch.calls.filter((x) => !x.url.includes("/api/auth/"));
    for (const call of authenticated) expect(call.headers["authorization"]).toBe(`Bearer ${d.issued[0]}`);
  });
});

describe("public operations", () => {
  // verifies: REQ-AUTH-012
  it.each(PUBLIC)("%s carries no Authorization while tokens are cached", async (_name, op) => {
    const d = m1Device();
    const c = m1Client(d);
    await c.keys.list();
    await c.crypto.hmac({ kid: KID, message: Uint8Array.of(1) });
    const before = d.fetch.calls.length;
    await op(c);
    const after = d.fetch.calls.slice(before);
    expect(after.length).toBeGreaterThan(0);
    for (const call of after) {
      expect(call.headers["authorization"], `${call.method} ${call.url}`).toBeUndefined();
    }
  });
});

describe("transport rules", () => {
  // verifies: REQ-NET-003
  it.each(AUTHENTICATED)("%s on an http: client raises HemTlsRequiredError with zero fetch calls", async (_name, _scope, op) => {
    const d = m1Device("http://192.168.7.1");
    await expect(op(m1Client(d, "http://192.168.7.1"))).rejects.toBeInstanceOf(HemTlsRequiredError);
    expect(d.fetch.calls).toHaveLength(0);
  });

  // verifies: REQ-NET-003
  it.each(PUBLIC)("%s is sent on an http: client", async (_name, op) => {
    const d = m1Device("http://192.168.7.1");
    await op(m1Client(d, "http://192.168.7.1"));
    expect(d.fetch.calls.length).toBeGreaterThan(0);
  });

  // verifies: REQ-NET-009
  it("every recorded request carries only allow-listed headers, each only when applicable", async () => {
    const d = m1Device();
    const c = m1Client(d);
    for (const [, , op] of AUTHENTICATED) await op(c);
    for (const [, op] of PUBLIC) await op(c);
    expect(d.fetch.calls.length).toBeGreaterThan(20);
    for (const call of d.fetch.calls) {
      for (const h of Object.keys(call.headers)) expect(ALLOWED_HEADERS.has(h), `${h} on ${call.url}`).toBe(true);
      expect("content-type" in call.headers).toBe(call.body !== undefined);
      expect(call.headers["content-disposition"]).toBeUndefined();
    }
  });
});

/** Every documented limit: a violating call and an accepted boundary call. */
const LIMITS: [string, string, Op, Op][] = [
  ["kid", "keys.get", (c) => c.keys.get("0011"), (c) => c.keys.get(KID.toUpperCase())],
  ["kid", "crypto.hmac", (c) => c.crypto.hmac({ kid: `${KID}0`, message: Uint8Array.of(1) }), (c) => c.crypto.hmac({ kid: KID, message: Uint8Array.of(1) })],
  ["label", "keys.create", (c) => c.keys.create({ label: "x".repeat(33), type: "AES256" }), (c) => c.keys.create({ label: "x".repeat(32), type: "AES256" })],
  ["label", "keys.create", (c) => c.keys.create({ label: "", type: "AES256" }), (c) => c.keys.create({ label: "~", type: "AES256" })],
  ["description", "keys.create", (c) => c.keys.create({ label: "k", type: "AES256", description: new Uint8Array(65) }), (c) => c.keys.create({ label: "k", type: "AES256", description: new Uint8Array(64) })],
  ["description", "keys.search", (c) => c.keys.search({ description: new Uint8Array(65) }), (c) => c.keys.search({ description: new Uint8Array(64) })],
  ["limit", "keys.search", (c) => c.keys.search({ description: Uint8Array.of(1), limit: 16 }), (c) => c.keys.search({ description: Uint8Array.of(1), limit: 15 })],
  ["count", "keys.list", (c) => c.keys.list({ count: 16 }), (c) => c.keys.list({ count: 15 })],
  ["offset", "keys.list", (c) => c.keys.list({ offset: -1 }), (c) => c.keys.list({ offset: 0 })],
  ["message", "crypto.hmac", (c) => c.crypto.hmac({ kid: KID, message: new Uint8Array(2049) }), (c) => c.crypto.hmac({ kid: KID, message: new Uint8Array(2048) })],
  ["message", "crypto.hmac", (c) => c.crypto.hmac({ kid: KID, message: new Uint8Array(0) }), (c) => c.crypto.hmac({ kid: KID, message: new Uint8Array(1) })],
  ["data", "crypto.wrap", (c) => c.crypto.wrap({ kid: KID, data: new Uint8Array(2056) }), (c) => c.crypto.wrap({ kid: KID, data: new Uint8Array(2048) })],
  ["iv", "crypto.wrap", (c) => c.crypto.wrap({ kid: KID, data: new Uint8Array(16), iv: new Uint8Array(9) }), (c) => c.crypto.wrap({ kid: KID, data: new Uint8Array(16), iv: new Uint8Array(8) })],
  ["data", "crypto.unwrap", (c) => c.crypto.unwrap({ kid: KID, data: new Uint8Array(20) }), (c) => c.crypto.unwrap({ kid: KID, data: new Uint8Array(24) })],
  ["body", "crypto.unwrap", (c) => c.crypto.unwrap({ kid: KID, data: new Uint8Array(5472) }), (c) => c.crypto.unwrap({ kid: KID, data: new Uint8Array(5400) })],
  ["epk", "auth.extRequest", (c) => c.auth.extRequest({ epk: "AQID", scope: "s" }), (c) => c.auth.extRequest({ epk: RELAY_EPK, scope: "s" })],
  ["scope", "auth.extRequest", (c) => c.auth.extRequest({ epk: RELAY_EPK, scope: "s".repeat(1024) }), (c) => c.auth.extRequest({ epk: RELAY_EPK, scope: "s".repeat(1023) })],
  ["ctx", "auth.extRequest", (c) => c.auth.extRequest({ epk: RELAY_EPK, scope: "s", ctx: "c".repeat(65) }), (c) => c.auth.extRequest({ epk: RELAY_EPK, scope: "s", ctx: "c".repeat(64) })],
  ["note", "auth.extRequest", (c) => c.auth.extRequest({ epk: RELAY_EPK, scope: "s", note: "n".repeat(129) }), (c) => c.auth.extRequest({ epk: RELAY_EPK, scope: "s", note: "n".repeat(128) })],
];

describe("input limits", () => {
  // verifies: REQ-API-005
  it.each(LIMITS)("%s on %s: violation sends nothing, boundary is accepted", async (parameter, _op, bad, good) => {
    const d = m1Device();
    const c = m1Client(d);
    const e = await bad(c).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(HemValidationError);
    expect((e as HemValidationError).parameter).toBe(parameter);
    expect(d.fetch.calls).toHaveLength(0);
    await good(c);
    expect(d.fetch.calls.length).toBeGreaterThan(0);
  });
});

describe("no secrets in errors", () => {
  // verifies: REQ-API-009
  it.each(AUTHENTICATED)("a failed %s does not reveal the token", async (name, scope, op) => {
    const d = m1Device();
    const c = m1Client(d);
    await c.auth.login(scope);
    const token = d.issued[0]!;
    for (const route of ROUTE[name]!) d.on(route, () => emptyResponse(500));
    const err = await op(c).catch((x: unknown) => x);
    expect(err).toBeInstanceOf(HemDeviceError);
    const e = err as HemError;
    const text = [e.message, e.stack, JSON.stringify(e), ...Object.getOwnPropertyNames(e).map((k) => String((e as unknown as Record<string, unknown>)[k]))].join("\n");
    expect(text).not.toContain(token);
    expect(text).not.toContain(token.split(".")[1]!);
  });
});
