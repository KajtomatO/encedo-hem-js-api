import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("package.json", () => {
  // verifies: REQ-BUILD-001
  it("declares ESM with an exports map carrying types", () => {
    expect(pkg.type).toBe("module");
    expect(pkg.exports["."].types).toBe("./dist/index.d.ts");
    expect(pkg.exports["."].default).toBe("./dist/index.js");
    expect(pkg.exports["."].require).toBeUndefined();
  });

  // verifies: REQ-BUILD-002
  it("has no runtime, peer or optional dependencies and no install scripts", () => {
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.optionalDependencies).toBeUndefined();
    expect(pkg.bundleDependencies ?? pkg.bundledDependencies).toBeUndefined();
    for (const hook of ["preinstall", "install", "postinstall", "prepare", "prepack", "postpack"]) {
      expect(pkg.scripts?.[hook], hook).toBeUndefined();
    }
    expect(pkg.gypfile).toBeUndefined();
  });

  // verifies: REQ-BUILD-004
  it("declares Node.js 24 as the minimum version", () => {
    expect(pkg.engines.node).toBe(">=24");
  });
});

describe("build output", () => {
  const files = walk(join(root, "dist"));

  // verifies: REQ-BUILD-001
  it("contains only ESM .js and .d.ts files", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f).toMatch(/\.(js|d\.ts)$/);
    for (const f of files.filter((f) => f.endsWith(".js"))) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/\brequire\s*\(|module\.exports|exports\.\w+\s*=/);
    }
  });

  // verifies: REQ-BUILD-002
  it("imports nothing outside itself", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      const specifiers = [...text.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm)]
        .map((m) => m[1] ?? m[2] ?? m[3]);
      for (const s of specifiers) expect(s, `${f} imports ${s}`).toMatch(/^\.\.?\//);
    }
  });

  // verifies: REQ-BUILD-001
  it("is importable from a plain ESM file in Node 24", () => {
    expect(Number(process.versions.node.split(".")[0])).toBeGreaterThanOrEqual(24);
    const out = execFileSync(process.execPath, [join(root, "tests/static/fixtures/smoke.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    expect(Array.isArray(JSON.parse(out))).toBe(true);
  });

  // verifies: REQ-BUILD-001
  it("packs only the build output, README, LICENSE and package.json", () => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const out = execFileSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: root,
      encoding: "utf8",
    });
    const [report] = JSON.parse(out) as [{ files: { path: string }[] }];
    const paths = report.files.map((f) => f.path).sort();
    for (const p of paths) {
      expect(p).toMatch(/^(dist\/.+\.(js|d\.ts)|README\.md|LICENSE|package\.json)$/);
    }
    expect(paths).toEqual(expect.arrayContaining(["LICENSE", "README.md", "package.json", "dist/index.js", "dist/index.d.ts"]));
  });
});
