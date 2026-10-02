import { describe, expect, it, vi } from "vitest";
import {
  EncedoApprovalRelay,
  HemClient,
  HemOperationFailedError,
  HemProtocolError,
  HemRelayError,
  HemUnauthenticatedError,
  HemValidationError,
  type CheckinRelay,
} from "../../../src/index.js";
import { createFakeFetch, emptyResponse, jsonResponse } from "../../support/fake-fetch.js";
import { fakeDevice, makeJwt, nowSec } from "../../support/device.js";
import { RELAY_EPK, memoryApprovalRelay } from "../../support/approval.js";
import { LOGIN_VECTOR as V } from "../../support/vectors.js";

const AUTHREQ = makeJwt({ iat: 1, scope: { app: "cipher" } });

function device() {
  return fakeDevice()
    .on("POST /api/auth/ext/request", (r) => jsonResponse(200, { authreq: AUTHREQ, epk: (r.json as { epk: string }).epk }))
    .on("POST /api/auth/ext/token", () => jsonResponse(200, { token: makeJwt({ sub: "q83vEjRWeJA=", scope: "keymgmt:list", exp: nowSec() + 900 }) }))
    .on("GET /api/keymgmt/list", () => jsonResponse(200, { offset: 0, total: 0, listed: 0, list: [] }))
    .on("GET /api/system/checkin", () => jsonResponse(200, { check: "c" }))
    .on("POST /api/system/checkin", () => jsonResponse(200, { status: "OK" }));
}

const checkin = (): CheckinRelay & { calls: number } => {
  const r = { calls: 0, exchange: async () => (r.calls++, "checked") };
  return r;
};

describe("auth.extRequest", () => {
  // verifies: REQ-AUTH-014
  it("posts {epk, scope, ctx, note} without Authorization and returns opaque strings", async () => {
    const d = device();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, passphrase: V.passphrase });
    await c.auth.login("keymgmt:list");
    const r = await c.auth.extRequest({ epk: RELAY_EPK, scope: "keymgmt:list", ctx: "svc", note: "Allow listing" });
    expect(r).toEqual({ authreq: AUTHREQ, epk: RELAY_EPK });
    const call = d.fetch.calls.at(-1)!;
    expect(call.url).toBe("https://my.ence.do/api/auth/ext/request");
    expect(call.json).toEqual({ epk: RELAY_EPK, scope: "keymgmt:list", ctx: "svc", note: "Allow listing" });
    expect(call.headers["authorization"]).toBeUndefined();
    await c.auth.extRequest({ epk: RELAY_EPK, scope: "keymgmt:gen" });
    expect(d.fetch.calls.at(-1)!.json).toEqual({ epk: RELAY_EPK, scope: "keymgmt:gen" });
  });

  // verifies: REQ-AUTH-014
  it.each([
    ["epk", { epk: "AQID" }],
    ["epk", { epk: "***" }],
    ["scope", { scope: "s".repeat(1024) }],
    ["scope", { scope: "" }],
    ["ctx", { ctx: "" }],
    ["ctx", { ctx: "c".repeat(65) }],
    ["note", { note: "" }],
    ["note", { note: "n".repeat(129) }],
  ])("rejects a bad %s with zero requests", async (param, patch) => {
    const d = device();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch });
    const e = await c.auth.extRequest({ epk: RELAY_EPK, scope: "keymgmt:list", ...patch }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(HemValidationError);
    expect((e as HemValidationError).parameter).toBe(param);
    expect(d.fetch.calls).toHaveLength(0);
    await c.auth.extRequest({ epk: RELAY_EPK, scope: "s".repeat(1023), ctx: "c".repeat(64), note: "n".repeat(128) });
  });

  // verifies: REQ-AUTH-014
  it("a 403 runs the single check-in recovery and repeats the request", async () => {
    const d = device().once("POST /api/auth/ext/request", emptyResponse(403));
    const relay = checkin();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, checkinRelay: relay });
    await c.auth.extRequest({ epk: RELAY_EPK, scope: "keymgmt:list" });
    expect(relay.calls).toBe(1);
    expect(d.log()).toEqual(["POST /api/auth/ext/request", "GET /api/system/checkin", "POST /api/system/checkin", "POST /api/auth/ext/request"]);
  });
});

describe("auth.extToken", () => {
  // verifies: REQ-AUTH-015
  it("posts {authreply} without Authorization and caches the token under the requested scope", async () => {
    const d = device();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, approvalRelay: null });
    const token = await c.auth.extToken({ authreply: "reply.jwt.sig", scope: "keymgmt:list" });
    expect(token.split(".")).toHaveLength(3);
    const call = d.fetch.calls[0]!;
    expect(call.json).toEqual({ authreply: "reply.jwt.sig" });
    expect(call.headers["authorization"]).toBeUndefined();
    expect(c.auth.getRole()).toEqual({ kind: "app", id: "q83vEjRWeJA=" });
    // the cached token is used: no login (there is no passphrase at all)
    await c.keys.list();
    expect(d.fetch.calls.at(-1)!.headers["authorization"]).toBe(`Bearer ${token}`);
    const info = await c.auth.login("keymgmt:list");
    expect(info.expiresAt).toBeGreaterThan(nowSec() + 800);
    expect(d.log().filter((l) => l.includes("/api/auth/token"))).toHaveLength(0);
  });

  // verifies: REQ-AUTH-015
  it("maps 401 to HemUnauthenticatedError and 406 to HemOperationFailedError", async () => {
    const d = device().once("POST /api/auth/ext/token", emptyResponse(401), emptyResponse(406));
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch });
    await expect(c.auth.extToken({ authreply: "r", scope: "keymgmt:list" })).rejects.toBeInstanceOf(HemUnauthenticatedError);
    await expect(c.auth.extToken({ authreply: "r", scope: "keymgmt:list" })).rejects.toBeInstanceOf(HemOperationFailedError);
  });
});

describe("approval relay", () => {
  // verifies: REQ-AUTH-016
  it("completes both device calls with an in-memory relay and nothing goes to api.encedo.com", async () => {
    const d = device();
    const relay = memoryApprovalRelay({ state: "approved", authreply: "reply" });
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, approvalRelay: relay });
    const key = await relay.obtainKey();
    const req = await c.auth.extRequest({ epk: key.epk, scope: "keymgmt:list" });
    const id = await relay.submit(req);
    const answer = await relay.check(id);
    expect(answer.state).toBe("approved");
    await c.auth.extToken({ authreply: (answer as { authreply: string }).authreply, scope: "keymgmt:list" });
    expect(d.log()).toEqual(["POST /api/auth/ext/request", "POST /api/auth/ext/token"]);
    // the setup's failing global fetch would have caught any cloud request
  });

  // verifies: REQ-AUTH-016
  it("the device calls work with the relay set to none, and a malformed relay is refused", async () => {
    const d = device();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, approvalRelay: null });
    await c.auth.extRequest({ epk: RELAY_EPK, scope: "keymgmt:list" });
    await c.auth.extToken({ authreply: "r", scope: "keymgmt:list" });
    expect(() => new HemClient({ url: "https://my.ence.do", fetch: d.fetch, approvalRelay: {} as never })).toThrow(HemValidationError);
  });
});

describe("default broker relay", () => {
  // verifies: REQ-AUTH-017
  it("maps the three broker calls", async () => {
    const cloud = createFakeFetch(
      jsonResponse(200, { epk: RELAY_EPK, exp: 1800000000 }),
      jsonResponse(200, { eventid: "ev/1", extra: true }),
      new Response(null, { status: 202 }),
      jsonResponse(200, { deny: true }),
      jsonResponse(200, { authreply: "reply", other: 1 }),
      emptyResponse(404),
    );
    const r = new EncedoApprovalRelay({ fetch: cloud });
    expect(await r.obtainKey()).toEqual({ epk: RELAY_EPK, exp: 1800000000 });
    expect(await r.submit({ authreq: AUTHREQ, epk: RELAY_EPK })).toBe("ev/1");
    expect(await r.check("ev/1")).toEqual({ state: "pending" });
    expect(await r.check("ev/1")).toEqual({ state: "rejected" });
    expect(await r.check("ev/1")).toEqual({ state: "approved", authreply: "reply" });
    expect(await r.check("ev/1")).toEqual({ state: "expired" });
    expect(cloud.calls.map((x) => `${x.method} ${x.url}`)).toEqual([
      "GET https://api.encedo.com/notify/session",
      "POST https://api.encedo.com/notify/event/new",
      "GET https://api.encedo.com/notify/event/check/ev%2F1",
      "GET https://api.encedo.com/notify/event/check/ev%2F1",
      "GET https://api.encedo.com/notify/event/check/ev%2F1",
      "GET https://api.encedo.com/notify/event/check/ev%2F1",
    ]);
    expect(cloud.calls[1]!.json).toEqual({ authreq: AUTHREQ, epk: RELAY_EPK });
  });

  // verifies: REQ-AUTH-017
  it("raises an error with status and body for any other status", async () => {
    const r = new EncedoApprovalRelay({ fetch: createFakeFetch(new Response("Cannot handle token prior to iat", { status: 401 }), new Response("x", { status: 500 }), new Response("{}", { status: 200 })) });
    const e = await r.submit({ authreq: AUTHREQ, epk: RELAY_EPK }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(HemRelayError);
    expect((e as HemRelayError).status).toBe(401);
    expect((e as HemRelayError).body).toBe("Cannot handle token prior to iat");
    await expect(r.check("e")).rejects.toBeInstanceOf(HemRelayError);
    await expect(r.check("e")).rejects.toBeInstanceOf(HemProtocolError);
  });

  // verifies: REQ-AUTH-017
  it("uses the global fetch by default, never the device fetch, with a configurable base URL", async () => {
    const g = createFakeFetch(jsonResponse(200, { epk: RELAY_EPK }));
    vi.stubGlobal("fetch", g);
    const d = device();
    new HemClient({ url: "https://my.ence.do", fetch: d.fetch });
    const r = new EncedoApprovalRelay({ url: "https://broker.example/notify/" });
    await r.obtainKey();
    expect(g.calls[0]!.url).toBe("https://broker.example/notify/session");
    expect(d.fetch.calls).toHaveLength(0);
  });
});
