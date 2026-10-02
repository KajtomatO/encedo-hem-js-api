import { describe, expect, it } from "vitest";
import { HemClient, HemOperationFailedError, HemTlsRequiredError, HemValidationError } from "../../../src/index.js";
import { emptyResponse, jsonResponse } from "../../support/fake-fetch.js";
import { fakeDevice, jwtClaims } from "../../support/device.js";
import { LOGIN_VECTOR as V } from "../../support/vectors.js";

const KID = "00112233445566778899aabbccddeeff";

function setup(url = "https://my.ence.do") {
  const d = fakeDevice(url);
  const c = new HemClient({ url, fetch: d.fetch, passphrase: V.passphrase, checkinRelay: null });
  const calls = () => d.fetch.calls.filter((x) => !x.url.includes("/api/auth/"));
  const scopes = () =>
    d.fetch.calls
      .filter((x) => x.method === "POST" && x.url.endsWith("/api/auth/token"))
      .map((x) => jwtClaims((x.json as { auth: string }).auth)["scope"]);
  return { d, c, calls, scopes };
}

async function expectValidation(p: Promise<unknown>, parameter: string) {
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(HemValidationError);
  expect((e as HemValidationError).parameter).toBe(parameter);
}

describe("crypto.hmac", () => {
  // verifies: REQ-OPS-001, REQ-AUTH-005
  it("posts {kid, msg} without alg, scope keymgmt:use:<kid>, returns the MAC bytes", async () => {
    const { d, c, calls, scopes } = setup();
    d.on("POST /api/crypto/hmac/hash", () => jsonResponse(200, { mac: "AAECAw==" }));
    const mac = await c.crypto.hmac({ kid: KID.toUpperCase(), message: Uint8Array.of(104, 105) });
    expect(mac).toEqual(Uint8Array.of(0, 1, 2, 3));
    expect(calls()[0]!.json).toEqual({ kid: KID, msg: "aGk=" });
    expect(calls()[0]!.headers["authorization"]).toMatch(/^Bearer /);
    expect(scopes()).toEqual([`keymgmt:use:${KID}`]);
  });

  // verifies: REQ-OPS-001, REQ-API-005
  it("rejects an empty or over-2048-byte message and maps 406", async () => {
    const { d, c } = setup();
    await expectValidation(c.crypto.hmac({ kid: KID, message: new Uint8Array(0) }), "message");
    await expectValidation(c.crypto.hmac({ kid: KID, message: new Uint8Array(2049) }), "message");
    await expectValidation(c.crypto.hmac({ kid: "zz", message: Uint8Array.of(1) }), "kid");
    expect(d.fetch.calls).toHaveLength(0);
    d.on("POST /api/crypto/hmac/hash", () => emptyResponse(406));
    await expect(c.crypto.hmac({ kid: KID, message: new Uint8Array(2048) })).rejects.toBeInstanceOf(HemOperationFailedError);
  });
});

describe("crypto.wrap", () => {
  // verifies: REQ-OPS-002, REQ-AUTH-005
  it("posts {kid, msg, alg, iv} and returns the wrapped bytes", async () => {
    const { d, c, calls, scopes } = setup();
    d.on("POST /api/crypto/cipher/wrap", () => jsonResponse(200, { wrapped: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }));
    const out = await c.crypto.wrap({ kid: KID, data: new Uint8Array(16), alg: "AES128", iv: Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8) });
    expect(out).toHaveLength(24);
    expect(calls()[0]!.json).toEqual({ kid: KID, msg: "AAAAAAAAAAAAAAAAAAAAAA==", alg: "AES128", iv: "AQIDBAUGBwg=" });
    await c.crypto.wrap({ kid: KID, data: new Uint8Array(32) });
    expect(calls()[1]!.json).toEqual({ kid: KID, msg: "A".repeat(43) + "=" });
    expect(scopes()).toEqual([`keymgmt:use:${KID}`]);
  });

  // verifies: REQ-OPS-002, REQ-API-005
  it("rejects bad lengths, a bad iv and an unknown alg before sending", async () => {
    const { d, c } = setup();
    for (const n of [0, 8, 15, 17, 2056]) await expectValidation(c.crypto.wrap({ kid: KID, data: new Uint8Array(n) }), "data");
    await expectValidation(c.crypto.wrap({ kid: KID, data: new Uint8Array(16), iv: new Uint8Array(7) }), "iv");
    await expectValidation(c.crypto.wrap({ kid: KID, data: new Uint8Array(16), alg: "AES512" as never }), "alg");
    expect(d.fetch.calls).toHaveLength(0);
    d.on("POST /api/crypto/cipher/wrap", () => jsonResponse(200, { wrapped: "AA==" }));
    await c.crypto.wrap({ kid: KID, data: new Uint8Array(2048) });
  });
});

describe("crypto.unwrap", () => {
  // verifies: REQ-OPS-003, REQ-AUTH-005
  it("posts {kid, msg, alg, iv} and returns the unwrapped bytes", async () => {
    const { d, c, calls, scopes } = setup();
    d.on("POST /api/crypto/cipher/unwrap", () => jsonResponse(200, { unwrapped: "AQIDBAUGBwgJCgsMDQ4PEA==" }));
    const out = await c.crypto.unwrap({ kid: KID, data: new Uint8Array(24), alg: "AES256", iv: new Uint8Array(8) });
    expect(out).toEqual(Uint8Array.from({ length: 16 }, (_, i) => i + 1));
    expect(calls()[0]!.json).toEqual({ kid: KID, msg: "A".repeat(32), alg: "AES256", iv: "AAAAAAAAAAA=" });
    expect(scopes()).toEqual([`keymgmt:use:${KID}`]);
  });

  // verifies: REQ-OPS-003, REQ-API-005
  it("rejects input that is not a multiple of 8 bytes and maps 406", async () => {
    const { d, c } = setup();
    await expectValidation(c.crypto.unwrap({ kid: KID, data: new Uint8Array(23) }), "data");
    await expectValidation(c.crypto.unwrap({ kid: KID, data: new Uint8Array(0) }), "data");
    expect(d.fetch.calls).toHaveLength(0);
    d.on("POST /api/crypto/cipher/unwrap", () => emptyResponse(406));
    await expect(c.crypto.unwrap({ kid: KID, data: new Uint8Array(24) })).rejects.toBeInstanceOf(HemOperationFailedError);
  });
});

describe("HTTPS guard", () => {
  // verifies: REQ-NET-003
  it("refuses every crypto operation on an http: client with zero fetch calls", async () => {
    const { d, c } = setup("http://192.168.7.1");
    await expect(c.crypto.hmac({ kid: KID, message: Uint8Array.of(1) })).rejects.toBeInstanceOf(HemTlsRequiredError);
    await expect(c.crypto.wrap({ kid: KID, data: new Uint8Array(16) })).rejects.toBeInstanceOf(HemTlsRequiredError);
    await expect(c.crypto.unwrap({ kid: KID, data: new Uint8Array(24) })).rejects.toBeInstanceOf(HemTlsRequiredError);
    expect(d.fetch.calls).toHaveLength(0);
  });
});
