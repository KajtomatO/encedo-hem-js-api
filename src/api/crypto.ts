// Bindings of the crypto group (stored-key modes).
// implements: REQ-OPS-001, REQ-OPS-002, REQ-OPS-003, REQ-API-005, REQ-NET-003, REQ-AUTH-005

import { encodeBase64 } from "../codec/base64.js";
import { MAX_MESSAGE_BYTES, validateBytes, validateKid, validateMessage, validateOneOf } from "../codec/validate.js";
import { HemValidationError } from "../errors.js";
import { callOptions, type ClientContext } from "../internal/context.js";
import { parseObject, reqBytes } from "../internal/parse.js";
import type { CallOptions } from "../transport/transport.js";

/** KEK sizes for wrap and unwrap. */
export const WRAP_ALGORITHMS = ["AES128", "AES192", "AES256"] as const;
export type WrapAlgorithm = (typeof WRAP_ALGORITHMS)[number];

export interface HmacParams {
  /** Stored HMAC key (`SHA2-*` or `SHA3-*`); its type decides the hash. */
  kid: string;
  /** 1 to 2048 bytes. */
  message: Uint8Array;
}

export interface WrapParams {
  /** Stored AES key used as the KEK. */
  kid: string;
  /** Key material: a multiple of 8 bytes, 16 to 2048 bytes. */
  data: Uint8Array;
  /** KEK size; the device default is `AES256`. */
  alg?: WrapAlgorithm | undefined;
  /** Alternative RFC 3394 initial value, exactly 8 bytes. */
  iv?: Uint8Array | undefined;
}

export interface UnwrapParams {
  /** Stored AES key used as the KEK. */
  kid: string;
  /** Wrapped blob: a non-empty multiple of 8 bytes. */
  data: Uint8Array;
  /** KEK size; the device default is `AES256`. */
  alg?: WrapAlgorithm | undefined;
  /** The initial value used when wrapping, exactly 8 bytes. */
  iv?: Uint8Array | undefined;
}

/** `client.crypto`: cryptographic operations with stored keys. Every operation requires an `https:` device URL. */
export interface CryptoApi {
  /**
   * Computes an HMAC with a stored key (`POST /api/crypto/hmac/hash`). The
   * hash is fixed by the key's type; no algorithm is sent. A missing key or
   * a key of the wrong type raises `HemOperationFailedError` (406).
   *
   * @scope keymgmt:use:<kid>
   * @milestone M1
   */
  hmac(params: HmacParams, options?: CallOptions): Promise<Uint8Array>;

  /**
   * Wraps key material with a stored AES key, RFC 3394
   * (`POST /api/crypto/cipher/wrap`). The result is 8 bytes longer than the
   * input.
   *
   * @scope keymgmt:use:<kid>
   * @milestone M1
   */
  wrap(params: WrapParams, options?: CallOptions): Promise<Uint8Array>;

  /**
   * Unwraps key material with a stored AES key, RFC 3394
   * (`POST /api/crypto/cipher/unwrap`). An integrity failure or a wrong key
   * raises `HemOperationFailedError` (406).
   *
   * @scope keymgmt:use:<kid>
   * @milestone M1
   */
  unwrap(params: UnwrapParams, options?: CallOptions): Promise<Uint8Array>;
}

function wrapBody(p: WrapParams | UnwrapParams, kid: string, data: Uint8Array): Record<string, string> {
  const body: Record<string, string> = { kid, msg: encodeBase64(data) };
  if (p.alg !== undefined) body["alg"] = validateOneOf(p.alg, "alg", WRAP_ALGORITHMS);
  if (p.iv !== undefined) {
    const iv = validateBytes(p.iv, "iv");
    if (iv.length !== 8) throw new HemValidationError("iv", "must be exactly 8 bytes");
    body["iv"] = encodeBase64(iv);
  }
  return body;
}

export class CryptoApiImpl implements CryptoApi {
  readonly #ctx: ClientContext;
  constructor(ctx: ClientContext) {
    this.#ctx = ctx;
  }

  async #post(operation: string, path: string, kid: string, body: Record<string, string>, field: string, options?: CallOptions) {
    const res = await this.#ctx.session.authorized(
      { operation, method: "POST", path, body, requiresTls: true, ...callOptions(options) },
      `keymgmt:use:${kid}`,
    );
    return reqBytes(parseObject(res, operation), field, operation);
  }

  hmac(params: HmacParams, options?: CallOptions): Promise<Uint8Array> {
    return Promise.resolve().then(() => {
      const kid = validateKid(params?.kid);
      const msg = validateMessage(params.message, "message");
      return this.#post("crypto.hmac", "/api/crypto/hmac/hash", kid, { kid, msg: encodeBase64(msg) }, "mac", options);
    });
  }

  wrap(params: WrapParams, options?: CallOptions): Promise<Uint8Array> {
    return Promise.resolve().then(() => {
      const kid = validateKid(params?.kid);
      const data = validateBytes(params.data, "data");
      if (data.length % 8 !== 0 || data.length < 16 || data.length > MAX_MESSAGE_BYTES) {
        throw new HemValidationError("data", `must be a multiple of 8 bytes, 16 to ${MAX_MESSAGE_BYTES} bytes`);
      }
      return this.#post("crypto.wrap", "/api/crypto/cipher/wrap", kid, wrapBody(params, kid, data), "wrapped", options);
    });
  }

  unwrap(params: UnwrapParams, options?: CallOptions): Promise<Uint8Array> {
    return Promise.resolve().then(() => {
      const kid = validateKid(params?.kid);
      const data = validateBytes(params.data, "data");
      if (data.length === 0 || data.length % 8 !== 0) {
        throw new HemValidationError("data", "must be a non-empty multiple of 8 bytes");
      }
      return this.#post("crypto.unwrap", "/api/crypto/cipher/unwrap", kid, wrapBody(params, kid, data), "unwrapped", options);
    });
  }
}
