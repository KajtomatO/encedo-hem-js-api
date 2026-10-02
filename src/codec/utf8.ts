// UTF-8 conversion through the encoders both runtimes provide.

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

/** The UTF-8 bytes of a string, without Unicode normalisation. */
export function utf8Encode(text: string): Uint8Array {
  return encoder.encode(text);
}

/** Decodes UTF-8; throws `TypeError` for malformed input. */
export function utf8Decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Constant-shape byte comparison. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
