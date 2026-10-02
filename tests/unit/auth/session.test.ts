import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HemAbortError,
  HemClient,
  HemDeviceStateError,
  HemForbiddenError,
  HemUnauthenticatedError,
} from "../../../src/index.js";
import type { DeviceRequest } from "../../../src/transport/transport.js";
import { emptyResponse, jsonResponse } from "../../support/fake-fetch.js";
import { fakeDevice, jwtClaims, makeJwt, nowSec } from "../../support/device.js";
import { makeSession } from "../../support/session.js";
import { LOGIN_VECTOR as V } from "../../support/vectors.js";

afterEach(() => vi.useRealTimers());

const LIST: DeviceRequest = { operation: "keys.list", method: "GET", path: "/api/keymgmt/list" };
const SEARCH: DeviceRequest = { operation: "keys.search", method: "POST", path: "/api/keymgmt/search", body: { descr: "^AA==" } };
const ok = () => jsonResponse(200, { ok: true });
const logins = (d: ReturnType<typeof fakeDevice>) => d.log().filter((l) => l === "POST /api/auth/token").length;
const challenges = (d: ReturnType<typeof fakeDevice>) => d.log().filter((l) => l === "GET /api/auth/token").length;
const scopeOf = (d: ReturnType<typeof fakeDevice>, i: number) =>
  jwtClaims((d.fetch.calls.filter((c) => c.method === "POST" && c.url.endsWith("/api/auth/token"))[i]!.json as { auth: string }).auth)["scope"];

describe("token cache", () => {
  // verifies: REQ-AUTH-004
  it("uses one login for two calls of one scope and separate tokens per scope", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", ok).on("POST /api/keymgmt/search", ok);
    const { session } = makeSession(d);
    await session.authorized(LIST, "keymgmt:list");
    await session.authorized(LIST, "keymgmt:list");
    expect(logins(d)).toBe(1);
    await session.authorized(SEARCH, "keymgmt:search");
    expect(logins(d)).toBe(2);
    expect(scopeOf(d, 1)).toBe("keymgmt:search");
    const auth = d.fetch.calls.filter((c) => !c.url.includes("/auth/")).map((c) => c.headers["authorization"]);
    expect(auth[0]).toBe(auth[1]);
    expect(auth[2]).not.toBe(auth[0]);
  });

  // verifies: REQ-AUTH-004
  it("keys the cache by the exact scope string", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", ok);
    const { session } = makeSession(d);
    const a = await session.token("keymgmt:use:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const b = await session.token("keymgmt:use:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(a.token).not.toBe(b.token);
    expect(logins(d)).toBe(2);
    await session.token("keymgmt:list");
    await session.token("keymgmt:search");
    expect(logins(d)).toBe(4);
  });

  // verifies: REQ-AUTH-004
  it("reads the expiry from the token's exp and falls back to the requested expiry", async () => {
    const d = fakeDevice();
    d.once("POST /api/auth/token", () => jsonResponse(200, { token: makeJwt({ exp: nowSec() + 120, sub: "U" }) }));
    const { session } = makeSession(d, { lifetimeSeconds: 3600 });
    const e1 = await session.token("keymgmt:list");
    expect(e1.exp).toBeGreaterThanOrEqual(nowSec() + 119);
    expect(e1.exp).toBeLessThanOrEqual(nowSec() + 120);
    d.once("POST /api/auth/token", jsonResponse(200, { token: "opaque-token" }));
    const before = nowSec();
    const e2 = await session.token("keymgmt:search");
    expect(e2.exp).toBeGreaterThanOrEqual(before + 3600);
    expect(e2.exp).toBeLessThanOrEqual(nowSec() + 3600);
  });

  // verifies: REQ-AUTH-004
  it("belongs to one client instance", async () => {
    const d = fakeDevice();
    const c1 = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, passphrase: V.passphrase });
    const c2 = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, passphrase: V.passphrase });
    await c1.auth.login("keymgmt:list");
    await c2.auth.login("keymgmt:list");
    expect(logins(d)).toBe(2);
  });
});

describe("renewal", () => {
  // verifies: REQ-AUTH-007
  it("uses the token at 61 s before expiry and logs in first at 60 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = 1_800_000_000;
    vi.setSystemTime(t0 * 1000);
    const d = fakeDevice().on("GET /api/keymgmt/list", ok);
    const { session } = makeSession(d, { lifetimeSeconds: 3600 });
    await session.authorized(LIST, "keymgmt:list");
    expect(logins(d)).toBe(1);
    vi.setSystemTime((t0 + 3600 - 61) * 1000);
    await session.authorized(LIST, "keymgmt:list");
    expect(logins(d)).toBe(1);
    vi.setSystemTime((t0 + 3600 - 60) * 1000);
    await session.authorized(LIST, "keymgmt:list");
    expect(logins(d)).toBe(2);
    expect(d.log().slice(-3)).toEqual(["GET /api/auth/token", "POST /api/auth/token", "GET /api/keymgmt/list"]);
  });

  // verifies: REQ-AUTH-007
  it("starts no background timer", async () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    const { session, device } = makeSession(fakeDevice().on("GET /api/keymgmt/list", ok));
    await session.authorized(LIST, "keymgmt:list");
    expect(spy).not.toHaveBeenCalled();
    // the only timers are the per-request time limits, all cleared
    expect(device.fetch.calls).toHaveLength(3);
    spy.mockRestore();
  });
});

describe("401 handling", () => {
  // verifies: REQ-AUTH-008
  it("re-authenticates once: call, challenge, proof, call", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", ok);
    const { session } = makeSession(d);
    await session.token("keymgmt:list");
    d.fetch.calls.length = 0;
    d.once("GET /api/keymgmt/list", emptyResponse(401));
    const res = await session.authorized(LIST, "keymgmt:list");
    expect(res.status).toBe(200);
    expect(d.log()).toEqual(["GET /api/keymgmt/list", "GET /api/auth/token", "POST /api/auth/token", "GET /api/keymgmt/list"]);
  });

  // verifies: REQ-AUTH-008
  it("raises HemUnauthenticatedError on a second 401 with no third attempt", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", () => emptyResponse(401));
    const { session } = makeSession(d);
    await expect(session.authorized(LIST, "keymgmt:list")).rejects.toBeInstanceOf(HemUnauthenticatedError);
    expect(d.log().filter((l) => l === "GET /api/keymgmt/list")).toHaveLength(2);
  });

  // verifies: REQ-AUTH-008
  it("discards only the affected scope's token", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", ok).on("POST /api/keymgmt/search", ok);
    const { session } = makeSession(d);
    await session.authorized(LIST, "keymgmt:list");
    const searchToken = (await session.token("keymgmt:search")).token;
    d.once("GET /api/keymgmt/list", emptyResponse(401));
    await session.authorized(LIST, "keymgmt:list");
    expect((await session.token("keymgmt:search")).token).toBe(searchToken);
    expect(logins(d)).toBe(3);
  });
});

describe("single flight", () => {
  // verifies: REQ-AUTH-013
  it("five concurrent calls on an empty cache cause one challenge and one proof", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", ok);
    const { session } = makeSession(d);
    await Promise.all([1, 2, 3, 4, 5].map(() => session.authorized(LIST, "keymgmt:list")));
    expect(challenges(d)).toBe(1);
    expect(logins(d)).toBe(1);
  });

  // verifies: REQ-AUTH-013
  it("rejects every waiter with the same class and starts afresh on the next call", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", ok).once("POST /api/auth/token", emptyResponse(409));
    const { session } = makeSession(d);
    const results = await Promise.allSettled([1, 2, 3].map(() => session.authorized(LIST, "keymgmt:list")));
    for (const r of results) expect(r.status === "rejected" && r.reason).toBeInstanceOf(HemDeviceStateError);
    expect(logins(d)).toBe(1);
    await session.authorized(LIST, "keymgmt:list");
    expect(logins(d)).toBe(2);
  });

  // verifies: REQ-NET-005
  it("aborting one call does not fail another sharing the login", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", ok);
    const { session } = makeSession(d);
    const ac = new AbortController();
    const p1 = session.authorized({ ...LIST, signal: ac.signal }, "keymgmt:list");
    const p2 = session.authorized(LIST, "keymgmt:list");
    ac.abort();
    await expect(p1).rejects.toBeInstanceOf(HemAbortError);
    expect((await p2).status).toBe(200);
    expect(logins(d)).toBe(1);
  });
});

describe("scope and headers", () => {
  // verifies: REQ-AUTH-005
  it("sends the token as a Bearer Authorization header", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", ok);
    const { session } = makeSession(d);
    await session.authorized(LIST, "keymgmt:list");
    expect(d.fetch.calls[2]!.headers["authorization"]).toBe(`Bearer ${d.issued[0]}`);
  });

  // verifies: REQ-AUTH-012
  it("public calls carry no Authorization while tokens are cached", async () => {
    const d = fakeDevice();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, passphrase: V.passphrase });
    await c.auth.login("keymgmt:list");
    await c.auth.getChallenge();
    for (const call of d.fetch.calls) expect(call.headers["authorization"]).toBeUndefined();
  });
});

describe("roles", () => {
  // verifies: REQ-AUTH-010
  it.each([
    ["U", { kind: "user" }],
    ["M", { kind: "master" }],
    ["q83vEjRWeJA=", { kind: "app", id: "q83vEjRWeJA=" }],
  ])("sub %s reports %o", async (sub, role) => {
    const d = fakeDevice();
    d.sub = sub;
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, passphrase: V.passphrase });
    expect(c.auth.getRole()).toBeUndefined();
    expect((await c.auth.login("keymgmt:list")).role).toEqual(role);
    expect(c.auth.getRole()).toEqual(role);
  });

  // verifies: REQ-AUTH-010
  it("a master session's key-management call surfaces the device's 403 as HemForbiddenError", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", () => emptyResponse(403));
    d.sub = "M";
    const { session } = makeSession(d);
    await expect(session.authorized(LIST, "keymgmt:list")).rejects.toBeInstanceOf(HemForbiddenError);
  });
});

describe("time limit per request", () => {
  // verifies: REQ-NET-004
  it("applies the limit to each request of a call that logs in first, not to the sum", async () => {
    // three requests of 200 ms each (600 ms in total) under a 300 ms limit, real timers
    const slow = (make: () => Response) => () => new Promise<Response>((res) => setTimeout(() => res(make()), 200));
    const d = fakeDevice();
    d.once("GET /api/auth/token", slow(() => jsonResponse(200, { exp: nowSec() + 60, ...d.challenge })));
    d.once("POST /api/auth/token", (req) =>
      new Promise<Response>((res) =>
        setTimeout(() => {
          const c = jwtClaims((req.json as { auth: string }).auth);
          res(jsonResponse(200, { token: makeJwt({ sub: "U", scope: c["scope"], exp: c["exp"] }) }));
        }, 200),
      ),
    );
    d.once("GET /api/keymgmt/list", slow(ok));
    const { session } = makeSession(d, { timeoutMs: 300 });
    const started = Date.now();
    const res = await session.authorized(LIST, "keymgmt:list");
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(590);
  });
});

describe("logout", () => {
  // verifies: REQ-AUTH-011
  it("empties the cache; an authenticated call then fails without any request", async () => {
    const d = fakeDevice().on("GET /api/keymgmt/list", ok);
    const { session } = makeSession(d);
    await session.authorized(LIST, "keymgmt:list");
    session.logout();
    const n = d.fetch.calls.length;
    await expect(session.authorized(LIST, "keymgmt:list")).rejects.toBeInstanceOf(HemUnauthenticatedError);
    expect(d.fetch.calls.length).toBe(n);
  });
});
