// Byte <-> base64 / base64url conversion without platform-specific APIs.
// implements: REQ-API-004

const STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const URL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const DECODE = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) {
  DECODE[STD.charCodeAt(i)] = i;
  DECODE[URL_SAFE.charCodeAt(i)] = i;
}

function encode(bytes: Uint8Array, alphabet: string, pad: boolean): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += alphabet[n >>> 18]! + alphabet[(n >>> 12) & 63]! + alphabet[(n >>> 6) & 63]! + alphabet[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += alphabet[n >>> 18]! + alphabet[(n >>> 12) & 63]! + (pad ? "==" : "");
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += alphabet[n >>> 18]! + alphabet[(n >>> 12) & 63]! + alphabet[(n >>> 6) & 63]! + (pad ? "=" : "");
  }
  return out;
}

/** Standard base64 with padding — the form sent to the device. */
export function encodeBase64(bytes: Uint8Array): string {
  return encode(bytes, STD, true);
}

/** base64url without padding — the form used inside JWTs. */
export function encodeBase64Url(bytes: Uint8Array): string {
  return encode(bytes, URL_SAFE, false);
}

/**
 * Decodes standard or URL-safe base64, with or without padding.
 * Throws `RangeError` for any other input.
 */
export function decodeBase64(text: string): Uint8Array {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 61 /* = */) end--;
  const padding = text.length - end;
  if (padding > 2 || (padding > 0 && text.length % 4 !== 0)) throw new RangeError("invalid base64 padding");
  if (end % 4 === 1) throw new RangeError("invalid base64 length");
  const out = new Uint8Array(Math.floor((end * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < end; i++) {
    const c = text.charCodeAt(i);
    const v = c < 128 ? DECODE[c]! : -1;
    if (v < 0) throw new RangeError("invalid base64 character");
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >>> bits) & 0xff;
    }
  }
  return out;
}
