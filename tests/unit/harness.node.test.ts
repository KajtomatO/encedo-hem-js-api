// The device-test harness, checked without a device: the separate configuration
// and commands, the gates, the environment parsing, and the label hygiene rule.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import unitConfig from '../../vitest.config.js';
import deviceConfig from '../../vitest.integration.config.js';
import { DEFAULT_PACE_MS, readDeviceEnv } from '../support/integration-env.js';
import { TEST_LABEL_PREFIX } from '../support/test-keys.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string>; dependencies?: unknown; devDependencies: Record<string, string> };

interface Project {
  test: { name: string; include?: string[]; environment?: string; setupFiles?: string[] };
}
interface Config {
  test: { projects: Project[]; setupFiles: string[]; globalSetup?: string[]; fileParallelism?: boolean };
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

const unit = unitConfig as unknown as Config;
const device = deviceConfig as unknown as Config;
const deviceTestFiles = [...listFiles(join(root, 'tests/integration')), ...listFiles(join(root, 'tests/attended'))];

describe('device tests are separate from the unit suite', () => {
  // verifies: REQ-TEST-003
  it('the default configuration includes only tests/unit, so `vitest run` never reaches tests/integration or tests/attended', () => {
    for (const project of unit.test.projects) {
      expect(project.test.include, project.test.name).toEqual(['tests/unit/**/*.test.ts']);
    }
    expect(pkg.scripts['test']).not.toMatch(/integration|attended/);
    expect(pkg.scripts['check']).not.toMatch(/integration|attended/);
    expect(pkg.scripts['test:unit']).not.toMatch(/integration|attended/);
  });

  // verifies: REQ-TEST-003
  it('a separate command runs the integration project from its own configuration', () => {
    expect(pkg.scripts['test:integration']).toBe('vitest run --config vitest.integration.config.ts --project integration');
    const integration = device.test.projects.find((project) => project.test.name === 'integration');
    expect(integration?.test.include).toEqual(['tests/integration/**/*.test.ts']);
    expect(integration?.test.environment).toBe('node');
    expect(device.test.fileParallelism).toBe(false);
  });

  // verifies: REQ-TEST-003
  it('the device projects do not load the unit network guard', () => {
    expect(device.test.setupFiles).toEqual(['tests/support/integration-setup.ts']);
    expect(device.test.setupFiles).not.toContain('tests/support/setup.ts');
    for (const project of device.test.projects) expect(project.test.setupFiles ?? device.test.setupFiles).not.toContain('tests/support/setup.ts');
  });

  // verifies: REQ-TEST-003
  it('device credentials come from the environment or the git-ignored hem.env, never from a committed file', () => {
    const ignored = readFileSync(join(root, '.gitignore'), 'utf8').split('\n');
    expect(ignored).toContain('hem.env');
    expect(existsSync(join(root, 'hem.env')) ? 'present locally' : 'absent').toBeTypeOf('string'); // may exist locally; never committed
    const tracked = [...listFiles(join(root, 'tests')), join(root, 'package.json'), join(root, 'vitest.integration.config.ts')];
    for (const file of tracked) {
      expect(readFileSync(file, 'utf8'), relative(root, file)).not.toMatch(/EHEM_TEST_PASSPHRASE\s*=\s*['"]?\S/);
    }
  });

  // verifies: REQ-TEST-003
  it('the TLS helper is a devDependency only', () => {
    expect(pkg.devDependencies['undici']).toBeDefined();
    expect(pkg.dependencies).toBeUndefined();
  });
});

describe('attended tests', () => {
  // verifies: REQ-TEST-004
  it('live under tests/attended, in their own project, excluded from the default and integration commands and from CI', () => {
    const attended = device.test.projects.find((project) => project.test.name === 'attended');
    expect(attended?.test.include).toEqual(['tests/attended/**/*.test.ts']);
    expect(pkg.scripts['test:attended']).toBe('vitest run --config vitest.integration.config.ts --project attended');
    expect(pkg.scripts['test:integration']).toContain('--project integration');
    const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8').replace(/^\s*#.*$/gm, '');
    expect(workflow).not.toMatch(/attended|integration/i);
  });

  // verifies: REQ-TEST-004
  it('no script, hook, workflow or test code sets the opt-in variable', () => {
    for (const [name, command] of Object.entries(pkg.scripts)) expect(command, `script ${name}`).not.toContain('EHEM_ALLOW_DISRUPTIVE');
    for (const file of [...listFiles(join(root, '.github')), ...listFiles(join(root, '.husky'))]) {
      expect(readFileSync(file, 'utf8').replace(/^\s*#.*$/gm, ''), relative(root, file)).not.toContain('EHEM_ALLOW_DISRUPTIVE');
    }
    // Code may read the variable and comments may explain it; nothing may assign it.
    const self = fileURLToPath(import.meta.url);
    const code = [join(root, 'vitest.config.ts'), join(root, 'vitest.integration.config.ts'), ...listFiles(join(root, 'tests'))].filter((file) => file !== self);
    for (const file of code) {
      const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(source, relative(root, file)).not.toMatch(/EHEM_ALLOW_DISRUPTIVE['"\]]*\s*[=:]\s*['"]?1/);
    }
  });
});

describe('device environment', () => {
  // verifies: REQ-TEST-003
  it('is absent without EHEM_TEST_URL and parsed with defaults otherwise', () => {
    expect(readDeviceEnv({})).toBeUndefined();
    expect(readDeviceEnv({ EHEM_TEST_URL: '' })).toBeUndefined();
    expect(readDeviceEnv({ EHEM_TEST_URL: 'https://my.ence.do' })).toEqual({
      url: 'https://my.ence.do',
      passphrase: undefined,
      insecure: false,
      caCert: undefined,
      paceMs: DEFAULT_PACE_MS,
      allowDisruptive: false,
    });
    expect(
      readDeviceEnv({
        EHEM_TEST_URL: 'https://192.168.7.1',
        EHEM_TEST_PASSPHRASE: 'p',
        EHEM_TEST_INSECURE: '1',
        EHEM_TEST_CACERT: 'ca.pem',
        EHEM_TEST_PACE_MS: '0',
        EHEM_ALLOW_DISRUPTIVE: '1',
      }),
    ).toEqual({ url: 'https://192.168.7.1', passphrase: 'p', insecure: true, caCert: 'ca.pem', paceMs: 0, allowDisruptive: true });
    expect(() => readDeviceEnv({ EHEM_TEST_URL: 'https://x', EHEM_TEST_PACE_MS: 'fast' })).toThrow(/EHEM_TEST_PACE_MS/);
  });
});

describe('test-key hygiene', () => {
  // verifies: REQ-TEST-006
  it('sweeps leftover EHEMTEST keys once per device-test run, through the global setup', () => {
    expect(device.test.globalSetup).toEqual(['tests/support/integration-global-setup.ts']);
    const source = readFileSync(join(root, 'tests/support/integration-global-setup.ts'), 'utf8');
    expect(source).toContain('sweepTestKeys(');
    expect(source).not.toMatch(/from 'vitest'/);
  });

  // verifies: REQ-TEST-006
  it(`no device test creates a key with a literal label; every literal label under tests/integration and tests/attended starts with ${TEST_LABEL_PREFIX}`, () => {
    const offenders: string[] = [];
    for (const file of deviceTestFiles) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\blabel:\s*(['"`])([^'"`]*)\1/g)) {
        if (!(match[2] as string).startsWith(TEST_LABEL_PREFIX)) offenders.push(`${relative(root, file)}: label ${match[2]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
