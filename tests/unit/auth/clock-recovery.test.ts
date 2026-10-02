import { describe, expect, it } from "vitest";
import {
  HemClient,
  HemForbiddenError,
  HemRelayError,
  HemUnauthenticatedError,
  type CheckinRelay,
} from "../../../src/index.js";
import { emptyResponse, jsonResponse } from "../../support/fake-fetch.js";
import { fakeDevice, nowSec } from "../../support/device.js";
import { LOGIN_VECTOR as V } from "../../support/vectors.js";

function relay(fail = false): CheckinRelay & { calls: number } {
  const r = {
    calls: 0,
    async exchange(_check: string) {
      r.calls++;
      if (fail) throw new HemRelayError("backend down", { status: 503 });
      return "checked-reply";
    },
  };
  return r;
}

function device() {
  return fakeDevice()
    .on("GET /api/system/checkin", () => jsonResponse(200, { check: "check-token" }))
    .on("POST /api/system/checkin", () => jsonResponse(200, { status: "OK" }));
}

const client = (d: ReturnType<typeof device>, r: CheckinRelay | null, extra: Record<string, unknown> = {}) =>
  new HemClient({ url: "https://my.ence.do", fetch: d.fetch, passphrase: V.passphrase, checkinRelay: r, ...extra });

const drifted = (d: ReturnType<typeof device>) =>
  jsonResponse(200, { ...d.challenge, exp: nowSec() + 60 + 3600 }); // device clock one hour ahead

describe("clock recovery", () => {
  // verifies: REQ-AUTH-009
  it("a 403 on the challenge leads to one check-in and a repeated login", async () => {
    const d = device().once("GET /api/auth/token", emptyResponse(403));
    const r = relay();
    const info = await client(d, r).auth.login("keymgmt:list");
    expect(info.scope).toBe("keymgmt:list");
    expect(r.calls).toBe(1);
    expect(d.log()).toEqual([
      "GET /api/auth/token",
      "GET /api/system/checkin",
      "POST /api/system/checkin",
      "GET /api/auth/token",
      "POST /api/auth/token",
    ]);
  });

  // verifies: REQ-AUTH-009
  it("a 401 on the proof with drift evidence leads to one check-in and a fresh challenge", async () => {
    const d = device();
    d.once("GET /api/auth/token", drifted(d));
    d.once("POST /api/auth/token", emptyResponse(401));
    const r = relay();
    await client(d, r).auth.login("keymgmt:list");
    expect(r.calls).toBe(1);
    expect(d.log()).toEqual([
      "GET /api/auth/token",
      "POST /api/auth/token",
      "GET /api/system/checkin",
      "POST /api/system/checkin",
      "GET /api/auth/token",
      "POST /api/auth/token",
    ]);
  });

  // verifies: REQ-AUTH-009
  it("a 401 without drift evidence is a wrong passphrase: no check-in", async () => {
    const d = device().once("POST /api/auth/token", emptyResponse(401));
    const r = relay();
    await expect(client(d, r).auth.login("keymgmt:list")).rejects.toBeInstanceOf(HemUnauthenticatedError);
    expect(r.calls).toBe(0);
    expect(d.log().some((l) => l.includes("checkin"))).toBe(false);
  });

  // verifies: REQ-AUTH-009
  it("runs at most one recovery check-in per token acquisition", async () => {
    const d = device().once("GET /api/auth/token", emptyResponse(403), emptyResponse(403));
    const r = relay();
    const c = client(d, r);
    await expect(c.auth.login("keymgmt:list")).rejects.toBeInstanceOf(HemForbiddenError);
    expect(r.calls).toBe(1);
    // a new acquisition may recover again
    d.once("GET /api/auth/token", emptyResponse(403));
    await c.auth.login("keymgmt:list");
    expect(r.calls).toBe(2);
  });

  // verifies: REQ-AUTH-009
  it("reports the original error with recovery off or without a relay", async () => {
    const d1 = device().once("GET /api/auth/token", emptyResponse(403));
    const r1 = relay();
    await expect(client(d1, r1, { clockRecovery: false }).auth.login("keymgmt:list")).rejects.toBeInstanceOf(HemForbiddenError);
    expect(r1.calls).toBe(0);
    const d2 = device().once("GET /api/auth/token", emptyResponse(403));
    await expect(client(d2, null).auth.login("keymgmt:list")).rejects.toBeInstanceOf(HemForbiddenError);
    expect(d2.log()).toEqual(["GET /api/auth/token"]);
  });

  // verifies: REQ-AUTH-009
  it("attaches a failing check-in as the cause of the login error", async () => {
    const d = device().once("GET /api/auth/token", emptyResponse(403));
    const err = await client(d, relay(true)).auth.login("keymgmt:list").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HemForbiddenError);
    expect((err as Error).cause).toBeInstanceOf(HemRelayError);
    expect(((err as Error).cause as HemRelayError).operation).toBe("checkinRelay.exchange");
  });
});
