import { describe, expect, it } from "vitest";
import {
  HemClient,
  HemOperationFailedError,
  HemTlsRequiredError,
  HemValidationError,
  KEY_ALGORITHMS,
  KEY_FLAGS,
  parseKeyType,
  type KeyInfo,
} from "../../../src/index.js";
import { encodeBase64, utf8Encode } from "../../../src/codec/index.js";
import { emptyResponse, jsonResponse } from "../../support/fake-fetch.js";
import { fakeDevice, jwtClaims } from "../../support/device.js";
import { LOGIN_VECTOR as V } from "../../support/vectors.js";

const KID = "0123456789abcdef0123456789abcdef";
const KID_UPPER = KID.toUpperCase();

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

const key = (i: number, extra: Record<string, unknown> = {}) => ({
  kid: i.toString(16).padStart(32, "0"),
  created: 1700000000 + i,
  updated: 1700000100 + i,
  type: "AES256",
  label: `key${i}`,
  ...extra,
});
const page = (offset: number, total: number, keys: object[]) =>
  jsonResponse(200, { offset, deleted: 0, total, listed: keys.length, list: keys });

async function expectValidation(p: Promise<unknown>, parameter: string) {
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(HemValidationError);
  expect((e as HemValidationError).parameter).toBe(parameter);
}

describe("keys.create", () => {
  // verifies: REQ-KEY-001, REQ-AUTH-005
  it("posts {label, type, mode, descr} with scope keymgmt:gen and returns the kid", async () => {
    const { d, c, calls, scopes } = setup();
    d.on("POST /api/keymgmt/create", () => jsonResponse(200, { kid: KID_UPPER }));
    const kid = await c.keys.create({ label: "root", type: "SECP256R1", mode: "ECDH,ExDSA", description: Uint8Array.of(1, 2, 3) });
    expect(kid).toBe(KID);
    expect(calls()[0]!.json).toEqual({ label: "root", type: "SECP256R1", mode: "ECDH,ExDSA", descr: "AQID" });
    expect(calls()[0]!.headers["authorization"]).toMatch(/^Bearer /);
    expect(scopes()).toEqual(["keymgmt:gen"]);
    await c.keys.create({ label: "k", type: "AES256" });
    expect(calls()[1]!.json).toEqual({ label: "k", type: "AES256" });
  });

  // verifies: REQ-KEY-001, REQ-API-005
  it("validates type, mode, label and description before sending", async () => {
    const { d, c } = setup();
    await expectValidation(c.keys.create({ label: "x", type: "RSA2048" as never }), "type");
    await expectValidation(c.keys.create({ label: "x", type: "SECP256R1", mode: "ExDSA,ECDH" as never }), "mode");
    await expectValidation(c.keys.create({ label: "", type: "AES256" }), "label");
    await expectValidation(c.keys.create({ label: "x".repeat(33), type: "AES256" }), "label");
    await expectValidation(c.keys.create({ label: "x", type: "AES256", description: new Uint8Array(65) }), "description");
    expect(d.fetch.calls).toHaveLength(0);
    d.on("POST /api/keymgmt/create", () => jsonResponse(200, { kid: KID }));
    await c.keys.create({ label: "x".repeat(32), type: "AES256", description: new Uint8Array(64) });
  });
});

describe("keys.get", () => {
  // verifies: REQ-KEY-002, REQ-AUTH-005, REQ-API-005
  it("uses keymgmt:use:<kid> in lower case and maps the fields", async () => {
    const { d, c, calls, scopes } = setup();
    d.on(`GET /api/keymgmt/get/${KID}`, () => jsonResponse(200, { type: "SECP256R1", pubkey: "AgME", updated: 5, descr: "AQ==" }));
    const k = await c.keys.get(KID_UPPER);
    expect(calls()[0]!.url).toBe(`https://my.ence.do/api/keymgmt/get/${KID}`);
    expect(scopes()).toEqual([`keymgmt:use:${KID}`]);
    expect(k.kid).toBe(KID);
    expect(k.updated).toBe(5);
    expect(k.type?.algorithm).toBe("SECP256R1");
    expect(k.pubkey).toEqual(Uint8Array.of(2, 3, 4));
    expect(k.der).toBeUndefined();
    expect(k.description).toEqual(Uint8Array.of(1));
  });

  // verifies: REQ-KEY-002
  it("requires updated and maps 406 to HemOperationFailedError", async () => {
    const { d, c } = setup();
    d.once(`GET /api/keymgmt/get/${KID}`, jsonResponse(200, { type: "AES256" }));
    await expect(c.keys.get(KID)).rejects.toThrow(/updated/);
    d.once(`GET /api/keymgmt/get/${KID}`, emptyResponse(406));
    await expect(c.keys.get(KID)).rejects.toBeInstanceOf(HemOperationFailedError);
    await expectValidation(c.keys.get("abc"), "kid");
  });
});

describe("keys.search", () => {
  // verifies: REQ-KEY-003, REQ-AUTH-005
  it("posts the anchored base64 needle with paging; scope keymgmt:search", async () => {
    const { d, c, calls, scopes } = setup();
    d.on("POST /api/keymgmt/search", () => page(0, 1, [key(1, { descr: "AQID" })]));
    const needle = Uint8Array.of(1, 2, 3);
    const p = await c.keys.search({ description: needle });
    await c.keys.search({ description: needle, match: "suffix", offset: 2, limit: 15 });
    await c.keys.search({ description: Uint8Array.of(1), match: "contains" });
    expect(calls().map((x) => x.json)).toEqual([
      { descr: "^AQID" },
      { descr: "AQID$", offset: 2, limit: 15 },
      { descr: "AQ==" },
    ]);
    expect(scopes()).toEqual(["keymgmt:search"]);
    expect(p.total).toBe(1);
    expect(p.keys[0]!.description).toEqual(needle);
  });

  // verifies: REQ-KEY-003, REQ-API-005
  it("rejects a needle over 64 bytes, an empty needle and a limit over 15", async () => {
    const { d, c } = setup();
    await expectValidation(c.keys.search({ description: new Uint8Array(65) }), "description");
    await expectValidation(c.keys.search({ description: new Uint8Array(0) }), "description");
    await expectValidation(c.keys.search({ description: Uint8Array.of(1), limit: 16 }), "limit");
    expect(d.fetch.calls).toHaveLength(0);
  });

  // verifies: REQ-KEY-003
  it("maps an empty list and a 404 to an empty result", async () => {
    const { d, c } = setup();
    d.once("POST /api/keymgmt/search", page(0, 0, []), emptyResponse(404));
    expect((await c.keys.search({ description: Uint8Array.of(9) })).keys).toEqual([]);
    const p = await c.keys.search({ description: Uint8Array.of(9) });
    expect(p).toMatchObject({ total: 0, listed: 0, keys: [] });
  });

  // verifies: REQ-KEY-003
  it("findByDescription searches by prefix over all pages and keeps exact matches", async () => {
    const { d, c, calls } = setup();
    const want = utf8Encode("tenant-1");
    const longer = utf8Encode("tenant-10");
    const many = Array.from({ length: 15 }, (_, i) => key(i, { descr: encodeBase64(longer) }));
    d.once("POST /api/keymgmt/search", page(0, 17, many), page(15, 17, [key(20, { descr: encodeBase64(want) }), key(21, { descr: encodeBase64(longer) })]));
    const found = await c.keys.findByDescription(want);
    expect(found.map((k: KeyInfo) => k.kid)).toEqual([key(20).kid]);
    expect(calls().map((x) => x.json)).toEqual([
      { descr: `^${encodeBase64(want)}`, offset: 0, limit: 15 },
      { descr: `^${encodeBase64(want)}`, offset: 15, limit: 15 },
    ]);
  });
});

describe("keys.list", () => {
  // verifies: REQ-KEY-004, REQ-AUTH-005
  it("builds the three path forms; scope keymgmt:list; maps the page", async () => {
    const { d, c, calls, scopes } = setup();
    d.on("GET /api/keymgmt/list*", () => page(0, 2, [key(1, { descr: "AQ==", type: "PKEY,ECDH,ExDSA,SECP256R1" }), key(2)]));
    const p = await c.keys.list();
    await c.keys.list({ offset: 30 });
    await c.keys.list({ offset: 7, count: 1 });
    await c.keys.list({ count: 15 });
    expect(calls().map((x) => new URL(x.url).pathname)).toEqual([
      "/api/keymgmt/list",
      "/api/keymgmt/list/30",
      "/api/keymgmt/list/7/1",
      "/api/keymgmt/list/0/15",
    ]);
    expect(scopes()).toEqual(["keymgmt:list"]);
    expect(p).toMatchObject({ offset: 0, total: 2, listed: 2, deleted: 0 });
    expect(p.keys[0]).toMatchObject({ kid: key(1).kid, label: "key1", created: 1700000001, updated: 1700000101 });
    expect(p.keys[0]!.type.flags).toEqual(["PKEY", "ECDH", "ExDSA"]);
    expect(p.keys[0]!.description).toEqual(Uint8Array.of(1));
    expect(p.keys[1]!.description).toBeUndefined();
  });

  // verifies: REQ-KEY-004, REQ-API-005
  it("rejects a count outside 1..15 and a negative or non-integer offset", async () => {
    const { d, c } = setup();
    await expectValidation(c.keys.list({ count: 16 }), "count");
    await expectValidation(c.keys.list({ count: 0 }), "count");
    await expectValidation(c.keys.list({ offset: -1 }), "offset");
    await expectValidation(c.keys.list({ offset: 1.5 }), "offset");
    expect(d.fetch.calls).toHaveLength(0);
  });

  // verifies: REQ-KEY-004
  it("iterates until total, not stopping on a short page", async () => {
    const { d, c, calls } = setup();
    d.once("GET /api/keymgmt/list/0/15", page(0, 20, Array.from({ length: 10 }, (_, i) => key(i))));
    d.once("GET /api/keymgmt/list/10/15", page(10, 20, Array.from({ length: 10 }, (_, i) => key(10 + i))));
    const all: KeyInfo[] = [];
    for await (const k of c.keys.iterate()) all.push(k);
    expect(all).toHaveLength(20);
    expect(calls()).toHaveLength(2);
  });

  // verifies: REQ-KEY-004
  it("stops on an empty page", async () => {
    const { d, c } = setup();
    d.once("GET /api/keymgmt/list/0/5", page(0, 9, [key(1), key(2)]));
    d.once("GET /api/keymgmt/list/2/5", page(2, 9, []));
    const all: KeyInfo[] = [];
    for await (const k of c.keys.iterate({ pageSize: 5 })) all.push(k);
    expect(all).toHaveLength(2);
  });
});

describe("key type parsing", () => {
  // verifies: REQ-KEY-005
  it("recognises every flag and algorithm; a bare name has no flags", () => {
    const t = parseKeyType("ATT,PKEY,ECDH,ExDSA,CERT,PQC,SECP256R1");
    expect(t.flags).toEqual([...KEY_FLAGS]);
    expect(t.algorithm).toBe("SECP256R1");
    for (const alg of KEY_ALGORITHMS) {
      expect(parseKeyType(alg)).toEqual({ raw: alg, flags: [], algorithm: alg, unknown: [] });
    }
  });

  // verifies: REQ-KEY-005
  it("keeps unknown tokens without raising", () => {
    const t = parseKeyType("PKEY,NEWFLAG,DER_PKEY");
    expect(t).toEqual({ raw: "PKEY,NEWFLAG,DER_PKEY", flags: ["PKEY"], algorithm: undefined, unknown: ["NEWFLAG", "DER_PKEY"] });
  });
});

describe("HTTPS guard", () => {
  // verifies: REQ-NET-003
  it("refuses every key operation on an http: client with zero fetch calls", async () => {
    const { d, c } = setup("http://192.168.7.1");
    const ops = [
      () => c.keys.create({ label: "x", type: "AES256" }),
      () => c.keys.get(KID),
      () => c.keys.search({ description: Uint8Array.of(1) }),
      () => c.keys.findByDescription(Uint8Array.of(1)),
      () => c.keys.list(),
      async () => {
        for await (const _ of c.keys.iterate()) void _;
      },
    ];
    for (const op of ops) await expect(op()).rejects.toBeInstanceOf(HemTlsRequiredError);
    // the guard refuses before any login, too
    expect(d.fetch.calls).toHaveLength(0);
  });
});
