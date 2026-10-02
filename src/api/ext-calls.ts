// Device calls of mobile approval: POST /api/auth/ext/request and /ext/token.
// Neither carries a token.
// implements: REQ-AUTH-014, REQ-AUTH-015, REQ-AUTH-012

import { decodeBase64 } from "../codec/base64.js";
import { validateStringLength } from "../codec/validate.js";
import { HemForbiddenError, HemValidationError } from "../errors.js";
import { makeEntry, nowSeconds, type TokenEntry } from "../auth/session.js";
import { callOptions, sendPublic, type ClientContext } from "../internal/context.js";
import { parseObject, reqString } from "../internal/parse.js";
import type { CallOptions } from "../transport/transport.js";

/** Expiry assumed for an approved token whose `exp` cannot be read: 15 minutes [C-SDK]. */
export const APPROVED_TOKEN_FALLBACK_SECONDS = 900;

export interface ExtRequestParams {
  /** The relay's key: standard base64 of a 32-byte X25519 public key. */
  epk: string;
  /** Scope to request, at most 1023 characters. */
  scope: string;
  /** Context copied into the request, 1 to 64 characters. */
  ctx?: string | undefined;
  /** Note shown on the phone, 1 to 128 characters. */
  note?: string | undefined;
}

/** The device's authorization request; both strings are opaque. */
export interface ExtRequestResult {
  readonly authreq: string;
  readonly epk: string;
}

export function validateExtRequest(p: ExtRequestParams): Record<string, string> {
  if (p === null || typeof p !== "object") throw new HemValidationError("params", "required");
  let epk: Uint8Array;
  try {
    epk = typeof p.epk === "string" ? decodeBase64(p.epk) : new Uint8Array();
  } catch {
    epk = new Uint8Array();
  }
  if (epk.length !== 32) throw new HemValidationError("epk", "must be base64 of a 32-byte public key");
  const body: Record<string, string> = { epk: p.epk, scope: validateStringLength(p.scope, "scope", 1, 1023) };
  if (p.ctx !== undefined) body["ctx"] = validateStringLength(p.ctx, "ctx", 1, 64);
  if (p.note !== undefined) body["note"] = validateStringLength(p.note, "note", 1, 128);
  return body;
}

/**
 * `POST /api/auth/ext/request`. A 403 (device clock not set) runs the
 * session's single recovery check-in and repeats the request once.
 */
export async function extRequest(ctx: ClientContext, params: ExtRequestParams, options?: CallOptions): Promise<ExtRequestResult> {
  const operation = "auth.extRequest";
  const body = validateExtRequest(params);
  const send = async () => {
    const res = await sendPublic(ctx, { operation, method: "POST", path: "/api/auth/ext/request", body, ...callOptions(options) });
    const o = parseObject(res, operation);
    return { authreq: reqString(o, "authreq", operation), epk: reqString(o, "epk", operation) };
  };
  try {
    return await send();
  } catch (e) {
    if (!(e instanceof HemForbiddenError)) throw e;
    await ctx.session.recoverClock(e, callOptions(options));
    return send();
  }
}

/** `POST /api/auth/ext/token`; caches the token under `scope` with the expiry from its `exp`. */
export async function extToken(
  ctx: ClientContext,
  params: { authreply: string; scope: string },
  options?: CallOptions,
): Promise<TokenEntry> {
  const operation = "auth.extToken";
  if (typeof params?.authreply !== "string" || params.authreply === "") {
    throw new HemValidationError("authreply", "must be a non-empty string");
  }
  const scope = validateStringLength(params.scope, "scope", 1, 1023);
  const res = await sendPublic(ctx, {
    operation,
    method: "POST",
    path: "/api/auth/ext/token",
    body: { authreply: params.authreply },
    ...callOptions(options),
  });
  const token = reqString(parseObject(res, operation), "token", operation);
  const entry = makeEntry(token, scope, nowSeconds() + APPROVED_TOKEN_FALLBACK_SECONDS);
  ctx.session.store(entry);
  return entry;
}
