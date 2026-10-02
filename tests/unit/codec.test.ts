import { describe, expect, it } from "vitest";
import {
  decodeBase64,
  decodeHex,
  encodeBase64,
  encodeBase64Url,
  encodeHex,
  utf8Encode,
  validateBodySize,
  validateDescription,
  validateKid,
  validateLabel,
  validateMessage,
} from "../../src/codec/index.js";
import { HemValidationError } from "../../src/errors.js";

const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);

describe("base64", () => {
  // verifies: REQ-API-004
  it("round-trips standard base64 with padding, including empty and all byte values", () => {
    for (let len = 0; len <= 256; len++) {
      const bytes = ALL_BYTES.slice(0, len);
      const text = encodeBase64(bytes);
      expect(text.length % 4).toBe(0);
      expect(decodeBase64(text)).toEqual(bytes);
    }
    expect(encodeBase64(new Uint8Array())).toBe("");
    expect(encodeBase64(utf8Encode("f"))).toBe("Zg==");
    expect(encodeBase64(utf8Encode("fo"))).toBe("Zm8=");
    expect(encodeBase64(utf8Encode("foo"))).toBe("Zm9v");
    expect(encodeBase64(Uint8Array.of(0xfb, 0xff))).toBe("+/8=");
  });

  // verifies: REQ-API-004
  it("round-trips base64url without padding", () => {
    for (let len = 0; len <= 256; len++) {
      const bytes = ALL_BYTES.slice(0, len);
      const text = encodeBase64Url(bytes);
      expect(text).not.toMatch(/[=+/]/);
      expect(decodeBase64(text)).toEqual(bytes);
    }
    expect(encodeBase64Url(Uint8Array.of(0xfb, 0xff))).toBe("-_8");
  });

  // verifies: REQ-API-004
  it("decodes both alphabets with and without padding", () => {
    const bytes = Uint8Array.of(0xfb, 0xff, 0xfe, 0x01);
    for (const text of ["+//+AQ==", "+//+AQ", "-__-AQ==", "-__-AQ"]) {
      expect(decodeBase64(text)).toEqual(bytes);
    }
  });

  it("rejects malformed base64", () => {
    for (const bad of ["A", "A===", "AB=", "AB*C", "Zg=a", "ü"]) {
      expect(() => decodeBase64(bad), bad).toThrow(RangeError);
    }
  });
});

describe("hex", () => {
  // verifies: REQ-API-004
  it("round-trips lowercase hex, including empty and all byte values", () => {
    expect(encodeHex(new Uint8Array())).toBe("");
    const text = encodeHex(ALL_BYTES);
    expect(text).toMatch(/^[0-9a-f]{512}$/);
    expect(decodeHex(text)).toEqual(ALL_BYTES);
    expect(decodeHex(text.toUpperCase())).toEqual(ALL_BYTES);
    expect(() => decodeHex("abc")).toThrow(RangeError);
    expect(() => decodeHex("zz")).toThrow(RangeError);
  });
});

function expectInvalid(fn: () => unknown, parameter: string): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HemValidationError);
    expect((e as HemValidationError).parameter).toBe(parameter);
    return;
  }
  throw new Error("expected HemValidationError");
}

describe("validators", () => {
  // verifies: REQ-API-005
  it("accepts a 32-hex key id and normalises it to lower case", () => {
    expect(validateKid("00112233445566778899AABBCCDDEEFF")).toBe("00112233445566778899aabbccddeeff");
    for (const bad of ["", "0011", "00112233445566778899aabbccddeeff00", "00112233445566778899aabbccddeefg", 42]) {
      expectInvalid(() => validateKid(bad), "kid");
    }
  });

  // verifies: REQ-API-005
  it("accepts labels of 1 to 32 printable ASCII characters", () => {
    expect(validateLabel("a")).toBe("a");
    expect(validateLabel("x".repeat(32))).toBe("x".repeat(32));
    expect(validateLabel(" ~!")).toBe(" ~!");
    for (const bad of ["", "x".repeat(33), "tab\there", "zażółć", "nl\n"]) expectInvalid(() => validateLabel(bad), "label");
  });

  // verifies: REQ-API-005
  it("accepts descriptions up to 64 bytes", () => {
    expect(validateDescription(new Uint8Array(64))).toHaveLength(64);
    expect(validateDescription(new Uint8Array(0))).toHaveLength(0);
    expectInvalid(() => validateDescription(new Uint8Array(65)), "description");
    expectInvalid(() => validateDescription("text"), "description");
  });

  // verifies: REQ-API-005
  it("accepts messages of 1 to 2048 bytes and rejects an empty one", () => {
    expect(validateMessage(new Uint8Array(2048))).toHaveLength(2048);
    expect(validateMessage(new Uint8Array(1))).toHaveLength(1);
    expectInvalid(() => validateMessage(new Uint8Array(2049)), "message");
    expectInvalid(() => validateMessage(new Uint8Array(0)), "message");
    expect(validateMessage(new Uint8Array(0), "message", true)).toHaveLength(0);
  });

  // verifies: REQ-API-005
  it("accepts a 7300-byte body and rejects 7301", () => {
    expect(() => validateBodySize("x".repeat(7300))).not.toThrow();
    expectInvalid(() => validateBodySize("x".repeat(7301)), "body");
    // multi-byte characters count as bytes, not characters
    expectInvalid(() => validateBodySize("ż".repeat(3651)), "body");
  });
});
