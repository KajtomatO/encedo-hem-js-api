// Runs the static source check over every file in src/.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkSource, moduleSpecifiers } from '../support/source-check.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const src = join(root, 'src');

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

const files = listFiles(src);

describe('src/ static check', () => {
  // verifies: REQ-BUILD-003
  it('contains only TypeScript sources', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(relative(root, file)).toMatch(/\.ts$/);
  });

  // verifies: REQ-BUILD-003, REQ-API-009
  it('uses no Node-only API, no other networking or crypto entry point, no console and no persistent storage', () => {
    const violations = files.flatMap((file) => checkSource(relative(root, file), readFileSync(file, 'utf8')));
    expect(violations).toEqual([]);
  });

  // verifies: REQ-BUILD-003
  it('imports nothing outside src/', () => {
    for (const file of files) {
      for (const { specifier } of moduleSpecifiers(readFileSync(file, 'utf8'))) {
        const target = resolve(dirname(file), specifier);
        expect(relative(src, target).startsWith('..'), `${relative(root, file)} imports "${specifier}"`).toBe(false);
      }
    }
  });
});
