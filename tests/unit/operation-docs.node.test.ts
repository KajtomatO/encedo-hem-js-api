// Every public operation's documentation states its token scope and milestone,
// and the comments reach the emitted type declarations.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_OPERATIONS } from '../../src/api/operations.js';
import { type DocumentedMethod, docProblems, documentedMethods } from '../support/doc-check.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = join(root, 'dist');

function declarationFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? declarationFiles(path) : path.endsWith('.d.ts') ? [path] : [];
  });
}

const methods: DocumentedMethod[] = existsSync(dist)
  ? declarationFiles(dist).flatMap((file) => documentedMethods(readFileSync(file, 'utf8')))
  : [];
const namespaceClass: Record<string, string> = { system: 'SystemApi', keys: 'KeysApi', crypto: 'CryptoApi', auth: 'AuthApi' };

describe('operation documentation in the emitted declarations', () => {
  // verifies: REQ-API-007
  it('covers the public namespaces', () => {
    expect(existsSync(dist), 'run `npm run build` first').toBe(true);
    expect(new Set(methods.map((m) => m.className))).toEqual(new Set(Object.values(namespaceClass)));
    expect(methods.length).toBeGreaterThan(15);
  });

  // verifies: REQ-API-007
  it('states the token scope and the milestone for every public operation', () => {
    const problems = methods.flatMap((m) => docProblems(m.doc).map((problem) => `${m.className}.${m.method}: ${problem}`));
    expect(problems).toEqual([]);
  });

  // verifies: REQ-API-007
  it('states the scope of each bound device operation as its description declares it, and "none" for public ones', () => {
    const checked: string[] = [];
    for (const spec of ALL_OPERATIONS) {
      const [namespace, method] = spec.name.split('.') as [string, string];
      const documented = methods.find((m) => m.className === namespaceClass[namespace] && m.method === method);
      if (!documented) continue; // internal device calls (the login challenge and proof) have no public method
      const expected = spec.scope === null ? 'Token scope: none' : `Token scope: \`${spec.scope.replace('{kid}', '<kid>')}\``;
      expect(documented.doc, spec.name).toContain(expected);
      checked.push(spec.name);
    }
    expect(checked.length).toBeGreaterThanOrEqual(ALL_OPERATIONS.length - 4);
  });
});
