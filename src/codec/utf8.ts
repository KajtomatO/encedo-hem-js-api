/** UTF-8 conversion between strings and byte arrays. */

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/** UTF-8 bytes of a string. */
export function utf8Encode(text: string): Uint8Array {
  return encoder.encode(text);
}

/** Decode UTF-8 bytes; throws a `TypeError` on malformed input. */
export function utf8Decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Number of bytes the string occupies as UTF-8. */
export function utf8Length(text: string): number {
  return encoder.encode(text).length;
}
