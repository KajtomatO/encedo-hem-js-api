/**
 * Base64, base64url and hexadecimal conversion of byte arrays, in plain
 * JavaScript so that Node and browsers behave identically.
 *
 * @packageDocumentation
 */
import { HemProtocolError } from '../errors.js';

const STANDARD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Decoding table accepting both alphabets; -1 marks an invalid character.
const DECODE = new Int8Array(128).fill(-1);
for (let i = 0; i < 64; i += 1) {
  DECODE[STANDARD.charCodeAt(i)] = i;
  DECODE[URL_SAFE.charCodeAt(i)] = i;
}

function encode(bytes: Uint8Array, alphabet: string, pad: boolean): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8) | (bytes[i + 2] as number);
    out += alphabet.charAt(n >> 18) + alphabet.charAt((n >> 12) & 63) + alphabet.charAt((n >> 6) & 63) + alphabet.charAt(n & 63);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] as number) << 16;
    out += alphabet.charAt(n >> 18) + alphabet.charAt((n >> 12) & 63) + (pad ? '==' : '');
  } else if (rest === 2) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8);
    out += alphabet.charAt(n >> 18) + alphabet.charAt((n >> 12) & 63) + alphabet.charAt((n >> 6) & 63) + (pad ? '=' : '');
  }
  return out;
}

/** Standard base64 with padding — the form sent to the device. */
// implements: REQ-API-004
export function bytesToBase64(bytes: Uint8Array): string {
  return encode(bytes, STANDARD, true);
}

/** Base64url without padding (as used in JWT segments). */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return encode(bytes, URL_SAFE, false);
}

/**
 * Decode base64 received from the device. Accepts the standard and the
 * URL-safe alphabet, with or without padding.
 *
 * @throws HemProtocolError when the text is not valid base64.
 */
// implements: REQ-API-004
export function base64ToBytes(text: string, what = 'base64 value'): Uint8Array {
  let end = text.length;
  if (end % 4 === 0 && text.endsWith('==')) end -= 2;
  else if (end % 4 === 0 && text.endsWith('=')) end -= 1;
  if (end % 4 === 1) throw new HemProtocolError(`Invalid ${what}: bad length`);
  const out = new Uint8Array(Math.floor((end * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < end; i += 1) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? (DECODE[code] as number) : -1;
    if (value < 0) throw new HemProtocolError(`Invalid ${what}: unexpected character at position ${i}`);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o] = (buffer >> bits) & 0xff;
      o += 1;
    }
  }
  return out;
}

const HEX = '0123456789abcdef';

/** Lowercase hexadecimal. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += (HEX[byte >> 4] as string) + (HEX[byte & 15] as string);
  return out;
}

/**
 * Decode hexadecimal (either case).
 *
 * @throws HemProtocolError when the text is not valid hexadecimal.
 */
export function hexToBytes(text: string, what = 'hex value'): Uint8Array {
  if (text.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(text)) throw new HemProtocolError(`Invalid ${what}`);
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}
