// supports: REQ-TEST-001, REQ-AUTH-001
// A scripted stand-in for the device behind a fake fetch. It answers the
// login with tokens whose claims echo the proof, and routes every other
// request to per-endpoint handlers (one-shot replies first, then defaults).
import { encodeBase64Url, decodeBase64, utf8Encode, utf8Decode } from "../../src/codec/index.js";
import { createFakeFetch, emptyResponse, jsonResponse, type FakeFetch, type RecordedRequest } from "./fake-fetch.js";
import { LOGIN_VECTOR } from "./vectors.js";

export type Handler = (req: RecordedRequest) => Response | Promise<Response>;

/** An unsigned JWT-shaped token carrying the given claims. */
export function makeJwt(claims: Record<string, unknown>): string {
  const enc = (o: unknown) => encodeBase64Url(utf8Encode(JSON.stringify(o)));
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(claims)}.c2ln`;
}

/** Decodes the claims of a JWT-shaped string. */
export function jwtClaims(token: string): Record<string, unknown> {
  return JSON.parse(utf8Decode(decodeBase64(token.split(".")[1]!))) as Record<string, unknown>;
}

export interface FakeDevice {
  fetch: FakeFetch;
  /** Queue one-shot replies for `"METHOD /path"`. */
  once(route: string, ...replies: (Response | Handler)[]): FakeDevice;
  /** Default handler for `"METHOD /path"` (or a path prefix ending in `*`). */
  on(route: string, handler: Handler): FakeDevice;
  /** Every request as `"METHOD /path"`. */
  log(): string[];
  /** Tokens issued so far. */
  issued: string[];
  /** The `sub` claim of issued tokens. */
  sub: string;
  /** Challenge fields served by default (exp is device-now + 60 unless set). */
  challenge: { eid: string; spk: string; jti: string; lbl: string; exp?: number };
}

export const nowSec = () => Math.floor(Date.now() / 1000);

export function fakeDevice(base = "https://my.ence.do"): FakeDevice {
  const once = new Map<string, (Response | Handler)[]>();
  const handlers = new Map<string, Handler>();
  const device: FakeDevice = {
    fetch: createFakeFetch(),
    issued: [],
    sub: "U",
    challenge: { eid: LOGIN_VECTOR.eid, spk: LOGIN_VECTOR.spk, jti: LOGIN_VECTOR.jti, lbl: "user" },
    once(route, ...replies) {
      once.set(route, [...(once.get(route) ?? []), ...replies]);
      return device;
    },
    on(route, handler) {
      handlers.set(route, handler);
      return device;
    },
    log() {
      return device.fetch.calls.map((c) => `${c.method} ${c.url.slice(base.length)}`);
    },
  };
  handlers.set("GET /api/auth/token", () =>
    jsonResponse(200, { exp: nowSec() + 60, ...device.challenge }),
  );
  handlers.set("POST /api/auth/token", (req) => {
    const proof = (req.json as { auth: string }).auth;
    const c = jwtClaims(proof);
    const token = makeJwt({ jti: `t${device.issued.length}`, sub: device.sub, scope: c["scope"], iat: c["iat"], exp: c["exp"] });
    device.issued.push(token);
    return jsonResponse(200, { token });
  });
  device.fetch.fallback(async (req) => {
    const path = req.url.slice(base.length);
    const route = `${req.method} ${path}`;
    const queued = once.get(route);
    if (queued && queued.length > 0) {
      const next = queued.shift()!;
      return typeof next === "function" ? next(req) : next;
    }
    const h =
      handlers.get(route) ??
      [...handlers.entries()].find(([k]) => k.endsWith("*") && route.startsWith(k.slice(0, -1)))?.[1];
    if (h) return h(req);
    return emptyResponse(404);
  });
  return device;
}
