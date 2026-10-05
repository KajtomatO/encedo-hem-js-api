// Packaging rules checked against package.json and the build output in dist/.
// Node-only: needs the filesystem, child processes and a prior `npm run build`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, unknown>;

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

/** Module specifiers of every static import/export and dynamic import() in an ES module. */
function moduleSpecifiers(source: string): string[] {
  const patterns = [
    /\bimport\s+(?:[\w$*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:[\w$*{}\s,]+\s+)?from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1] as string));
}

beforeAll(() => {
  if (!existsSync(join(dist, 'index.js'))) {
    throw new Error('dist/ is missing; run `npm run build` first (`npm test` does this)');
  }
});

describe('package.json', () => {
  // verifies: REQ-BUILD-002
  it('declares no runtime, peer or optional dependencies', () => {
    expect(pkg).not.toHaveProperty('dependencies');
    expect(pkg).not.toHaveProperty('peerDependencies');
    expect(pkg).not.toHaveProperty('optionalDependencies');
    expect(pkg).not.toHaveProperty('bundleDependencies');
    expect(pkg).not.toHaveProperty('bundledDependencies');
  });

  // verifies: REQ-BUILD-002
  it('has no install scripts and no native addon', () => {
    const scripts = (pkg['scripts'] ?? {}) as Record<string, string>;
    for (const name of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'preprepare', 'postprepare']) {
      expect(scripts, `script "${name}"`).not.toHaveProperty(name);
    }
    expect(pkg).not.toHaveProperty('gypfile');
    expect(existsSync(join(root, 'binding.gyp'))).toBe(false);
  });

  // verifies: REQ-BUILD-001
  it('is an ES module package with typed exports', () => {
    expect(pkg['type']).toBe('module');
    expect(pkg['exports']).toEqual({
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    });
  });

  // verifies: REQ-BUILD-004
  it('declares Node.js 24 as the minimum version', () => {
    expect(pkg['engines']).toEqual({ node: '>=24' });
  });
});

describe('build output', () => {
  // verifies: REQ-BUILD-001
  it('consists of ESM .js files with .d.ts declarations and no CommonJS', () => {
    const files = listFiles(dist).map((file) => relative(dist, file));
    expect(files).toContain('index.js');
    expect(files).toContain('index.d.ts');
    for (const file of files) {
      expect(file, file).toMatch(/\.(js|d\.ts)$/);
      if (file.endsWith('.js')) {
        expect(files, `declaration for ${file}`).toContain(file.replace(/\.js$/, '.d.ts'));
        const source = readFileSync(join(dist, file), 'utf8');
        expect(source, file).not.toMatch(/\brequire\s*\(|\bmodule\.exports\b|\bexports\.\w+\s*=/);
      }
    }
  });

  // verifies: REQ-BUILD-002
  it('imports nothing outside itself', () => {
    for (const file of listFiles(dist).filter((path) => path.endsWith('.js') || path.endsWith('.d.ts'))) {
      for (const specifier of moduleSpecifiers(readFileSync(file, 'utf8'))) {
        expect(specifier, `${relative(root, file)} imports "${specifier}"`).toMatch(/^\.\.?\//);
        const target = resolve(dirname(file), specifier);
        expect(relative(dist, target).startsWith('..'), `${relative(root, file)} reaches outside dist/`).toBe(false);
        expect(existsSync(target), `${relative(root, file)} imports missing "${specifier}"`).toBe(true);
      }
    }
  });
});

describe('published package', () => {
  let consumer: string;

  beforeAll(() => {
    // A throwaway consumer project that resolves the package by name through node_modules.
    consumer = mkdtempSync(join(tmpdir(), 'hem-consumer-'));
    mkdirSync(join(consumer, 'node_modules'));
    symlinkSync(root, join(consumer, 'node_modules', pkg['name'] as string), 'dir');
  });

  afterAll(() => {
    rmSync(consumer, { recursive: true, force: true });
  });

  // verifies: REQ-BUILD-001, REQ-API-010
  it('can be imported by name from a plain ESM file in Node', () => {
    const script = join(consumer, 'smoke.mjs');
    writeFileSync(
      script,
      `import { HEM_API_VERSION } from '${pkg['name'] as string}';\nprocess.stdout.write(JSON.stringify(HEM_API_VERSION));\n`,
    );
    const output = execFileSync(process.execPath, [script], { cwd: consumer, encoding: 'utf8' });
    expect(JSON.parse(output)).toBe('1.2.2');
  });

  // verifies: REQ-BUILD-001
  it('packs only the build output, README, LICENSE and package.json', () => {
    const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
    const [packed] = JSON.parse(output) as [{ files: { path: string }[] }];
    for (const { path } of packed.files) {
      expect(path, path).toMatch(/^(dist\/.+|README\.md|LICENSE|package\.json)$/);
    }
    expect(packed.files.map(({ path }) => path)).toEqual(expect.arrayContaining(['dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE', 'package.json']));
  });
});
