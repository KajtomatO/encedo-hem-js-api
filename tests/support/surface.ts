// supports: REQ-API-007, REQ-API-008
// Reads the public surface from the emitted type declarations: every name
// exported from dist/index.d.ts, with its declaration split into entries
// (one per header line and one per member line), and the TSDoc attached to
// the members of the namespace interfaces.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Declaration {
  name: string;
  /** Normalised lines of the declaration without comments. */
  lines: string[];
  /** Member name → the TSDoc block that precedes it (namespace interfaces). */
  memberDocs: Map<string, string>;
  /** Members in declaration order. */
  members: string[];
}

function normalise(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

/** Splits one .d.ts file into its top-level declarations. */
export function parseDeclarations(source: string): Map<string, Declaration> {
  const out = new Map<string, Declaration>();
  const lines = source.split("\n");
  let current: Declaration | undefined;
  let depth = 0;
  let doc: string | undefined;
  let inDoc = false;
  let docBuf: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (inDoc) {
      docBuf.push(line);
      if (line.endsWith("*/")) {
        inDoc = false;
        doc = docBuf.join("\n");
      }
      continue;
    }
    if (line.startsWith("/**") || line.startsWith("/*")) {
      docBuf = [line];
      if (line.endsWith("*/")) doc = line;
      else inDoc = true;
      continue;
    }
    if (line.startsWith("//") || line === "") continue;
    if (depth === 0) {
      const m = line.match(
        /^(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|function|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/,
      );
      if (m) {
        const name = m[1]!;
        current = out.get(name) ?? { name, lines: [], memberDocs: new Map(), members: [] };
        out.set(name, current);
      } else {
        current = undefined;
      }
    } else if (current && depth === 1) {
      const member = line.match(/^(?:readonly\s+|static\s+|get\s+|set\s+)*([A-Za-z_$#][\w$]*)\??\s*[(<:]/);
      if (member) {
        const name = member[1]!;
        if (!current.members.includes(name)) current.members.push(name);
        if (doc !== undefined) current.memberDocs.set(name, (current.memberDocs.get(name) ?? "") + doc);
      }
    }
    if (current) current.lines.push(normalise(line));
    doc = undefined;
    for (const ch of line) {
      if (ch === "{" || ch === "(") depth++;
      else if (ch === "}" || ch === ")") depth--;
    }
  }
  return out;
}

interface ExportRef {
  name: string;
  local: string;
  file: string;
}

/** Lists the names exported from an index .d.ts and where each is declared. */
export function parseIndexExports(indexPath: string): ExportRef[] {
  const text = readFileSync(indexPath, "utf8");
  const refs: ExportRef[] = [];
  for (const m of text.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const file = join(dirname(indexPath), m[2]!.replace(/\.js$/, ".d.ts"));
    for (const part of m[1]!.split(",").map((s) => s.trim()).filter(Boolean)) {
      const [local, , alias] = part.replace(/^type\s+/, "").split(/\s+/);
      refs.push({ name: alias ?? local!, local: local!, file });
    }
  }
  return refs;
}

/** The public surface as a sorted list of entries `<export>: <declaration line>`. */
export function readSurface(distDir: string): { entries: string[]; declarations: Map<string, Declaration> } {
  const index = join(distDir, "index.d.ts");
  if (!existsSync(index)) throw new Error(`${index} not found; build first`);
  const cache = new Map<string, Map<string, Declaration>>();
  const entries: string[] = [];
  const declarations = new Map<string, Declaration>();
  for (const ref of parseIndexExports(index)) {
    let decls = cache.get(ref.file);
    if (!decls) {
      decls = parseDeclarations(readFileSync(ref.file, "utf8"));
      cache.set(ref.file, decls);
    }
    const decl = decls.get(ref.local);
    if (!decl) throw new Error(`export ${ref.name}: no declaration of ${ref.local} in ${ref.file}`);
    declarations.set(ref.name, decl);
    entries.push(`${ref.name}`);
    for (const line of decl.lines) entries.push(`${ref.name}: ${line}`);
  }
  return { entries: [...new Set(entries)].sort(), declarations };
}

/** Entries of the committed snapshot that are missing from the current surface. */
export function missingEntries(snapshot: readonly string[], current: readonly string[]): string[] {
  const now = new Set(current);
  return snapshot.filter((e) => !now.has(e));
}

/**
 * Operations of the namespace interfaces (exported names ending in `Api`)
 * whose TSDoc lacks a `@scope` or a `@milestone` tag.
 */
export function undocumentedOperations(declarations: Map<string, Declaration>): string[] {
  const problems: string[] = [];
  for (const [name, decl] of declarations) {
    if (!/Api$/.test(name)) continue;
    for (const member of decl.members) {
      const doc = decl.memberDocs.get(member) ?? "";
      if (!/@scope\s+\S/.test(doc)) problems.push(`${name}.${member}: missing @scope`);
      if (!/@milestone\s+M\d+/.test(doc)) problems.push(`${name}.${member}: missing @milestone`);
    }
  }
  return problems;
}
