// Runs a separate Vitest process over fixture tests that touch the network,
// and checks that the guard fails every one of them.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('network guard in a real run', () => {
  // verifies: REQ-TEST-001
  it('fails a test that makes an unsubstituted request, even when the rejection is swallowed', () => {
    const out = mkdtempSync(join(tmpdir(), 'hem-guard-'));
    const reportFile = join(out, 'report.json');
    const run = spawnSync(
      process.execPath,
      [
        join(root, 'node_modules/vitest/vitest.mjs'),
        'run',
        '--config',
        'tests/fixtures/network-guard/vitest.config.ts',
        '--reporter=json',
        `--outputFile=${reportFile}`,
      ],
      { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '1' } },
    );
    expect(run.status).not.toBe(0);
    const report = JSON.parse(readFileSync(reportFile, 'utf8')) as {
      testResults: { assertionResults: { title: string; status: string; failureMessages: string[] }[] }[];
    };
    const results = report.testResults.flatMap((file) => file.assertionResults);
    expect(results.map(({ title, status }) => [title, status]).sort()).toEqual([
      ['awaits an unsubstituted request', 'failed'],
      ['sends through the Node transport without substituting it', 'failed'],
      ['swallows the rejection of an unsubstituted request', 'failed'],
    ]);
    for (const result of results) {
      expect(result.failureMessages.join('\n')).toMatch(/network/);
    }
    rmSync(out, { recursive: true, force: true });
  }, 30_000);
});
