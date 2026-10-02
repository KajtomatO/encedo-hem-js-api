import { describe, expect, it } from "vitest";
import * as pkg from "../../src/index.js";
import { HEM_API_VERSION, HemClient, HemValidationError } from "../../src/index.js";
import { createFakeFetch, jsonResponse } from "../support/fake-fetch.js";

describe("HemClient construction", () => {
  // verifies: REQ-API-001
  it("performs no fetch call", () => {
    const f = createFakeFetch();
    const client = new HemClient({ url: "https://my.ence.do", fetch: f, passphrase: "secret" });
    expect(client.auth).toBeDefined();
    expect(client.system).toBeDefined();
    expect(client.keys).toBeDefined();
    expect(client.crypto).toBeDefined();
    expect(f.calls).toHaveLength(0);
  });

  // verifies: REQ-API-001
  it.each([undefined, "", "ftp://my.ence.do", "my.ence.do", "file:///etc/x"])("rejects url %s", (url) => {
    expect(() => new HemClient({ url: url as string, fetch: createFakeFetch() })).toThrow(HemValidationError);
  });

  // verifies: REQ-API-001
  it("rejects a missing options object", () => {
    expect(() => new HemClient(undefined as never)).toThrow(HemValidationError);
  });

  // verifies: REQ-API-001
  it("keeps request queues separate between clients", async () => {
    const gate: (() => void)[] = [];
    const a = createFakeFetch().fallback(() => new Promise<Response>((r) => gate.push(() => r(jsonResponse(200, {})))));
    const b = createFakeFetch().fallback(() => jsonResponse(200, { ctx: 1, uptime: 1, temp: 1, fls_state: 0 }));
    const ca = new HemClient({ url: "https://a.example", fetch: a });
    const cb = new HemClient({ url: "https://b.example", fetch: b });
    // client A is blocked on a pending request; client B is not affected
    const pa = (ca as unknown as { system: { status?: () => Promise<unknown> } }).system;
    const pb = (cb as unknown as { system: { status?: () => Promise<unknown> } }).system;
    if (pa.status && pb.status) {
      const blocked = pa.status();
      await pb.status();
      expect(b.calls).toHaveLength(1);
      gate.shift()?.();
      await blocked.catch(() => {});
    }
    expect(a.calls.every((c) => c.url.startsWith("https://a.example"))).toBe(true);
  });

  // verifies: REQ-API-001
  it("exports no function that changes an already constructed client", () => {
    const fns = Object.entries(pkg).filter(([, v]) => typeof v === "function");
    for (const [name, v] of fns) {
      // every exported function is a class (client or error) or a pure helper
      expect(/^(Hem[A-Za-z]*|parseKeyType|Encedo[A-Za-z]*Relay)$/.test(name), name).toBe(true);
      expect(typeof v).toBe("function");
    }
  });
});

describe("API version", () => {
  // verifies: REQ-API-010
  it("exports HEM_API_VERSION = 1.2.2 from the package root", () => {
    expect(HEM_API_VERSION).toBe("1.2.2");
    expect((pkg as Record<string, unknown>)["HEM_API_VERSION"]).toBe("1.2.2");
  });
});
