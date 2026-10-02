import { afterEach, describe, expect, it, vi } from "vitest";
import { Transport, type DeviceRequest } from "../../../src/transport/transport.js";
import {
  HemAbortError,
  HemDeviceError,
  HemTimeoutError,
  HemUnreachableError,
  HemUnsupportedError,
  HemValidationError,
} from "../../../src/errors.js";
import { createFakeFetch, emptyResponse, hangingFetch, jsonResponse } from "../../support/fake-fetch.js";

const GET: DeviceRequest = { operation: "system.status", method: "GET", path: "/api/system/status" };

afterEach(() => {
  vi.useRealTimers();
});

describe("fetch injection", () => {
  // verifies: REQ-NET-001
  it("uses the supplied fetch and never the global one", async () => {
    const f = createFakeFetch(jsonResponse(200, { ok: 1 }));
    const t = new Transport({ url: "https://my.ence.do", fetch: f });
    const res = await t.send(GET);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.text)).toEqual({ ok: 1 });
    expect(f.calls).toHaveLength(1);
    // the setup's global fetch fails the test when called
  });

  // verifies: REQ-NET-001
  it("calls fetch with (url, init) only", async () => {
    const f = createFakeFetch(jsonResponse(200, {}));
    await new Transport({ url: "https://my.ence.do", fetch: f }).send(GET);
    expect(f.calls[0]!.argCount).toBe(2);
    expect(typeof f.calls[0]!.url).toBe("string");
  });

  // verifies: REQ-NET-001
  it("falls back to the global fetch", async () => {
    const g = createFakeFetch(jsonResponse(200, {}));
    vi.stubGlobal("fetch", g);
    await new Transport({ url: "https://my.ence.do" }).send(GET);
    expect(g.calls).toHaveLength(1);
  });

  // verifies: REQ-NET-001
  it("throws HemUnsupportedError at construction when no fetch exists", () => {
    vi.stubGlobal("fetch", undefined);
    expect(() => new Transport({ url: "https://my.ence.do" })).toThrow(HemUnsupportedError);
  });
});

describe("device address", () => {
  // verifies: REQ-NET-002
  it.each([
    ["https://my.ence.do", "https://my.ence.do/api/system/status"],
    ["https://my.ence.do/", "https://my.ence.do/api/system/status"],
    ["https://192.168.7.1", "https://192.168.7.1/api/system/status"],
    ["http://192.168.7.1", "http://192.168.7.1/api/system/status"],
    ["http://192.168.7.1/", "http://192.168.7.1/api/system/status"],
    ["https://hem.example:8443", "https://hem.example:8443/api/system/status"],
    ["https://[fe80::1]:8443/", "https://[fe80::1]:8443/api/system/status"],
    ["http://[::1]", "http://[::1]/api/system/status"],
    ["https://proxy.example/hem1", "https://proxy.example/hem1/api/system/status"],
    ["https://proxy.example/hem1/", "https://proxy.example/hem1/api/system/status"],
    [new URL("https://my.ence.do"), "https://my.ence.do/api/system/status"],
  ])("%s targets %s", async (url, expected) => {
    const f = createFakeFetch(jsonResponse(200, {}));
    await new Transport({ url, fetch: f }).send(GET);
    expect(f.calls[0]!.url).toBe(expected);
  });

  // verifies: REQ-NET-002
  it.each(["https://user:pw@my.ence.do", "https://user@my.ence.do", "ftp://my.ence.do", "not a url", "https://h/?q=1"])(
    "rejects %s with HemValidationError",
    (url) => {
      expect(() => new Transport({ url, fetch: createFakeFetch() })).toThrow(HemValidationError);
    },
  );
});

describe("time limit", () => {
  // verifies: REQ-NET-004
  it("defaults to 30 000 ms and aborts the fetch signal on expiry", async () => {
    vi.useFakeTimers();
    const f = hangingFetch();
    const t = new Transport({ url: "https://my.ence.do", fetch: f });
    expect(t.timeoutMs).toBe(30_000);
    const p = t.send(GET);
    const assertion = expect(p).rejects.toBeInstanceOf(HemTimeoutError);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(f.signals[0]!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(f.signals[0]!.aborted).toBe(true);
  });

  // verifies: REQ-NET-004
  it("is settable per transport and per call", async () => {
    vi.useFakeTimers();
    const t = new Transport({ url: "https://my.ence.do", fetch: hangingFetch(), timeoutMs: 1000 });
    const p1 = t.send(GET);
    const a1 = expect(p1).rejects.toBeInstanceOf(HemTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await a1;
    const p2 = t.send({ ...GET, timeoutMs: 50 });
    const a2 = expect(p2).rejects.toBeInstanceOf(HemTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await a2;
    expect(() => new Transport({ url: "https://h", fetch: hangingFetch(), timeoutMs: 0 })).toThrow(HemValidationError);
  });

  // verifies: REQ-NET-004
  it("covers reading the response body", async () => {
    vi.useFakeTimers();
    const stalled = new Response(new ReadableStream({ start() {} }), { status: 200 });
    const f = createFakeFetch(stalled);
    const p = new Transport({ url: "https://my.ence.do", fetch: f, timeoutMs: 500 }).send(GET);
    const assertion = expect(p).rejects.toBeInstanceOf(HemTimeoutError);
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });
});

describe("cancellation and failure classes", () => {
  // verifies: REQ-NET-005, REQ-NET-006
  it("raises HemAbortError when aborted during the request and aborts the fetch signal", async () => {
    const f = hangingFetch();
    const ac = new AbortController();
    const p = new Transport({ url: "https://my.ence.do", fetch: f }).send({ ...GET, signal: ac.signal });
    await Promise.resolve();
    ac.abort();
    await expect(p).rejects.toBeInstanceOf(HemAbortError);
    expect(f.signals[0]!.aborted).toBe(true);
  });

  // verifies: REQ-NET-005
  it("rejects an already-aborted signal without calling fetch", async () => {
    const f = createFakeFetch();
    const ac = new AbortController();
    ac.abort();
    await expect(new Transport({ url: "https://my.ence.do", fetch: f }).send({ ...GET, signal: ac.signal })).rejects.toBeInstanceOf(
      HemAbortError,
    );
    expect(f.calls).toHaveLength(0);
  });

  // verifies: REQ-NET-006
  it("raises HemUnreachableError with the fetch rejection as cause", async () => {
    const root = new TypeError("fetch failed");
    const f = createFakeFetch(() => Promise.reject(root));
    const err = await new Transport({ url: "https://my.ence.do", fetch: f }).send(GET).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HemUnreachableError);
    expect((err as HemUnreachableError).cause).toBe(root);
  });

  // verifies: REQ-NET-006
  it("lets the first of time limit and abort decide", async () => {
    vi.useFakeTimers();
    const t = new Transport({ url: "https://my.ence.do", fetch: hangingFetch(), timeoutMs: 100 });
    const ac1 = new AbortController();
    const p1 = t.send({ ...GET, signal: ac1.signal });
    const a1 = expect(p1).rejects.toBeInstanceOf(HemTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    ac1.abort();
    await a1;

    const ac2 = new AbortController();
    const p2 = t.send({ ...GET, signal: ac2.signal });
    const a2 = expect(p2).rejects.toBeInstanceOf(HemAbortError);
    await vi.advanceTimersByTimeAsync(99);
    ac2.abort();
    await vi.advanceTimersByTimeAsync(1);
    await a2;
  });
});

describe("request shape", () => {
  // verifies: REQ-NET-009
  it("sets Content-Type only with a body and Authorization only with a token", async () => {
    const f = createFakeFetch(jsonResponse(200, {}), jsonResponse(200, {}), jsonResponse(200, {}));
    const t = new Transport({ url: "https://my.ence.do", fetch: f });
    await t.send(GET);
    await t.send({ operation: "x", method: "POST", path: "/api/x", body: { a: 1 } });
    await t.send({ operation: "y", method: "GET", path: "/api/y", token: "tok" });
    expect(f.calls[0]!.headers).toEqual({});
    expect(f.calls[1]!.headers).toEqual({ "content-type": "application/json" });
    expect(f.calls[1]!.body).toBe('{"a":1}');
    expect(f.calls[2]!.headers).toEqual({ authorization: "Bearer tok" });
  });

  // verifies: REQ-NET-010
  it("disables redirect following and treats a redirect as an error", async () => {
    const redirect = new Response(null, { status: 302, headers: { Location: "https://elsewhere/" } });
    const f = createFakeFetch(redirect);
    const err = await new Transport({ url: "https://my.ence.do", fetch: f }).send({ ...GET, token: "t" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HemDeviceError);
    expect((err as HemDeviceError).status).toBe(302);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.init!.redirect).toBe("manual");
  });

  // verifies: REQ-NET-010
  it("treats an opaque redirect (browser manual mode) as an error", async () => {
    const opaque = Response.error();
    Object.defineProperty(opaque, "type", { value: "opaqueredirect" });
    Object.defineProperty(opaque, "status", { value: 0 });
    const f = createFakeFetch(opaque);
    await expect(new Transport({ url: "https://my.ence.do", fetch: f }).send(GET)).rejects.toBeInstanceOf(HemDeviceError);
  });

  // verifies: REQ-API-005
  it("rejects a serialised body over 7300 bytes before calling fetch", async () => {
    const f = createFakeFetch(jsonResponse(200, {}));
    const t = new Transport({ url: "https://my.ence.do", fetch: f });
    const overhead = JSON.stringify({ m: "" }).length;
    await expect(t.send({ operation: "x", method: "POST", path: "/api/x", body: { m: "a".repeat(7301 - overhead) } })).rejects.toBeInstanceOf(
      HemValidationError,
    );
    expect(f.calls).toHaveLength(0);
    await t.send({ operation: "x", method: "POST", path: "/api/x", body: { m: "a".repeat(7300 - overhead) } });
    expect(f.calls).toHaveLength(1);
  });

  it("returns error statuses as responses for the caller to map", async () => {
    const f = createFakeFetch(emptyResponse(403));
    const res = await new Transport({ url: "https://my.ence.do", fetch: f }).send(GET);
    expect(res.status).toBe(403);
    expect(res.text).toBe("");
  });
});
