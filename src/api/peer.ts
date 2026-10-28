/**
 * The peer public key of an ECDH-based operation: a key stored on the device
 * or raw public-key bytes.
 *
 * @packageDocumentation
 */
import { bytesToBase64 } from '../codec/base64.js';
import { validateKid } from '../codec/validate.js';
import { HemValidationError } from '../errors.js';

/**
 * A peer public key: either the id of a public key stored on the device
 * (`extKid`, sent as `ext_kid`) or the raw public key (`pubkey`: compressed
 * X9.63 for `SECP*` keys, raw bytes for the others). Exactly one of the two.
 */
export type KeyPeer = { readonly extKid: string; readonly pubkey?: undefined } | { readonly pubkey: Uint8Array; readonly extKid?: undefined };

/** Raw public-key bytes: a non-empty `Uint8Array`; no limit of the library's own beyond the request body limit. */
// implements: REQ-KEY-008
export function validatePubkey(value: unknown, parameter = 'pubkey'): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new HemValidationError(`Invalid ${parameter}: must be a Uint8Array`, { parameter });
  if (value.length === 0) throw new HemValidationError(`Invalid ${parameter}: must not be empty`, { parameter });
  return value;
}

/**
 * Check a peer and return its body fields: `{ ext_kid }` (lower-case key
 * id) or `{ pubkey }` (base64). Both forms, neither, or a malformed value
 * raise {@link HemValidationError} naming `parameter`.
 */
// implements: REQ-KEY-009, REQ-OPS-010, REQ-OPS-015
export function peerFields(peer: unknown, parameter = 'peer'): Readonly<Record<string, string>> {
  if (typeof peer !== 'object' || peer === null) throw new HemValidationError(`Invalid ${parameter}: must be an object with extKid or pubkey`, { parameter });
  const { extKid, pubkey } = peer as { extKid?: unknown; pubkey?: unknown };
  const hasKid = extKid !== undefined;
  const hasPubkey = pubkey !== undefined;
  if (hasKid === hasPubkey) throw new HemValidationError(`Invalid ${parameter}: give exactly one of extKid or pubkey`, { parameter });
  if (hasKid) return { ext_kid: validateKid(extKid, `${parameter}.extKid`) };
  return { pubkey: bytesToBase64(validatePubkey(pubkey, `${parameter}.pubkey`)) };
}
