import { describe, expect, it } from "vitest";
import { globalFetchCalls, UnexpectedGlobalFetchError } from "../support/setup.js";

describe("test environment", () => {
  // verifies: REQ-TEST-001
  it("replaces the global fetch with one that fails the test", async () => {
    await expect(Promise.resolve().then(() => fetch("https://example.invalid/"))).rejects.toBeInstanceOf(
      UnexpectedGlobalFetchError,
    );
    expect(globalFetchCalls).toHaveLength(1);
    globalFetchCalls.length = 0; // the call above was deliberate
  });

  // verifies: REQ-TEST-002
  it("provides Web Crypto and fetch types in this runtime", () => {
    expect(typeof globalThis.crypto?.subtle?.importKey).toBe("function");
    expect(typeof AbortController).toBe("function");
    expect(typeof Response).toBe("function");
  });
});
