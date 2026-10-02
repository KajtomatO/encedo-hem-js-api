import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HemAbortError,
  HemApprovalRejectedError,
  HemApprovalTimeoutError,
  HemClient,
  HemRelayError,
  HemUnreachableError,
  HemUnsupportedError,
  HemValidationError,
  type CheckinRelay,
} from "../../../src/index.js";
import { emptyResponse, jsonResponse } from "../../support/fake-fetch.js";
import { fakeDevice, makeJwt, nowSec } from "../../support/device.js";
import { memoryApprovalRelay, RELAY_EPK } from "../../support/approval.js";
import { advanceUntilSettled } from "../../support/timers.js";
import { LOGIN_VECTOR as V } from "../../support/vectors.js";

afterEach(() => vi.useRealTimers());

function device(iatOffset = 0) {
  let n = 0;
  return fakeDevice()
    .on("POST /api/auth/ext/request", () => jsonResponse(200, { authreq: makeJwt({ iat: nowSec() + iatOffset, n: n++ }), epk: RELAY_EPK }))
    .on("POST /api/auth/ext/token", () =>
      jsonResponse(200, { token: makeJwt({ sub: "q83vEjRWeJA=", scope: "keymgmt:list", exp: nowSec() + 900, n: n++ }) }),
    )
    .on("GET /api/keymgmt/list", () => jsonResponse(200, { offset: 0, total: 0, listed: 0, list: [] }))
    .on("GET /api/system/checkin", () => jsonResponse(200, { check: "c" }))
    .on("POST /api/system/checkin", () => jsonResponse(200, { status: "OK" }));
}

const checkinRelay = (): CheckinRelay & { calls: number } => {
  const r = { calls: 0, exchange: async () => (r.calls++, "checked") };
  return r;
};

const count = (d: ReturnType<typeof fakeDevice>, route: string) => d.log().filter((l) => l === route).length;

describe("approval outcomes", () => {
  // verifies: REQ-AUTH-018
  it("approved: the token is cached under the requested scope and the wait resolves", async () => {
    vi.useFakeTimers();
    const d = device();
    const relay = memoryApprovalRelay({ state: "pending" }, { state: "pending" }, { state: "approved", authreply: "reply" });
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, approvalRelay: relay });
    const attempt = await c.auth.beginApproval("keymgmt:list", { note: "list keys" });
    expect(attempt).toMatchObject({ scope: "keymgmt:list", id: "event-1", epk: RELAY_EPK });
    expect(d.fetch.calls[0]!.json).toEqual({ epk: RELAY_EPK, scope: "keymgmt:list", note: "list keys" });
    const info = await advanceUntilSettled(c.auth.waitForApproval(attempt));
    expect(info.scope).toBe("keymgmt:list");
    expect(relay.checks).toBe(3);
    await c.keys.list();
    expect(count(d, "POST /api/auth/ext/token")).toBe(1);
    expect(count(d, "POST /api/auth/ext/request")).toBe(1);
  });

  // verifies: REQ-AUTH-018
  it("rejected: HemApprovalRejectedError and ext/token is never called", async () => {
    vi.useFakeTimers();
    const d = device();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, approvalRelay: memoryApprovalRelay({ state: "pending" }, { state: "rejected" }) });
    const p = c.auth.approve("keymgmt:list");
    const assertion = expect(p).rejects.toBeInstanceOf(HemApprovalRejectedError);
    await advanceUntilSettled(p.catch(() => {}));
    await assertion;
    expect(count(d, "POST /api/auth/ext/token")).toBe(0);
  });

  // verifies: REQ-AUTH-018
  it("no answer within the limit, or an expired request: HemApprovalTimeoutError", async () => {
    vi.useFakeTimers();
    const relay = memoryApprovalRelay({ state: "pending" });
    const c = new HemClient({ url: "https://my.ence.do", fetch: device().fetch, approvalRelay: relay });
    const attempt = await c.auth.beginApproval("keymgmt:list");
    const p = c.auth.waitForApproval(attempt);
    const assertion = expect(p).rejects.toBeInstanceOf(HemApprovalTimeoutError);
    await advanceUntilSettled(p.catch(() => {}), 120_000, 500);
    await assertion;
    // default: a poll at 0 s and then every 5 s up to and including 60 s
    expect(relay.checks).toBe(13);
    const c2 = new HemClient({ url: "https://my.ence.do", fetch: device().fetch, approvalRelay: memoryApprovalRelay({ state: "expired" }) });
    await expect(c2.auth.waitForApproval(await c2.auth.beginApproval("keymgmt:list"))).rejects.toBeInstanceOf(HemApprovalTimeoutError);
  });

  // verifies: REQ-AUTH-018
  it("polls at least once even with a zero wait limit", async () => {
    const relay = memoryApprovalRelay({ state: "approved", authreply: "r" });
    const c = new HemClient({ url: "https://my.ence.do", fetch: device().fetch, approvalRelay: relay });
    await c.auth.waitForApproval(await c.auth.beginApproval("keymgmt:list"), { waitTimeoutMs: 0 });
    expect(relay.checks).toBe(1);
  });

  // verifies: REQ-AUTH-018
  it("a transport error in one poll does not end the wait; a signal cancels it", async () => {
    vi.useFakeTimers();
    const relay = memoryApprovalRelay(new HemUnreachableError("broker down"), { state: "approved", authreply: "r" });
    const c = new HemClient({ url: "https://my.ence.do", fetch: device().fetch, approvalRelay: relay });
    await advanceUntilSettled(c.auth.approve("keymgmt:list"));
    expect(relay.checks).toBe(2);

    const c2 = new HemClient({ url: "https://my.ence.do", fetch: device().fetch, approvalRelay: memoryApprovalRelay({ state: "pending" }) });
    const ac = new AbortController();
    const p = c2.auth.waitForApproval(await c2.auth.beginApproval("keymgmt:list"), { signal: ac.signal });
    const assertion = expect(p).rejects.toBeInstanceOf(HemAbortError);
    await vi.advanceTimersByTimeAsync(6000);
    ac.abort();
    await assertion;
  });

  // verifies: REQ-AUTH-016, REQ-AUTH-019
  it("with the relay set to none the engine and mobile mode raise HemUnsupportedError", async () => {
    const c = new HemClient({ url: "https://my.ence.do", fetch: device().fetch, approvalRelay: null });
    await expect(c.auth.beginApproval("keymgmt:list")).rejects.toBeInstanceOf(HemUnsupportedError);
    await expect(c.auth.approve("keymgmt:list")).rejects.toBeInstanceOf(HemUnsupportedError);
    expect(() => new HemClient({ url: "https://my.ence.do", fetch: device().fetch, approvalRelay: null, mobileApproval: true })).toThrow(
      HemUnsupportedError,
    );
  });
});

describe("mobile login mode", () => {
  // verifies: REQ-AUTH-019
  it("the first authenticated call triggers one approval; later calls for that scope do not", async () => {
    const d = device();
    const relay = memoryApprovalRelay({ state: "approved", authreply: "r" });
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, mobileApproval: { pollIntervalMs: 1 }, approvalRelay: relay });
    await c.keys.list();
    await c.keys.list();
    expect(relay.submitted).toHaveLength(1);
    expect(d.log()).toEqual(["POST /api/auth/ext/request", "POST /api/auth/ext/token", "GET /api/keymgmt/list", "GET /api/keymgmt/list"]);
    expect(c.auth.getRole()).toEqual({ kind: "app", id: "q83vEjRWeJA=" });
  });

  // verifies: REQ-AUTH-019
  it("rejects passphrase and mobile mode together", () => {
    expect(
      () => new HemClient({ url: "https://my.ence.do", fetch: device().fetch, passphrase: V.passphrase, mobileApproval: true }),
    ).toThrow(HemValidationError);
  });

  // verifies: REQ-AUTH-019
  it("a 401 leads to one new approval and one repeated call", async () => {
    const d = device().once("GET /api/keymgmt/list", jsonResponse(200, { offset: 0, total: 0, listed: 0, list: [] }), emptyResponse(401));
    const relay = memoryApprovalRelay({ state: "approved", authreply: "r" });
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, mobileApproval: true, approvalRelay: relay });
    await c.keys.list();
    await c.keys.list();
    expect(relay.submitted).toHaveLength(2);
    expect(d.log().slice(-4)).toEqual(["GET /api/keymgmt/list", "POST /api/auth/ext/request", "POST /api/auth/ext/token", "GET /api/keymgmt/list"]);
  });
});

describe("broker drift recovery", () => {
  const brokerIatRejection = () => new HemRelayError("Cannot handle token prior to iat", { status: 401 });

  // verifies: REQ-AUTH-020
  it("a broker 401 with drift evidence leads to one check-in, a new ext/request and a new submit", async () => {
    const d = device(30); // device clock 30 s ahead
    const relay = memoryApprovalRelay({ state: "pending" });
    relay.submitErrors.push(brokerIatRejection());
    const cr = checkinRelay();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, approvalRelay: relay, checkinRelay: cr });
    const attempt = await c.auth.beginApproval("keymgmt:list");
    expect(attempt.id).toBe("event-1");
    expect(cr.calls).toBe(1);
    expect(d.log()).toEqual(["POST /api/auth/ext/request", "GET /api/system/checkin", "POST /api/system/checkin", "POST /api/auth/ext/request"]);
  });

  // verifies: REQ-AUTH-020
  it("without drift evidence the error is reported with zero check-ins", async () => {
    const d = device(0);
    const relay = memoryApprovalRelay();
    relay.submitErrors.push(brokerIatRejection());
    const cr = checkinRelay();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, approvalRelay: relay, checkinRelay: cr });
    await expect(c.auth.beginApproval("keymgmt:list")).rejects.toBeInstanceOf(HemRelayError);
    expect(cr.calls).toBe(0);
  });

  // verifies: REQ-AUTH-020
  it("happens at most once per attempt", async () => {
    const d = device(-60); // device clock a minute behind
    const relay = memoryApprovalRelay();
    relay.submitErrors.push(brokerIatRejection(), brokerIatRejection());
    const cr = checkinRelay();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, approvalRelay: relay, checkinRelay: cr });
    await expect(c.auth.beginApproval("keymgmt:list")).rejects.toBeInstanceOf(HemRelayError);
    expect(cr.calls).toBe(1);
    expect(count(d, "POST /api/auth/ext/request")).toBe(2);
  });
});
