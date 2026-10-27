// The packed archive installs into an empty Node 24 project and imports. Needs
// `npm run build` first (dist/ is what gets packed); no network: the archive is
// installed from disk and the package has no dependencies.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; version: string };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cwd: string, args: string[]): string => execFileSync(npm, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

describe('packed archive', () => {
  const work = mkdtempSync(join(tmpdir(), 'hem-pack-'));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  // verifies: REQ-BUILD-006
  it('contains only the build, installs into an empty ESM project and imports', { timeout: 120_000 }, () => {
    expect(existsSync(join(root, 'dist', 'index.js')), 'run `npm run build` first').toBe(true);
    const [packed] = JSON.parse(run(root, ['pack', '--json', '--pack-destination', work])) as { filename: string; files: { path: string }[] }[];
    expect(packed?.filename).toBe(`${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`);
    const paths = (packed?.files ?? []).map((file) => file.path);
    expect(paths).toContain('dist/index.js');
    expect(paths).toContain('dist/index.d.ts');
    const allowed = /^(dist\/|package\.json$|README\.md$|LICENSE$|CHANGELOG\.md$)/;
    expect(paths.filter((path) => !allowed.test(path))).toEqual([]);

    const project = join(work, 'project');
    mkdirSync(project);
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }));
    run(project, ['install', '--no-audit', '--no-fund', '--ignore-scripts', '--offline', join(work, packed?.filename ?? '')]);
    writeFileSync(join(project, 'use.mjs'), `import { HemClient, HEM_API_VERSION, createNodeFetch } from '${pkg.name}';\nconsole.log(JSON.stringify({ version: HEM_API_VERSION, client: typeof HemClient, fetch: typeof createNodeFetch }));\n`);
    const output = execFileSync(process.execPath, ['use.mjs'], { cwd: project, encoding: 'utf8' });
    expect(JSON.parse(output)).toEqual({ version: '1.2.2', client: 'function', fetch: 'function' });
  });
});
