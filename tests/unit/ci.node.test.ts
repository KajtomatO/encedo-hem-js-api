// The CI workflow and the local A-gate script run the same checks.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
const scripts = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
// The workflow without its comments, for checks of what it actually does.
const commands = workflow.replace(/^\s*#.*$/gm, '');
const steps = [...workflow.matchAll(/^\s*- run: (.+)$/gm)].map((match) => match[1]);

describe('A-gate script', () => {
  // verifies: REQ-BUILD-005
  it('runs build, type-check and both unit runs', () => {
    expect(scripts['check']).toBe('npm run build && npm run typecheck && vitest run');
    expect(scripts['build']).toContain('tsc -p tsconfig.build.json');
    expect(scripts['typecheck']).toBe('tsc -p tsconfig.json --noEmit');
  });
});

describe('CI workflow', () => {
  // verifies: REQ-BUILD-005, REQ-TEST-002
  it('runs on every push and pull request and calls the A-gate script after a clean install', () => {
    expect(workflow).toMatch(/^on:\n {2}push:\n {2}pull_request:\n/m);
    expect(steps).toEqual(['npm ci', 'npx playwright install --with-deps chromium', 'npm run check']);
  });

  // verifies: REQ-BUILD-004
  it('runs on Node 24', () => {
    expect(workflow).toMatch(/uses: actions\/setup-node@v\d+\n\s+with:\n\s+node-version: 24\n/);
  });

  // verifies: REQ-BUILD-005
  it('runs no integration or attended test and holds no device credentials', () => {
    expect(commands).not.toMatch(/integration|attended/i);
    expect(commands).not.toMatch(/secrets\.|HEM_|env:/);
    expect(scripts['check']).not.toMatch(/integration|attended/);
  });
});
