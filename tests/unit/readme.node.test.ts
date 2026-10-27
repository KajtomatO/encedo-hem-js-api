// The README carries the sections integrators need before first use.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');

/** The text of the section under a `## ` heading. */
function section(heading: string): string {
  const start = readme.indexOf(`\n## ${heading}\n`);
  expect(start, `README section "${heading}"`).toBeGreaterThanOrEqual(0);
  const end = readme.indexOf('\n## ', start + 1);
  return readme.slice(start, end === -1 ? undefined : end);
}

describe('README', () => {
  // verifies: REQ-BUILD-004
  it('states the Node.js and the browser requirement', () => {
    const text = section('Requirements');
    expect(text).toMatch(/Node\.js 24 or later/);
    expect(text).toMatch(/X25519/);
    expect(text).toMatch(/Web Crypto/);
  });

  // verifies: REQ-API-010
  it('explains how to compare the exported API version with the firmware version', () => {
    const text = section('Checking compatibility with the device firmware');
    expect(text).toContain('HEM_API_VERSION');
    expect(text).toContain("'1.2.2'");
    expect(text).toContain('system.version()');
    expect(text).toContain('fwv');
  });

  // verifies: REQ-NET-011
  it('documents browser use: 412, where the allow-list is set, its syntax, the error class, and whose job it is', () => {
    const text = section('Using the library in a browser');
    expect(text).toContain('412');
    expect(text).toContain('HemOriginRejectedError');
    expect(text).toMatch(/provisioning/);
    expect(text).toMatch(/configuration write/);
    expect(text).toContain('`*`');
    expect(text).toContain('`*.example.com`');
    expect(text).toMatch(/exact origin/);
    expect(text).toMatch(/your\s+responsibility/);
  });

  // verifies: REQ-NET-012
  it('documents custom TLS trust: a CA method and an IP-address method through createNodeFetch, no browser override, no TLS option, no expiry recovery', () => {
    const text = section("Trusting the device's TLS certificate");
    expect(text).toMatch(/createNodeFetch\(\{ ca:/);
    expect(text).toMatch(/createNodeFetch\(\{ servername: 'my\.ence\.do'/);
    expect(text).not.toMatch(/undici/);
    expect(text).toContain('https://192.168.7.1');
    expect(text).toMatch(/Browsers offer no such override/);
    expect(text).toMatch(/no TLS option/);
    expect(text).toMatch(/does \*\*not\*\* recover automatically from an expired/);
  });

  it('references no file outside this repository', () => {
    expect(readme).not.toMatch(/\]\((?!https?:\/\/|#)[^)]*\.\.\//);
    expect(readme).not.toMatch(/\/home\/|[A-Z]:\\|~\//);
    for (const url of readme.match(/https:\/\/github\.com\/[^\s)]+/g) ?? []) {
      expect(url, 'other repositories are cited only as a whole').toMatch(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?[.,]?$/);
    }
  });
});
