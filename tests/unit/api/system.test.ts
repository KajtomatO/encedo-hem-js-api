import { afterEach, describe, expect, it, vi } from "vitest";
import { HemAbortError, HemClient, HemOriginRejectedError, HemProtocolError } from "../../../src/index.js";
import { expectEmpty, parseObject } from "../../../src/internal/parse.js";
import { createFakeFetch, emptyResponse, hangingFetch, jsonResponse } from "../../support/fake-fetch.js";
import { fakeDevice } from "../../support/device.js";
import { LOGIN_VECTOR as V } from "../../support/vectors.js";

afterEach(() => vi.useRealTimers());

const STATUS = { ctx: 1, uptime: 3600, temp: 31.5, fls_state: 0, ts: "2026-10-02T12:00:00Z", time: 1790000000 };
const VERSION = { hwv: "PPA rev 2.2", fwv: "nGINE 1.2.2", fwk: "AQID", fws: "BAUG" };

const clientWith = (f: ReturnType<typeof createFakeFetch>, url = "https://my.ence.do") => new HemClient({ url, fetch: f });

describe("tolerant parsing", () => {
  // verifies: REQ-API-006
  it("accepts unknown fields and names a missing required field", async () => {
    const c = clientWith(createFakeFetch(jsonResponse(200, { ...STATUS, future_field: { x: 1 } })));
    expect((await c.system.status()).ctx).toBe(1);
    for (const field of ["ctx", "uptime", "temp", "fls_state"]) {
      const body: Record<string, unknown> = { ...STATUS };
      delete body[field];
      const err = await clientWith(createFakeFetch(jsonResponse(200, body))).system.status().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HemProtocolError);
      expect((err as Error).message).toContain(field);
    }
  });

  // verifies: REQ-API-006
  it("raises HemProtocolError for a non-JSON 2xx body and accepts an empty documented-empty 200", async () => {
    const c = clientWith(createFakeFetch(new Response("<html>", { status: 200 })));
    await expect(c.system.status()).rejects.toBeInstanceOf(HemProtocolError);
    const empty = { status: 200, headers: new Headers(), text: "" };
    expect(() => expectEmpty(empty)).not.toThrow();
    expect(() => parseObject(empty, "x")).toThrow(HemProtocolError);
  });
});

describe("system.status", () => {
  // verifies: REQ-SYS-001
  it("sends GET /api/system/status without Authorization and maps the fields", async () => {
    const f = createFakeFetch(jsonResponse(200, { ...STATUS, storage: ["123:rw", "0:-"], format: "done" }));
    const s = await clientWith(f).system.status();
    expect(f.calls[0]!.method).toBe("GET");
    expect(f.calls[0]!.url).toBe("https://my.ence.do/api/system/status");
    expect(f.calls[0]!.headers).toEqual({});
    expect(s).toMatchObject({
      initialised: true, clockSet: true, ctx: 1, uptime: 3600, temp: 31.5, flsState: 0,
      time: 1790000000, ts: "2026-10-02T12:00:00Z", trustedTime: true, fwUpgrade: false,
      storage: ["123:rw", "0:-"], format: "done",
    });
  });

  // verifies: REQ-SYS-001
  it("derives initialised and clock-set from the omitted fields", async () => {
    const base = { ctx: 1, uptime: 5, temp: 30, fls_state: 0 };
    const c = clientWith(
      createFakeFetch(
        jsonResponse(200, { ...base, inited: false }),
        jsonResponse(200, { ...base, ts: "2026-01-01T00:00:00Z" }),
        jsonResponse(200, { ...base, time: 5 }),
        jsonResponse(200, { ...base, tts: false, https: true, hostname: "my.ence.do", fw_upgrade: true }),
      ),
      "http://192.168.7.1",
    );
    const a = await c.system.status();
    expect([a.initialised, a.clockSet, a.storage, a.format]).toEqual([false, false, undefined, undefined]);
    expect((await c.system.status()).clockSet).toBe(true);
    expect((await c.system.status()).clockSet).toBe(true);
    expect(await c.system.status()).toMatchObject({ initialised: true, trustedTime: false, https: true, hostname: "my.ence.do", fwUpgrade: true });
  });
});

describe("system.version", () => {
  // verifies: REQ-SYS-002
  it("sends GET /api/system/version without Authorization; strings and bytes as specified", async () => {
    const f = createFakeFetch(jsonResponse(200, VERSION));
    const v = await clientWith(f).system.version();
    expect(f.calls[0]!.url).toBe("https://my.ence.do/api/system/version");
    expect(f.calls[0]!.headers["authorization"]).toBeUndefined();
    expect(v).toMatchObject({ hwv: "PPA rev 2.2", fwv: "nGINE 1.2.2", blv: undefined, uis: undefined });
    expect(v.fwk).toEqual(Uint8Array.of(1, 2, 3));
    expect(v.fws).toEqual(Uint8Array.of(4, 5, 6));
  });

  // verifies: REQ-SYS-002
  it("includes the optional fields when sent", async () => {
    const f = createFakeFetch(jsonResponse(200, { ...VERSION, blv: "bl 1", blk: "Bw==", bls: "CA==", sd_csd: "aa", sd_cid: "bb", uis: "CQ==" }));
    const v = await clientWith(f).system.version();
    expect(v).toMatchObject({ blv: "bl 1", sdCsd: "aa", sdCid: "bb" });
    expect([v.blk, v.bls, v.uis]).toEqual([Uint8Array.of(7), Uint8Array.of(8), Uint8Array.of(9)]);
    await expect(clientWith(createFakeFetch(jsonResponse(200, { hwv: "x", fwv: "y", fwk: "AQID" }))).system.version()).rejects.toBeInstanceOf(
      HemProtocolError,
    );
  });
});

describe("system.health", () => {
  // verifies: REQ-SYS-003
  it("maps the four facts and the summary from exactly one status request", async () => {
    const f = createFakeFetch(jsonResponse(200, STATUS));
    const h = await clientWith(f).system.health();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.url).toBe("https://my.ence.do/api/system/status");
    expect(h).toMatchObject({ reachable: true, initialised: true, selfTestOk: true, clockSet: true, healthy: true });
    for (const patch of [{ inited: false }, { fls_state: 2 }, { ts: undefined, time: undefined }]) {
      const h2 = await clientWith(createFakeFetch(jsonResponse(200, { ...STATUS, ...patch }))).system.health();
      expect(h2.reachable).toBe(true);
      expect(h2.healthy).toBe(false);
    }
  });

  // verifies: REQ-SYS-003
  it("reports an unreachable device without throwing", async () => {
    const h = await clientWith(createFakeFetch(() => Promise.reject(new TypeError("ECONNREFUSED")))).system.health();
    expect(h).toMatchObject({ reachable: false, initialised: false, selfTestOk: false, clockSet: false, healthy: false });
    expect(h.error?.code).toBe("UNREACHABLE");
  });

  // verifies: REQ-SYS-003
  it("reports an elapsed time limit as unreachable", async () => {
    vi.useFakeTimers();
    const p = new HemClient({ url: "https://my.ence.do", fetch: hangingFetch(), timeoutMs: 100 }).system.health();
    await vi.advanceTimersByTimeAsync(100);
    const h = await p;
    expect(h.reachable).toBe(false);
    expect(h.error?.code).toBe("TIMEOUT");
  });

  // verifies: REQ-SYS-003
  it("still raises HemAbortError on a caller abort", async () => {
    const ac = new AbortController();
    const p = clientWith(hangingFetch()).system.health({ signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toBeInstanceOf(HemAbortError);
  });

  it("raises other errors, such as an origin rejection", async () => {
    await expect(clientWith(createFakeFetch(emptyResponse(412))).system.health()).rejects.toBeInstanceOf(HemOriginRejectedError);
  });
});

describe("independent clients", () => {
  // verifies: REQ-API-001
  it("do not share request queues or tokens", async () => {
    const gate: (() => void)[] = [];
    const a = createFakeFetch().fallback(() => new Promise<Response>((r) => gate.push(() => r(jsonResponse(200, STATUS)))));
    const b = createFakeFetch().fallback(() => jsonResponse(200, STATUS));
    const ca = new HemClient({ url: "https://a.example", fetch: a });
    const cb = new HemClient({ url: "https://b.example", fetch: b });
    const blocked = ca.system.status();
    await cb.system.status();
    await cb.system.status();
    expect(b.calls).toHaveLength(2);
    gate.shift()!();
    await blocked;
    const da = fakeDevice("https://a.example");
    const db = fakeDevice("https://b.example");
    const la = new HemClient({ url: "https://a.example", fetch: da.fetch, passphrase: V.passphrase });
    const lb = new HemClient({ url: "https://b.example", fetch: db.fetch, passphrase: V.passphrase });
    await la.auth.login("keymgmt:list");
    await lb.auth.login("keymgmt:list");
    expect(da.issued).toHaveLength(1);
    expect(db.issued).toHaveLength(1);
  });
});
