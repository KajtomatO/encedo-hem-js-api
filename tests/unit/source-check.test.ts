// The static source check must be able to fail: each bad sample below is caught,
// and the clean samples are not.
import { describe, expect, it } from 'vitest';
import { checkSource, moduleSpecifiers, stripCommentsAndStrings } from '../support/source-check.js';

const rulesOf = (source: string): string[] => checkSource('sample.ts', source).map((violation) => violation.rule);

describe('static source check', () => {
  // verifies: REQ-BUILD-003
  it.each([
    ["import { readFile } from 'node:fs';", 'node: import'],
    ["export * from 'node:path';", 'node: import'],
    ["const fs = await import('node:fs');", 'node: import'],
    ["import { x } from 'some-package';", 'bare module specifier'],
    ["import type { Y } from '@scope/pkg';", 'bare module specifier'],
    ["export { z } from \"lodash\";", 'bare module specifier'],
    ['const b = Buffer.from(bytes);', 'Buffer'],
    ['const v = process.versions.node;', 'process'],
    ['const v = globalThis.process.env;', 'process'],
    ["const m = require('./x.js');", 'require'],
    ['const d = __dirname;', '__dirname/__filename'],
    ['const g = global.fetch;', 'Node or other runtime global'],
    ['const k = await crypto.subtle.digest(a, b);', 'crypto not through globalThis'],
    ['const r = self.crypto.getRandomValues(a);', 'crypto not through globalThis'],
    ['const r = window.crypto.subtle;', 'crypto not through globalThis'],
    ['const x = new XMLHttpRequest();', 'networking other than fetch'],
    ["const s = new WebSocket('wss://hem.test');", 'networking other than fetch'],
    ['navigator.sendBeacon(url, body);', 'networking other than fetch'],
  ])('flags %s', (source, rule) => {
    expect(rulesOf(source)).toContain(rule);
  });

  // verifies: REQ-API-009
  it.each([
    ['console.log(token);', 'console'],
    ['globalThis.console.error(e);', 'console'],
    ["localStorage.setItem('t', token);", 'web storage'],
    ["window.sessionStorage.getItem('t');", 'web storage'],
    ["const db = indexedDB.open('hem');", 'IndexedDB'],
    ["await caches.open('hem');", 'cache or cookie storage'],
    ['document.cookie = token;', 'cache or cookie storage'],
    ['await navigator.storage.getDirectory();', 'file system'],
    ['await showSaveFilePicker();', 'file system'],
    ['const pass = process.env.HEM_PASSPHRASE;', 'process'],
    ['const pass = import.meta.env.HEM_PASSPHRASE;', 'environment variables'],
  ])('flags %s', (source, rule) => {
    expect(rulesOf(source)).toContain(rule);
  });

  // verifies: REQ-API-001
  it.each([
    ['let calls = 0;', 'module-level let/var'],
    ['export let cache = new Map();', 'module-level let/var'],
    ['var legacy;', 'module-level let/var'],
    ["const a = 1;\nlet shared: string | undefined;\nfunction f() {\n  let local = 0;\n}", 'module-level let/var'],
  ])('flags module-level state in %j', (source, rule) => {
    const violations = checkSource('sample.ts', source).filter((v) => v.rule === rule);
    expect(violations).toHaveLength(1);
  });

  // verifies: REQ-BUILD-003, REQ-API-009
  it('accepts relative imports, globalThis.crypto, fetch and look-alike names', () => {
    const clean = [
      "import { HemError } from './errors.js';",
      "export { encode } from '../codec/base64.js';",
      "import type { Session } from './auth/session.js';",
      'const key = await globalThis.crypto.subtle.importKey(format, data, algorithm, false, usages);',
      'const response = await this.fetch(url, init);',
      'export class HemClient { readonly crypto: CryptoApi; constructor() { this.crypto = makeCrypto(); } }',
      'const options = { crypto: undefined, timeoutMs: 1 };',
      'const processed = processResponse(bufferedBody, requirement);',
      "// console.log, process.env and require('x') in a comment",
      '/* Buffer.from(x) in a block comment */',
      "const message = 'console.log(token) and node:fs in a string';",
      'const text = `process ${count} items from localStorage`;',
      'const pattern = /console|process/g;',
      'const TABLE = Object.freeze([1, 2, 3]);',
      'function count(items: number[]): number {',
      '  let total = 0;',
      '  for (const item of items) total += item;',
      '  return total;',
      '}',
      '// let comment = 1;',
      "const letter = 'let x';",
    ].join('\n');
    expect(checkSource('clean.ts', clean)).toEqual([]);
  });

  // verifies: REQ-BUILD-003, REQ-API-009
  it('still checks code inside template-literal substitutions', () => {
    expect(rulesOf('const t = `a ${console.log(x)} b`;')).toEqual(['console']);
    expect(rulesOf('const t = `a ${`nested ${process.pid}`} b`;')).toEqual(['process']);
  });

  // verifies: REQ-BUILD-003, REQ-API-009
  it('reports file and line of each violation', () => {
    const violations = checkSource('src/x.ts', "const a = 1;\nimport x from 'pkg';\nconsole.log(a);\n");
    expect(violations).toEqual([
      { file: 'src/x.ts', line: 2, rule: 'bare module specifier', text: "import x from 'pkg';" },
      { file: 'src/x.ts', line: 3, rule: 'console', text: 'console.log(a);' },
    ]);
  });

  it('keeps offsets and line breaks when blanking comments and strings', () => {
    const source = "a('x') // c\n/* d\n e */ b";
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).toHaveLength(source.length);
    expect(stripped.split('\n')).toHaveLength(3);
    expect(moduleSpecifiers("import a from './a.js'; // import b from 'b'\nexport * from \"../c.js\";").map((s) => s.specifier)).toEqual([
      './a.js',
      '../c.js',
    ]);
  });
});
