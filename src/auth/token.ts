// Reading the claims of an issued bearer token (never verifying it).
// implements: REQ-AUTH-010

import { decodeBase64 } from "../codec/base64.js";
import { utf8Decode } from "../codec/utf8.js";

/** The role the device granted, from the token's `sub` claim. */
export type HemRole =
  | { readonly kind: "user" }
  | { readonly kind: "master" }
  | { readonly kind: "app"; readonly id: string };

export interface TokenClaims {
  exp?: number;
  iat?: number;
  sub?: string;
  scope?: string;
}

/** Decodes the payload of a compact JWT; `undefined` when it is not decodable. */
export function decodeJwtClaims(token: string): TokenClaims | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(utf8Decode(decodeBase64(parts[1]!))) as unknown;
    if (payload === null || typeof payload !== "object") return undefined;
    const p = payload as Record<string, unknown>;
    const out: TokenClaims = {};
    if (typeof p["exp"] === "number") out.exp = p["exp"];
    if (typeof p["iat"] === "number") out.iat = p["iat"];
    if (typeof p["sub"] === "string") out.sub = p["sub"];
    if (typeof p["scope"] === "string") out.scope = p["scope"];
    return out;
  } catch {
    return undefined;
  }
}

/** `U` → user, `M` → master, anything else → a paired app with that id. */
export function roleFromSub(sub: string | undefined): HemRole | undefined {
  if (sub === undefined) return undefined;
  if (sub === "U") return { kind: "user" };
  if (sub === "M") return { kind: "master" };
  return { kind: "app", id: sub };
}
