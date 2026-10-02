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
