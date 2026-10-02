import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { missingEntries, parseDeclarations, readSurface, undocumentedOperations } from "../support/surface.js";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));
const snapshotPath = fileURLToPath(new URL("./public-surface.txt", import.meta.url));

// The snapshot is regenerated with UPDATE_SURFACE=1 (test harness only); a
// regeneration that removes or changes entries must be reviewed in git.
describe("public surface snapshot", () => {
  const { entries } = readSurface(dist);

  // verifies: REQ-API-008
  it("contains every entry of the committed snapshot", () => {
    if (process.env["UPDATE_SURFACE"] === "1") writeFileSync(snapshotPath, entries.join("\n") + "\n");
    expect(existsSync(snapshotPath), "tests/static/public-surface.txt is committed").toBe(true);
    const snapshot = readFileSync(snapshotPath, "utf8").split("\n").filter(Boolean);
    expect(missingEntries(snapshot, entries)).toEqual([]);
  });

  // verifies: REQ-API-008
  it("fails on a changed or removed entry and passes on additions", () => {
    const base = ["A", "A: export declare function a(x: string): number;"];
    expect(missingEntries(base, [...base, "B", "B: export declare const b = 1;"])).toEqual([]);
    expect(missingEntries(base, ["A", "A: export declare function a(x: string, y?: number): number;"])).toEqual([base[1]]);
    expect(missingEntries(base, [])).toEqual(base);
  });
});

describe("operation documentation", () => {
  const { declarations } = readSurface(dist);

  // verifies: REQ-API-007
  it("every namespace operation states its scope and milestone in the emitted .d.ts", () => {
    expect(undocumentedOperations(declarations)).toEqual([]);
  });

  // verifies: REQ-API-007
  it("the check fails when the scope or the milestone is missing", () => {
    const decls = parseDeclarations(
      [
        "export interface DemoApi {",
        "    /**",
        "     * Fine.",
        "     * @scope none",
        "     * @milestone M1",
        "     */",
        "    ok(options?: CallOptions): Promise<void>;",
        "    /** @milestone M1 */",
        "    noScope(): Promise<void>;",
        "    /** @scope keymgmt:list */",
        "    noMilestone(): Promise<void>;",
        "    bare(): Promise<void>;",
        "}",
      ].join("\n"),
    );
    expect(undocumentedOperations(decls)).toEqual([
      "DemoApi.noScope: missing @scope",
      "DemoApi.noMilestone: missing @milestone",
      "DemoApi.bare: missing @scope",
      "DemoApi.bare: missing @milestone",
    ]);
  });
});

describe("token handling in the public API", () => {
  // verifies: REQ-AUTH-005
  it("no namespace operation takes a token or a scope for an authenticated call", () => {
    const { declarations } = readSurface(dist);
    const offenders: string[] = [];
    for (const [name, decl] of declarations) {
      if (!/Api$/.test(name)) continue;
      for (const line of decl.lines) if (/\btoken\??:|\bbearer/i.test(line)) offenders.push(`${name}: ${line}`);
    }
    // params types of key and crypto operations carry no token or scope either
    for (const t of ["CreateKeyParams", "SearchKeysParams", "ListKeysParams", "HmacParams", "WrapParams", "UnwrapParams"]) {
      for (const line of declarations.get(t)?.lines ?? []) if (/\b(token|scope)\??:/.test(line)) offenders.push(`${t}: ${line}`);
    }
    expect(offenders).toEqual([]);
  });
});

