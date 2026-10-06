// Checks the shape of the unit-test configuration: the same files run in Node and in a headless browser.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../vitest.config.js';

interface Project {
  test: { name: string; include?: string[]; exclude?: string[]; environment?: string; browser?: { enabled?: boolean; headless?: boolean; instances?: { browser: string }[] } };
}

describe('unit test projects', () => {
  // verifies: REQ-TEST-002
  it('runs the same unit test files in Node and in headless Chromium, with Node-only files excluded from the browser', () => {
    const projects = (config as { test: { projects: Project[]; setupFiles: string[] } }).test.projects;
    const node = projects.find((project) => project.test.name === 'node');
    const browser = projects.find((project) => project.test.name === 'browser');

    expect(node?.test.environment).toBe('node');
    expect(browser?.test.include).toEqual(node?.test.include);
    expect(browser?.test.include).toEqual(['tests/unit/**/*.test.ts']);
    expect(browser?.test.exclude).toEqual(['tests/unit/**/*.node.test.ts']);
    expect(browser?.test.browser).toMatchObject({ enabled: true, headless: true, instances: [{ browser: 'chromium' }] });
    expect((config as { test: { setupFiles: string[] } }).test.setupFiles).toEqual(['tests/support/setup.ts']);
  });

  // verifies: REQ-TEST-002
  it('is run by one npm script', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['test']).toMatch(/vitest run$/);
  });
});
