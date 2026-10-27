import { describe, expect, it } from 'vitest';
import {
  validateBodySize,
  validateDescription,
  validateKid,
  validateLabel,
  validateMessage,
} from '../../src/codec/validate.js';
import { HemValidationError } from '../../src/errors.js';

function validationError(run: () => unknown): HemValidationError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(HemValidationError);
    return error as HemValidationError;
  }
  throw new Error('expected a HemValidationError');
}

const bytes = (length: number): Uint8Array => new Uint8Array(length).fill(0x41);

describe('key id', () => {
  // verifies: REQ-API-005
  it('accepts exactly 32 hex characters and normalises upper case to lower case', () => {
    expect(validateKid('0123456789abcdef0123456789abcdef')).toBe('0123456789abcdef0123456789abcdef');
    expect(validateKid('0123456789ABCDEF0123456789AbCdEf')).toBe('0123456789abcdef0123456789abcdef');
  });

  // verifies: REQ-API-005
  it.each(['', '0123456789abcdef0123456789abcde', '0123456789abcdef0123456789abcdef0', '0123456789abcdef0123456789abcdeg', ' 0123456789abcdef0123456789abcde', 42, undefined])(
    'rejects %j naming the parameter',
    (kid) => {
      const error = validationError(() => validateKid(kid));
      expect(error.parameter).toBe('kid');
      expect(error.message).toContain('kid');
    },
  );

  it('names a custom parameter', () => {
    expect(validationError(() => validateKid('x', 'sourceKid')).parameter).toBe('sourceKid');
  });
});

describe('label', () => {
  // verifies: REQ-API-005
  it('accepts 1 to 32 printable ASCII characters, unchanged', () => {
    expect(validateLabel('a')).toBe('a');
    const longest = ' !"#$%&\'()*+,-./0123456789:;<=>?'.slice(0, 32);
    expect(longest).toHaveLength(32);
    expect(validateLabel(longest)).toBe(longest);
    expect(validateLabel('~ root key ~')).toBe('~ root key ~');
  });

  // verifies: REQ-API-005
  it.each(['', 'x'.repeat(33), 'tab\there', 'line\nbreak', 'zażółć', 'del\x7f', 7])('rejects %j naming the parameter', (label) => {
    const error = validationError(() => validateLabel(label));
    expect(error.parameter).toBe('label');
  });
});

describe('description', () => {
  // verifies: REQ-API-005
  it('accepts up to 64 bytes, unchanged, and rejects 65', () => {
    const exact = bytes(64);
    expect(validateDescription(exact)).toBe(exact);
    expect(validateDescription(new Uint8Array())).toEqual(new Uint8Array());
    expect(validationError(() => validateDescription(bytes(65))).parameter).toBe('descr');
  });

  // verifies: REQ-API-005
  it('rejects a value that is not a Uint8Array', () => {
    expect(validationError(() => validateDescription('text')).parameter).toBe('descr');
  });
});

describe('message', () => {
  // verifies: REQ-API-005
  it('accepts up to 2048 bytes, unchanged, and rejects 2049', () => {
    const exact = bytes(2048);
    expect(validateMessage(exact)).toBe(exact);
    expect(validationError(() => validateMessage(bytes(2049))).parameter).toBe('msg');
  });

  // verifies: REQ-API-005
  it('rejects an empty message where one is required, and allows it where the operation permits', () => {
    expect(validationError(() => validateMessage(new Uint8Array())).message).toMatch(/msg.*empty/);
    expect(validateMessage(new Uint8Array(), 'msg', { allowEmpty: true })).toEqual(new Uint8Array());
  });

  it('rejects a value that is not a Uint8Array', () => {
    expect(validationError(() => validateMessage([1, 2, 3], 'data')).parameter).toBe('data');
  });
});

describe('body size', () => {
  // verifies: REQ-API-005
  it('accepts a 7300-byte body and rejects 7301 bytes, counting UTF-8 bytes', () => {
    const exact = `{"a":"${'x'.repeat(7300 - 8)}"}`;
    expect(exact).toHaveLength(7300);
    expect(validateBodySize(exact)).toBe(exact);
    const over = `{"a":"${'x'.repeat(7300 - 7)}"}`;
    expect(validationError(() => validateBodySize(over)).parameter).toBe('body');
    // 3650 two-byte characters are 7300 bytes; one more ASCII byte is over.
    expect(validateBodySize('é'.repeat(3650))).toHaveLength(3650);
    expect(validationError(() => validateBodySize(`${'é'.repeat(3650)}x`)).message).toContain('7301 bytes');
  });
});

describe('validation errors', () => {
  // verifies: REQ-API-005
  it('do not echo the offending value', () => {
    const secret = 'S3CRET-PLAINTEXT';
    const error = validationError(() => validateLabel(`${secret}\n`));
    expect(error.message).not.toContain(secret);
    expect(JSON.stringify(error)).not.toContain(secret);
  });
});
