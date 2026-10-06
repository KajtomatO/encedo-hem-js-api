// No device operation has a parameter for passing a token: checked on the committed public surface.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSurface } from '../support/surface.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const surface = parseSurface(readFileSync(join(root, 'tests/surface/public-api.txt'), 'utf8'));

describe('public surface', () => {
  // verifies: REQ-AUTH-005
  it('has no token, bearer or scope parameter on any operation of the client namespaces', () => {
    const methods = [...surface].filter(([key]) => /^(SystemApi|KeysApi|CryptoApi)\./.test(key));
    expect(methods.length).toBeGreaterThan(10);
    for (const [key, signature] of methods) {
      const params = signature.slice(signature.indexOf('('), signature.lastIndexOf(')') + 1);
      expect(params, key).not.toMatch(/\b(token|bearer|authorization|scope)\??:/i);
    }
  });

  // verifies: REQ-AUTH-005
  it('has no token field in any parameter or option type', () => {
    const fields = [...surface].filter(([key]) => /^(\w+(Params|Options)|CallOptions)\.\w+$/.test(key));
    expect(fields.length).toBeGreaterThan(10);
    for (const [key] of fields) expect(key, key).not.toMatch(/\.(token|bearer|authorization)$/i);
  });
});
