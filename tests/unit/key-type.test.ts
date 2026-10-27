import { describe, expect, it } from 'vitest';
import { KEY_ALGORITHMS, KEY_FLAGS, KEY_TYPES, parseKeyType } from '../../src/api/key-type.js';

describe('key type parsing', () => {
  // verifies: REQ-KEY-005
  it('splits a list-style type into flags and algorithm', () => {
    expect(parseKeyType('PKEY,ECDH,ExDSA,SECP256R1')).toEqual({
      raw: 'PKEY,ECDH,ExDSA,SECP256R1',
      flags: ['PKEY', 'ECDH', 'ExDSA'],
      algorithm: 'SECP256R1',
      unknown: [],
    });
    expect(parseKeyType('ATT,PKEY,CERT,PQC,MLDSA65').flags).toEqual(['ATT', 'PKEY', 'CERT', 'PQC']);
  });

  // verifies: REQ-KEY-005
  it('recognises all six flags and every algorithm name of the reference', () => {
    expect([...KEY_FLAGS]).toEqual(['ATT', 'PKEY', 'ECDH', 'ExDSA', 'CERT', 'PQC']);
    expect(parseKeyType(KEY_FLAGS.join(',') + ',AES256')).toMatchObject({ flags: [...KEY_FLAGS], algorithm: 'AES256', unknown: [] });
    const reference = [
      'GENERIC_DER', 'SECP256R1', 'SECP384R1', 'SECP521R1', 'SECP256K1', 'CURVE25519', 'CURVE448', 'ED25519', 'ED448',
      'MLKEM512', 'MLKEM768', 'MLKEM1024', 'MLDSA44', 'MLDSA65', 'MLDSA87', 'SHA2-256', 'SHA2-384', 'SHA2-512',
      'SHA3-256', 'SHA3-384', 'SHA3-512', 'AES128', 'AES192', 'AES256', 'DER_PKEY',
    ];
    expect([...KEY_ALGORITHMS].sort()).toEqual([...reference].sort());
    for (const algorithm of reference) {
      expect(parseKeyType(`PKEY,${algorithm}`), algorithm).toMatchObject({ flags: ['PKEY'], algorithm, unknown: [] });
    }
    expect(KEY_TYPES).toHaveLength(23);
  });

  // verifies: REQ-KEY-005
  it.each(['SECP256R1', 'CURVE25519', 'ED25519', 'MLKEM768', 'AES256'])('parses the bare name %s (key get) with no flags', (name) => {
    expect(parseKeyType(name)).toEqual({ raw: name, flags: [], algorithm: name, unknown: [] });
  });

  // verifies: REQ-KEY-005
  it('keeps unknown tokens without raising, and the raw string', () => {
    const parsed = parseKeyType('PKEY,NEWFLAG,FALCON512');
    expect(parsed).toEqual({ raw: 'PKEY,NEWFLAG,FALCON512', flags: ['PKEY'], algorithm: 'FALCON512', unknown: ['NEWFLAG', 'FALCON512'] });
    expect(parseKeyType('')).toEqual({ raw: '', flags: [], algorithm: undefined, unknown: [] });
    expect(parseKeyType('CERT')).toEqual({ raw: 'CERT', flags: ['CERT'], algorithm: undefined, unknown: [] });
  });
});
