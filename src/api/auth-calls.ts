// Device calls of the login: GET and POST /api/auth/token. Neither carries a token.
// implements: REQ-AUTH-001, REQ-AUTH-012

import { callOptions, sendPublic, type ClientContext } from "../internal/context.js";
import { optNumber, optString, parseObject, reqString } from "../internal/parse.js";
import type { CallOptions } from "../transport/transport.js";

/** The login challenge returned by `GET /api/auth/token`. */
export interface LoginChallenge {
  /** Device identity, used verbatim as the PBKDF2 salt. */
  readonly eid: string;
  /** Per-boot session public key, standard base64 of 32 bytes. */
  readonly spk: string;
  /** Single-use nonce. */
  readonly jti: string;
  /** Deadline for submitting the proof (device time + 60 s), Unix seconds. */
  readonly exp: number | undefined;
  /** Configured user label. */
  readonly lbl: string | undefined;
}

export async function getChallenge(ctx: ClientContext, options: CallOptions = {}): Promise<LoginChallenge> {
  const operation = "auth.getChallenge";
  const res = await sendPublic(ctx, { operation, method: "GET", path: "/api/auth/token", ...callOptions(options) });
  const o = parseObject(res, operation);
  return {
    eid: reqString(o, "eid", operation),
    spk: reqString(o, "spk", operation),
    jti: reqString(o, "jti", operation),
    exp: optNumber(o, "exp", operation),
    lbl: optString(o, "lbl", operation),
  };
}

/** Submits the proof; returns the bearer token. */
export async function postProof(ctx: ClientContext, proof: string, options: CallOptions = {}): Promise<string> {
  const operation = "auth.login";
  const res = await sendPublic(ctx, { operation, method: "POST", path: "/api/auth/token", body: { auth: proof }, ...callOptions(options) });
  return reqString(parseObject(res, operation), "token", operation);
}
