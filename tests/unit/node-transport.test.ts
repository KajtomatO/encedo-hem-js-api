// What both runtimes can check about the Node transport: where it exists, and
// that the static check allows its node: imports in exactly one file.
import { describe, expect, it } from 'vitest';
import { HemUnsupportedError, createNodeFetch } from '../../src/index.js';
import { isNode } from '../../src/transport/node-https.js';
import { checkSource } from '../support/source-check.js';

describe('createNodeFetch', () => {
  // verifies: REQ-NET-013
  it('exists on Node.js and refuses to run elsewhere', () => {
    if (isNode()) expect(typeof createNodeFetch()).toBe('function');
    else expect(() => createNodeFetch()).toThrow(HemUnsupportedError);
  });
});

describe('the node: exemption of the static check', () => {
  const source = "const m = await import('node:https'); const h = await import('node:http'); const v = process.versions;\n";

  // verifies: REQ-BUILD-003
  it('allows node:https, node:http and process in the Node transport only', () => {
    expect(checkSource('src/transport/node-https.ts', source)).toEqual([]);
    expect(checkSource('src/transport/other.ts', source).map((v) => v.rule)).toEqual(['node: import', 'node: import', 'process']);
    expect(checkSource('src/transport/node-https.ts', "await import('node:fs');\n").map((v) => v.rule)).toEqual(['node: import']);
    expect(checkSource('src/transport/node-https.ts', 'Buffer.from(x);\n').map((v) => v.rule)).toEqual(['Buffer']);
  });
});
