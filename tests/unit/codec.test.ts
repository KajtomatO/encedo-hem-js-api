import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, bytesToBase64Url, bytesToHex, hexToBytes } from '../../src/codec/base64.js';
import { utf8Decode, utf8Encode, utf8Length } from '../../src/codec/utf8.js';
import { HemProtocolError } from '../../src/errors.js';

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));
const allBytes = Uint8Array.from({ length: 256 }, (_, i) => i);
// Reference encoding from the platform's btoa, available in Node and browsers.
const reference = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

// RFC 4648 §10 test vectors.
const rfc4648 = [
  ['', ''],
  ['f', 'Zg=='],
  ['fo', 'Zm8='],
  ['foo', 'Zm9v'],
  ['foob', 'Zm9vYg=='],
  ['fooba', 'Zm9vYmE='],
  ['foobar', 'Zm9vYmFy'],
] as const;

describe('base64', () => {
  // verifies: REQ-API-004
  it.each(rfc4648)('encodes %j as standard base64 with padding (%j)', (input, expected) => {
    expect(bytesToBase64(ascii(input))).toBe(expected);
    expect(base64ToBytes(expected)).toEqual(ascii(input));
  });

  // verifies: REQ-API-004
  it('round-trips the empty input and all 256 byte values, matching the platform reference', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
    expect(base64ToBytes('')).toEqual(new Uint8Array());
    for (let length = 0; length <= 256; length += 1) {
      const bytes = allBytes.slice(256 - length);
      const text = bytesToBase64(bytes);
      expect(text).toBe(reference(bytes));
      expect(base64ToBytes(text)).toEqual(bytes);
    }
  });

  // verifies: REQ-API-004
  it('decodes the URL-safe alphabet and unpadded input', () => {
    const bytes = Uint8Array.from([0xfb, 0xff, 0xbf, 0xfe]);
    expect(bytesToBase64(bytes)).toBe('+/+//g==');
    for (const text of ['+/+//g==', '+/+//g', '-_-__g==', '-_-__g', '+_-//g']) {
      expect(base64ToBytes(text), text).toEqual(bytes);
    }
  });

  // verifies: REQ-API-004
  it('rejects malformed input with HemProtocolError', () => {
    for (const text of ['A', 'AAAAA', 'AA=A', 'A===', 'AA AA', 'AA\nAA', 'Zg=', '€AAA', 'Zm9v!']) {
      expect(() => base64ToBytes(text), JSON.stringify(text)).toThrow(HemProtocolError);
    }
  });
});

describe('base64url', () => {
  // verifies: REQ-API-004
  it('encodes without padding in the URL-safe alphabet and round-trips all byte values', () => {
    expect(bytesToBase64Url(ascii('f'))).toBe('Zg');
    expect(bytesToBase64Url(ascii('fo'))).toBe('Zm8');
    expect(bytesToBase64Url(Uint8Array.from([0xfb, 0xff, 0xbf, 0xfe]))).toBe('-_-__g');
    expect(bytesToBase64Url(new Uint8Array())).toBe('');
    for (let length = 0; length <= 256; length += 1) {
      const bytes = allBytes.slice(0, length);
      const text = bytesToBase64Url(bytes);
      expect(text).toBe(reference(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
      expect(base64ToBytes(text)).toEqual(bytes);
    }
  });
});

describe('hex', () => {
  // verifies: REQ-API-004
  it('encodes lowercase and round-trips the empty input and all 256 byte values', () => {
    expect(bytesToHex(new Uint8Array())).toBe('');
    expect(hexToBytes('')).toEqual(new Uint8Array());
    const hex = bytesToHex(allBytes);
    expect(hex).toBe(Array.from(allBytes, (b) => b.toString(16).padStart(2, '0')).join(''));
    expect(hex).toMatch(/^[0-9a-f]{512}$/);
    expect(hexToBytes(hex)).toEqual(allBytes);
    expect(hexToBytes(hex.toUpperCase())).toEqual(allBytes);
  });

  it('rejects malformed hex', () => {
    for (const text of ['0', 'abc', 'zz', '0x00', ' 00']) expect(() => hexToBytes(text)).toThrow(HemProtocolError);
  });
});

describe('UTF-8', () => {
  it('encodes, decodes and measures text', () => {
    const text = 'zażółć €𝄞';
    const bytes = utf8Encode(text);
    expect(bytes).toEqual(Uint8Array.from([0x7a, 0x61, 0xc5, 0xbc, 0xc3, 0xb3, 0xc5, 0x82, 0xc4, 0x87, 0x20, 0xe2, 0x82, 0xac, 0xf0, 0x9d, 0x84, 0x9e]));
    expect(utf8Decode(bytes)).toBe(text);
    expect(utf8Length(text)).toBe(18);
    expect(utf8Length('')).toBe(0);
  });

  it('refuses malformed UTF-8 instead of replacing it', () => {
    expect(() => utf8Decode(Uint8Array.from([0xc3, 0x28]))).toThrow(TypeError);
  });
});
