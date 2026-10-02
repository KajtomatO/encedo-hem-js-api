import { describe, expect, it, vi } from "vitest";
import {
  EncedoCheckinRelay,
  HemClient,
  HemDeviceError,
  HemProtocolError,
  HemRelayError,
  HemUnauthenticatedError,
  HemUnsupportedError,
  type CheckinRelay,
} from "../../../src/index.js";
import { createFakeFetch, emptyResponse, jsonResponse } from "../../support/fake-fetch.js";
import { fakeDevice } from "../../support/device.js";
import { LOGIN_VECTOR as V } from "../../support/vectors.js";

const CHECK = "eyJhbGciOiJIUzI1NiJ9.eyJub25jZSI6IngifQ.sig/+=";
const CHECKED = "eyJhbGciOiJFUzI1NiJ9.eyJzdGF0dXMiOiJPSyJ9.reply/+=";

function memoryRelay(reply = CHECKED): CheckinRelay & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    async exchange(check) {
      seen.push(check);
      return reply;
    },
  };
}

function checkinDevice() {
  return fakeDevice()
    .on("GET /api/system/checkin", () => jsonResponse(200, { check: CHECK }))
    .on("POST /api/system/checkin", () => jsonResponse(200, { status: "OK" }));
}

describe("check-in step 1", () => {
  // verifies: REQ-SYS-004
  it("returns check unmodified without Authorization, even with tokens cached", async () => {
    const d = checkinDevice();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, passphrase: V.passphrase, checkinRelay: null });
    await c.auth.login("keymgmt:list");
    expect(await c.system.getCheckin()).toBe(CHECK);
    const call = d.fetch.calls.at(-1)!;
    expect(call.method).toBe("GET");
    expect(call.url).toBe("https://my.ence.do/api/system/checkin");
    expect(call.headers["authorization"]).toBeUndefined();
  });

  // verifies: REQ-SYS-004
  it("raises HemProtocolError for a reply without check", async () => {
    const c = new HemClient({ url: "https://my.ence.do", fetch: createFakeFetch(jsonResponse(200, { chk: "x" })) });
    await expect(c.system.getCheckin()).rejects.toBeInstanceOf(HemProtocolError);
  });
});

describe("check-in step 2", () => {
  // verifies: REQ-SYS-005
  it("posts {checked} unmodified without Authorization and returns the result", async () => {
    const f = createFakeFetch(jsonResponse(200, { status: "OK", newcrt: "OK", newfws: "fws", newuis: "uis", extra: 1 }), jsonResponse(200, { status: "R" }));
    const c = new HemClient({ url: "http://192.168.7.1", fetch: f });
    expect(await c.system.postCheckin(CHECKED)).toEqual({ status: "OK", newcrt: "OK", newfws: "fws", newuis: "uis" });
    expect(f.calls[0]!.method).toBe("POST");
    expect(f.calls[0]!.body).toBe(JSON.stringify({ checked: CHECKED }));
    expect(f.calls[0]!.headers).toEqual({ "content-type": "application/json" });
    expect(await c.system.postCheckin(CHECKED)).toEqual({ status: "R", newcrt: undefined, newfws: undefined, newuis: undefined });
  });

  // verifies: REQ-SYS-005
  it("raises HemUnauthenticatedError on 401 without any login request", async () => {
    const d = fakeDevice().once("POST /api/system/checkin", emptyResponse(401));
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, passphrase: V.passphrase });
    await expect(c.system.postCheckin(CHECKED)).rejects.toBeInstanceOf(HemUnauthenticatedError);
    expect(d.log()).toEqual(["POST /api/system/checkin"]);
  });
});

describe("default check-in relay", () => {
  // verifies: REQ-SYS-006
  it("posts JSON {check} to the backend and returns checked, with its own fetch", async () => {
    const cloud = createFakeFetch(jsonResponse(200, { checked: CHECKED, other: 1 }));
    const relay = new EncedoCheckinRelay({ fetch: cloud });
    expect(relay.url).toBe("https://api.encedo.com/checkin");
    expect(await relay.exchange(CHECK)).toBe(CHECKED);
    expect(cloud.calls[0]!.url).toBe("https://api.encedo.com/checkin");
    expect(cloud.calls[0]!.method).toBe("POST");
    expect(cloud.calls[0]!.body).toBe(JSON.stringify({ check: CHECK }));
  });

  // verifies: REQ-SYS-006
  it("uses the global fetch by default, never the device fetch, and a configurable URL", async () => {
    const g = createFakeFetch(jsonResponse(200, { checked: CHECKED }));
    vi.stubGlobal("fetch", g);
    const d = checkinDevice();
    const c = new HemClient({
      url: "https://my.ence.do",
      fetch: d.fetch,
      checkinRelay: new EncedoCheckinRelay({ url: "https://backend.example/checkin" }),
    });
    await c.system.checkin();
    expect(g.calls.map((x) => x.url)).toEqual(["https://backend.example/checkin"]);
    expect(d.log()).toEqual(["GET /api/system/checkin", "POST /api/system/checkin"]);
  });

  // verifies: REQ-SYS-006
  it("raises an error carrying status and body for a non-200 status", async () => {
    const relay = new EncedoCheckinRelay({ fetch: createFakeFetch(new Response("bad check", { status: 400 })) });
    const err = await relay.exchange(CHECK).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HemRelayError);
    expect((err as HemRelayError).status).toBe(400);
    expect((err as HemRelayError).body).toBe("bad check");
  });

  // verifies: REQ-NET-007
  it("does not use the device request queue", async () => {
    const gate: (() => void)[] = [];
    const device = createFakeFetch().fallback(() => new Promise<Response>((r) => gate.push(() => r(jsonResponse(200, {})))));
    const cloud = createFakeFetch(jsonResponse(200, { checked: CHECKED }));
    const c = new HemClient({ url: "https://my.ence.do", fetch: device });
    const pending = c.system.status().catch(() => {});
    // the device queue is busy; the relay still goes out immediately
    expect(await new EncedoCheckinRelay({ fetch: cloud }).exchange(CHECK)).toBe(CHECKED);
    gate.shift()!();
    await pending;
  });
});

describe("one-call check-in", () => {
  // verifies: REQ-SYS-007, REQ-SYS-006
  it("runs the legs in order with values unchanged and returns step 2's result, using an in-memory relay", async () => {
    const d = checkinDevice();
    const relay = memoryRelay();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, checkinRelay: relay });
    expect(await c.system.checkin()).toEqual({ status: "OK", newcrt: undefined, newfws: undefined, newuis: undefined });
    expect(relay.seen).toEqual([CHECK]);
    expect(d.log()).toEqual(["GET /api/system/checkin", "POST /api/system/checkin"]);
    expect(d.fetch.calls[1]!.json).toEqual({ checked: CHECKED });
    // the setup's failing global fetch proves nothing went to api.encedo.com
  });

  // verifies: REQ-SYS-007
  it("names the failing leg", async () => {
    const d1 = fakeDevice().once("GET /api/system/checkin", emptyResponse(500));
    const e1 = await new HemClient({ url: "https://my.ence.do", fetch: d1.fetch, checkinRelay: memoryRelay() }).system.checkin().catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(HemDeviceError);
    expect((e1 as HemDeviceError).operation).toBe("system.getCheckin");

    const failing: CheckinRelay = { exchange: () => Promise.reject(new Error("backend down")) };
    const e2 = await new HemClient({ url: "https://my.ence.do", fetch: checkinDevice().fetch, checkinRelay: failing }).system.checkin().catch((e: unknown) => e);
    expect(e2).toBeInstanceOf(HemRelayError);
    expect((e2 as HemRelayError).operation).toBe("checkinRelay.exchange");

    const d3 = checkinDevice().once("POST /api/system/checkin", emptyResponse(401));
    const e3 = await new HemClient({ url: "https://my.ence.do", fetch: d3.fetch, checkinRelay: memoryRelay() }).system.checkin().catch((e: unknown) => e);
    expect(e3).toBeInstanceOf(HemUnauthenticatedError);
    expect((e3 as HemUnauthenticatedError).operation).toBe("system.postCheckin");
    // a failed check-in never triggers another check-in
    expect(d3.log()).toEqual(["GET /api/system/checkin", "POST /api/system/checkin"]);
  });

  // verifies: REQ-SYS-007
  it("raises HemUnsupportedError without a relay", async () => {
    const d = checkinDevice();
    const c = new HemClient({ url: "https://my.ence.do", fetch: d.fetch, checkinRelay: null });
    await expect(c.system.checkin()).rejects.toBeInstanceOf(HemUnsupportedError);
    expect(d.fetch.calls).toHaveLength(0);
  });
});
