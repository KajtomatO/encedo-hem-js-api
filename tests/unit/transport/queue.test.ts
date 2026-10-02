import { afterEach, describe, expect, it, vi } from "vitest";
import { Transport, type DeviceRequest } from "../../../src/transport/transport.js";
import { errorFromStatus } from "../../../src/errors.js";
import { HemAbortError, HemTlsRequiredError, HemUnreachableError } from "../../../src/errors.js";
import { createFakeFetch, jsonResponse, emptyResponse } from "../../support/fake-fetch.js";
import { advanceUntilSettled } from "../../support/timers.js";

const req = (n: number, extra: Partial<DeviceRequest> = {}): DeviceRequest => ({
  operation: `op${n}`,
  method: "GET",
  path: `/api/r${n}`,
  ...extra,
});

/** A fetch whose replies are released by hand; logs start and body-read events. */
function gatedFetch() {
  const log: string[] = [];
  const gates: (() => void)[] = [];
  const f = createFakeFetch().fallback((r) => {
    const name = new URL(r.url).pathname;
    log.push(`start ${name}`);
    return new Promise<Response>((resolve) => {
      gates.push(() => {
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new TextEncoder().encode("{}"));
            log.push(`body ${name}`);
            c.close();
          },
        });
        resolve(new Response(body, { status: 200 }));
      });
    });
  });
  return { f, log, release: () => gates.shift()?.() };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

afterEach(() => vi.useRealTimers());

describe("serialisation", () => {
  // verifies: REQ-NET-007
  it("starts the next request only after the previous one settled and its body was read, in call order", async () => {
    const { f, log, release } = gatedFetch();
    const t = new Transport({ url: "https://my.ence.do", fetch: f });
    const all = Promise.all([1, 2, 3, 4].map((n) => t.send(req(n))));
    await flush();
    expect(log).toEqual(["start /api/r1"]);
    for (let i = 0; i < 4; i++) {
      release();
      await flush();
    }
    await all;
    expect(log).toEqual([
      "start /api/r1", "body /api/r1",
      "start /api/r2", "body /api/r2",
      "start /api/r3", "body /api/r3",
      "start /api/r4", "body /api/r4",
    ]);
  });

  // verifies: REQ-NET-007
  it("does not let a failed request block the ones behind it", async () => {
    const f = createFakeFetch(() => Promise.reject(new TypeError("down")), jsonResponse(200, { n: 2 }));
    const t = new Transport({ url: "https://my.ence.do", fetch: f });
    const [a, b] = await Promise.allSettled([t.send(req(1)), t.send(req(2))]);
    expect(a.status === "rejected" && a.reason).toBeInstanceOf(HemUnreachableError);
    expect(b.status === "fulfilled" && JSON.parse(b.value.text)).toEqual({ n: 2 });
  });

  // verifies: REQ-NET-005
  it("removes an aborted queued call; it is never sent and the others proceed", async () => {
    const { f, log, release } = gatedFetch();
    const t = new Transport({ url: "https://my.ence.do", fetch: f });
    const ac = new AbortController();
    const p1 = t.send(req(1));
    const p2 = t.send(req(2, { signal: ac.signal }));
    const p3 = t.send(req(3));
    await flush();
    ac.abort();
    await expect(p2).rejects.toBeInstanceOf(HemAbortError);
    release();
    await flush();
    release();
    await Promise.all([p1, p3]);
    expect(f.calls.map((c) => new URL(c.url).pathname)).toEqual(["/api/r1", "/api/r3"]);
    expect(log).not.toContain("start /api/r2");
  });
});

describe("pacing", () => {
  // verifies: REQ-NET-008
  it("adds no delay by default", async () => {
    vi.useFakeTimers();
    const f = createFakeFetch().fallback(() => jsonResponse(200, {}));
    const t = new Transport({ url: "https://my.ence.do", fetch: f });
    expect(t.minIntervalMs).toBe(0);
    await Promise.all([t.send(req(1)), t.send(req(2)), t.send(req(3))]);
    expect(f.calls).toHaveLength(3);
  });

  // verifies: REQ-NET-008
  it("spaces request starts by the configured interval, retried requests included", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const starts: number[] = [];
    const f = createFakeFetch().fallback(() => {
      starts.push(Date.now());
      return jsonResponse(200, {});
    });
    const t = new Transport({ url: "https://my.ence.do", fetch: f, minIntervalMs: 150 });
    await advanceUntilSettled(Promise.all([t.send(req(1)), t.send(req(2)), t.send(req(3))]));
    // a retry is just another request through the same transport
    await advanceUntilSettled(t.send(req(1)));
    expect(starts).toHaveLength(4);
    for (let i = 1; i < starts.length; i++) expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(150);
  });
});

describe("HTTPS guard", () => {
  // verifies: REQ-NET-003
  it("refuses requiresTls requests on an http: transport without calling fetch", async () => {
    const f = createFakeFetch().fallback(() => jsonResponse(200, {}));
    const t = new Transport({ url: "http://192.168.7.1", fetch: f });
    await expect(t.send(req(1, { requiresTls: true }))).rejects.toBeInstanceOf(HemTlsRequiredError);
    expect(f.calls).toHaveLength(0);
    await t.send(req(2));
    expect(f.calls).toHaveLength(1);
    const s = new Transport({ url: "https://192.168.7.1", fetch: f });
    await s.send(req(3, { requiresTls: true }));
    expect(f.calls).toHaveLength(2);
  });

  // verifies: REQ-NET-003
  it("maps a 418 response to HemTlsRequiredError", async () => {
    const f = createFakeFetch(emptyResponse(418));
    const res = await new Transport({ url: "https://my.ence.do", fetch: f }).send(req(1));
    expect(errorFromStatus(res.status, "op1", res.text)).toBeInstanceOf(HemTlsRequiredError);
  });
});
