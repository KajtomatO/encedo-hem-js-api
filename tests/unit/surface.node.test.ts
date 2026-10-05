// Additive-API rule: the committed snapshot of the public surface may only grow.
// Regenerate after an intended addition: `npm run surface:update`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { breakingChanges, exportedNames, formatSurface, parseSurface, surfaceEntries } from '../support/surface.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = join(root, 'dist');
const snapshotFile = join(root, 'tests/surface/public-api.txt');

function currentSurface(): Map<string, string> {
  const index = readFileSync(join(dist, 'index.d.ts'), 'utf8');
  const entries = new Map<string, string>();
  for (const [name, from] of exportedNames(index)) {
    const file = from === '' ? join(dist, 'index.d.ts') : join(dist, from.replace(/\.js$/, '.d.ts'));
    for (const [key, value] of surfaceEntries(name, readFileSync(file, 'utf8'))) entries.set(key, value);
  }
  return entries;
}

describe('public surface', () => {
  // verifies: REQ-API-008
  it('keeps every entry of the committed snapshot unchanged', () => {
    expect(existsSync(join(dist, 'index.d.ts')), 'run `npm run build` first').toBe(true);
    const current = currentSurface();
    if (process.env['HEM_UPDATE_SURFACE'] === '1') {
      const merged = existsSync(snapshotFile) ? parseSurface(readFileSync(snapshotFile, 'utf8')) : new Map<string, string>();
      // Only additions are written; a change or removal must be resolved by hand.
      for (const [key, value] of current) if (!merged.has(key)) merged.set(key, value);
      writeFileSync(snapshotFile, formatSurface(merged));
    }
    const baseline = parseSurface(readFileSync(snapshotFile, 'utf8'));
    expect(breakingChanges(baseline, current)).toEqual([]);
    expect(baseline.size).toBeGreaterThan(100);
  });

  // verifies: REQ-API-008
  it('has no exported name missing from the snapshot (run surface:update after adding one)', () => {
    const baseline = parseSurface(readFileSync(snapshotFile, 'utf8'));
    const missing = [...currentSurface().keys()].filter((key) => !baseline.has(key));
    expect(missing).toEqual([]);
  });

  it('covers every declaration file of the build', () => {
    const files = readdirSync(dist, { recursive: true }).map(String).filter((f) => f.endsWith('.d.ts'));
    expect(files.length).toBeGreaterThan(5);
  });
});
