// The release workflow publishes from CI on a version tag, after the A-gate checks, through npm trusted publishing.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8');
const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
// The workflow without its comments, for checks of what it actually does.
const commands = workflow.replace(/^\s*#.*$/gm, '');
const runs = [...workflow.matchAll(/^\s*(?:- )?run: (.+)$/gm)].map((match) => match[1] as string);
const lineOf = (needle: string | RegExp): number => commands.split('\n').findIndex((line) => (typeof needle === 'string' ? line.includes(needle) : needle.test(line)));

describe('release workflow', () => {
  // verifies: REQ-BUILD-007
  it('runs on pushed v* tags and on a manual dispatch only', () => {
    expect(commands).toMatch(/^on:\n {2}push:\n {4}tags:\n {6}- 'v\*'\n {2}workflow_dispatch:\n/m);
    expect(commands).not.toMatch(/pull_request|branches:/);
  });

  // verifies: REQ-BUILD-007
  it('runs the same install and A-gate steps as ci.yml before any publish step', () => {
    const ciSteps = [...ci.matchAll(/^\s*- run: (.+)$/gm)].map((match) => match[1]);
    expect(runs.slice(0, 3)).toEqual(ciSteps);
    expect(runs.slice(0, 3)).toEqual(['npm ci', 'npx playwright install --with-deps chromium', 'npm run check']);
    expect(lineOf('npm run check')).toBeLessThan(lineOf(/run: npm publish$/));
    expect(lineOf('npm run check')).toBeLessThan(lineOf('npm publish --dry-run'));
  });

  // verifies: REQ-BUILD-007
  it('fails unless the tag is v + the package.json version, before publishing', () => {
    expect(commands).toContain(`test "$GITHUB_REF_NAME" = "v$(node -p "require('./package.json').version")"`);
    expect(lineOf('$GITHUB_REF_NAME" = "v$(node')).toBeLessThan(lineOf(/run: npm publish$/));
  });

  // verifies: REQ-BUILD-007
  it('publishes through OIDC: id-token write, no registry token, and requires npm 11.5.1 or later', () => {
    expect(commands).toMatch(/^permissions:\n(?: {2}\w[\w-]*: \w+\n)*? {2}id-token: write\n/m);
    expect(commands).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./);
    expect(commands).toMatch(/11\.5\.1/);
    expect(commands).toMatch(/registry-url: https:\/\/registry\.npmjs\.org/);
  });

  // verifies: REQ-BUILD-007
  it('publishes only for a pushed tag; a manual run stops at a dry run', () => {
    const steps = commands.split(/\n(?= {6}- )/);
    const publish = steps.find((step) => /run: npm publish\n|run: npm publish$/.test(step)) as string;
    const dryRun = steps.find((step) => step.includes('npm publish --dry-run')) as string;
    const release = steps.find((step) => step.includes('gh release create')) as string;
    expect(publish).toContain("if: github.event_name == 'push'");
    expect(release).toContain("if: github.event_name == 'push'");
    expect(dryRun).toContain("if: github.event_name != 'push'");
  });

  // verifies: REQ-BUILD-007
  it('creates a GitHub Release named after the tag with the matching CHANGELOG section, using the workflow token', () => {
    expect(commands).toMatch(/^permissions:\n(?: {2}\w[\w-]*: \w+\n)*? {2}contents: write\n/m);
    expect(commands).toContain('GH_TOKEN: ${{ github.token }}');
    expect(commands).toMatch(/gh release create "\$GITHUB_REF_NAME" --title "\$GITHUB_REF_NAME" --notes-file release-notes\.md/);
    expect(commands).toContain('test -s release-notes.md');
  });

  // verifies: REQ-BUILD-007
  it('extracts exactly the CHANGELOG section of a version (checked with the 0.1.0 entry)', () => {
    const program = (workflow.match(/awk -v v="\$version" '([^']+)'/) as RegExpMatchArray)[1] as string;
    const notes = execFileSync('awk', ['-v', 'v=0.1.0', program, join(root, 'CHANGELOG.md')], { encoding: 'utf8' });
    expect(notes).toMatch(/^\nFirst release: milestone M1/);
    expect(notes).toContain('### Operations');
    expect(notes).not.toContain('## 0.1.0');
    expect(notes).not.toContain('Unreleased');
    expect(execFileSync('awk', ['-v', 'v=9.9.9', program, join(root, 'CHANGELOG.md')], { encoding: 'utf8' })).toBe('');
  });

  // verifies: REQ-BUILD-007
  it('runs no integration or attended test and holds no device credentials', () => {
    expect(commands).not.toMatch(/integration|attended/i);
    expect(commands).not.toMatch(/HEM_|EHEM_/);
  });
});
