import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HemClient,
  HemDeviceStateError,
  HemProtocolError,
  HemUnauthenticatedError,
  HemValidationError,
} from "../../../src/index.js";
import { emptyResponse, jsonResponse } from "../../support/fake-fetch.js";
import { fakeDevice, jwtClaims, nowSec } from "../../support/device.js";
import { LOGIN_VECTOR as V, LOGIN_VECTOR_PROOF } from "../../support/vectors.js";

afterEach(() => vi.useRealTimers());

function client(device = fakeDevice(), extra: Record<string, unknown> = {}) {
  return new HemClient({ url: "https://my.ence.do", fetch: device.fetch, passphrase: V.passphrase, ...extra });
}

/** Every string reachable from an error: message, properties, JSON form, causes. */
function errorText(err: unknown): string {
  const parts: string[] = [];
  let e: unknown = err;
  for (let i = 0; e && i < 5; i++) {
    const o = e as Record<string, unknown>;
    parts.push(String(o["message"]), String(o["stack"]), JSON.stringify(e));
    for (const k of Object.getOwnPropertyNames(e)) parts.push(String(o[k]));
    e = o["cause"];
  }
  return parts.join("\n");
}

describe("passphrase login", () => {
  // verifies: REQ-AUTH-001, REQ-AUTH-002
  it("sends one GET and one POST with the exact vector proof and no Authorization", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(V.iat * 1000);
    const d = fakeDevice();
    d.challenge = { eid: V.eid, spk: V.spk, jti: V.jti, lbl: "user" };
    const c = client(d, { tokenLifetimeSeconds: V.exp - V.iat });
    const info = await c.auth.login(V.scope);
    expect(d.log()).toEqual(["GET /api/auth/token", "POST /api/auth/token"]);
    for (const call of d.fetch.calls) expect(call.headers["authorization"]).toBeUndefined();
    expect(d.fetch.calls[1]!.body).toBe(JSON.stringify({ auth: LOGIN_VECTOR_PROOF }));
    expect(info).toEqual({ scope: V.scope, role: { kind: "user" }, expiresAt: V.exp });
  });

  // verifies: REQ-AUTH-001
  it.each([
    ["eid", { eid: undefined }],
    ["spk", { spk: undefined }],
    ["jti", { jti: undefined }],
    ["spk", { spk: "AQID" }],
    ["spk", { spk: "not base64!" }],
  ])("raises HemProtocolError for a bad challenge field %s", async (field, patch) => {
    const d = fakeDevice();
    d.once("GET /api/auth/token", jsonResponse(200, { exp: nowSec() + 60, eid: V.eid, spk: V.spk, jti: V.jti, ...patch }));
    const err = await client(d).auth.login("keymgmt:list").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HemProtocolError);
    expect((err as Error).message).toContain(field);
  });

  // verifies: REQ-AUTH-001
  it("raises HemProtocolError for a reply without token", async () => {
    const d = fakeDevice().once("POST /api/auth/token", jsonResponse(200, { tok: "x" }));
    await expect(client(d).auth.login("keymgmt:list")).rejects.toBeInstanceOf(HemProtocolError);
  });

  // verifies: REQ-AUTH-001
  it("maps 401 on the proof to HemUnauthenticatedError and 409 to HemDeviceStateError", async () => {
    const d = fakeDevice().once("POST /api/auth/token", emptyResponse(401));
    await expect(client(d).auth.login("keymgmt:list")).rejects.toBeInstanceOf(HemUnauthenticatedError);
    const d2 = fakeDevice().once("POST /api/auth/token", emptyResponse(409));
    await expect(client(d2).auth.login("keymgmt:list")).rejects.toBeInstanceOf(HemDeviceStateError);
  });
});

describe("token lifetime", () => {
  const lifetimeOf = (d: ReturnType<typeof fakeDevice>) => {
    const c = jwtClaims((d.fetch.calls[1]!.json as { auth: string }).auth);
    return (c["exp"] as number) - (c["iat"] as number);
  };

  // verifies: REQ-AUTH-006
  it("defaults to 28 800 s regardless of the challenge's 60 s deadline", async () => {
    const d = fakeDevice();
    await client(d).auth.login("keymgmt:list");
    expect(lifetimeOf(d)).toBe(28_800);
  });

  // verifies: REQ-AUTH-006
  it("uses a configured lifetime", async () => {
    const d = fakeDevice();
    await client(d, { tokenLifetimeSeconds: 600 }).auth.login("keymgmt:list");
    expect(lifetimeOf(d)).toBe(600);
  });

  // verifies: REQ-AUTH-006
  it.each([0, -1, 1.5, Number.NaN, "60"])("rejects lifetime %s", (v) => {
    expect(() => client(fakeDevice(), { tokenLifetimeSeconds: v })).toThrow(HemValidationError);
  });
});

describe("credential lifecycle", () => {
  // verifies: REQ-AUTH-011
  it("after logout a login fails without any request", async () => {
    const d = fakeDevice();
    const c = client(d);
    await c.auth.login("keymgmt:list");
    c.auth.logout();
    const before = d.fetch.calls.length;
    await expect(c.auth.login("keymgmt:list")).rejects.toBeInstanceOf(HemUnauthenticatedError);
    expect(d.fetch.calls.length).toBe(before);
  });

  // verifies: REQ-AUTH-011
  it("binds the derived key to its eid and reports an identity change", async () => {
    const d = fakeDevice();
    const c = client(d);
    await c.auth.login("keymgmt:list");
    d.challenge = { ...d.challenge, eid: "ffffffffffffffffffffffffffffffff" };
    const err = await c.auth.login("keymgmt:search").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HemUnauthenticatedError);
    expect((err as Error).message).toMatch(/identity changed/);
    // no proof was sent for the changed identity
    expect(d.log().filter((l) => l === "POST /api/auth/token")).toHaveLength(1);
  });

  // verifies: REQ-AUTH-011
  it("keeps the passphrase nowhere reachable from the client", async () => {
    const c = client();
    await c.auth.login("keymgmt:list");
    const seen = new Set<unknown>();
    const walk = (o: unknown, depth: number): string => {
      if (depth > 6 || o === null || typeof o !== "object" || seen.has(o)) return typeof o === "string" ? o : "";
      seen.add(o);
      return Object.getOwnPropertyNames(o)
        .map((k) => walk((o as Record<string, unknown>)[k], depth + 1))
        .join("|");
    };
    expect(walk(c, 0)).not.toContain(V.passphrase);
  });
});

describe("no secrets in errors", () => {
  // verifies: REQ-API-009
  it("a failed login's error contains neither passphrase, proof nor token", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(V.iat * 1000);
    const d = fakeDevice();
    d.challenge = { eid: V.eid, spk: V.spk, jti: V.jti, lbl: "user" };
    d.once("POST /api/auth/token", () => new Response(JSON.stringify({ hint: "rejected" }), { status: 401 }));
    const err = await client(d, { tokenLifetimeSeconds: V.exp - V.iat }).auth.login(V.scope).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HemUnauthenticatedError);
    const text = errorText(err);
    expect(text).not.toContain(V.passphrase);
    expect(text).not.toContain(LOGIN_VECTOR_PROOF);
    expect(text).not.toContain(V.claims);
    expect(text).not.toContain(V.tag);
  });

  // verifies: REQ-API-009
  it("a protocol failure after the token was issued does not carry the token", async () => {
    const d = fakeDevice().once("POST /api/auth/token", jsonResponse(200, { token: 42, other: "secret-token-value" }));
    const err = await client(d).auth.login("keymgmt:list").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HemProtocolError);
    expect(errorText(err)).not.toContain("secret-token-value");
  });
});
