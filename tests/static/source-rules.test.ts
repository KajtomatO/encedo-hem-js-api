import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkSource } from "../support/source-rules.js";

const srcRoot = fileURLToPath(new URL("../../src", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rules = (src: string) => checkSource(src).map((v) => v.rule);

describe("static source rules", () => {
  // verifies: REQ-BUILD-003
  it("rejects node: imports, bare specifiers, Buffer, process and require", () => {
    expect(rules(`import { x } from "node:crypto";`)).toContain("node: import");
    expect(rules(`const m = await import("node:fs");`)).toContain("node: import");
    expect(rules(`import x from "lodash";`)).toContain("bare module specifier");
    expect(rules(`export * from "some-pkg";`)).toContain("bare module specifier");
    expect(rules(`const b = Buffer.from("a");`)).toContain("Buffer");
    expect(rules(`if (process.version) {}`)).toContain("process");
    expect(rules(`const m = require("x");`)).toContain("require");
    expect(rules(`import { a } from "./a.js";\nimport { b } from "../b/index.js";`)).toEqual([]);
    expect(rules(`// Buffer and process mentioned in a comment\n/* require() */ const ok = 1;`)).toEqual([]);
  });

  // verifies: REQ-API-009
  it("rejects console output, web storage, IndexedDB, file and environment access", () => {
    expect(rules(`console.log(token);`)).toContain("console output");
    expect(rules(`localStorage.setItem("t", token);`)).toContain("web storage");
    expect(rules(`sessionStorage.getItem("t");`)).toContain("web storage");
    expect(rules(`indexedDB.open("db");`)).toContain("IndexedDB");
    expect(rules(`document.cookie = token;`)).toContain("cookies");
    expect(rules(`await showSaveFilePicker();`)).toContain("file access");
    expect(rules(`const v = import.meta.env.HEM_PASS;`)).toContain("environment variables");
    expect(rules(`const v = process.env.HEM_PASS;`)).toContain("process");
  });

  // verifies: REQ-BUILD-003, REQ-API-009
  it("finds no violation anywhere in src/", () => {
    const files = walk(srcRoot).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    const found = files.flatMap((f) =>
      checkSource(readFileSync(f, "utf8")).map((v) => `${relative(srcRoot, f)}:${v.line} ${v.rule}: ${v.text}`),
    );
    expect(found).toEqual([]);
  });
});
