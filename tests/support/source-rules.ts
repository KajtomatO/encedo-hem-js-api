// supports: REQ-BUILD-003, REQ-API-009
// Static rules for code under src/: only the platform APIs shared by Node.js
// and browsers, and no channel through which a secret could leave memory.

export interface Violation {
  rule: string;
  line: number;
  text: string;
}

/** Removes comments while keeping line numbers and string contents intact. */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const c = source[i]!;
    const n = source[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += n ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const RULES: { rule: string; pattern: RegExp }[] = [
  // REQ-BUILD-003
  { rule: "node: import", pattern: /["']node:[^"']*["']/ },
  { rule: "Buffer", pattern: /\bBuffer\b/ },
  { rule: "process", pattern: /\bprocess\b/ },
  { rule: "require", pattern: /\brequire\s*\(/ },
  // REQ-API-009
  { rule: "console output", pattern: /\bconsole\b/ },
  { rule: "web storage", pattern: /\b(localStorage|sessionStorage)\b/ },
  { rule: "IndexedDB", pattern: /\bindexedDB\b|\bIDB[A-Z]\w*/ },
  { rule: "cookies", pattern: /\bdocument\s*\.\s*cookie\b/ },
  { rule: "file access", pattern: /\b(showSaveFilePicker|showOpenFilePicker|FileSystem\w*Handle|navigator\s*\.\s*storage|Deno)\b/ },
  { rule: "environment variables", pattern: /\bimport\s*\.\s*meta\s*\.\s*env\b|\benv\s*\[/ },
];

const SPECIFIER =
  /\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bexport\s*\*\s*from\s*["']([^"']+)["']/gm;

export function checkSource(source: string): Violation[] {
  const code = stripComments(source);
  const lines = code.split("\n");
  const violations: Violation[] = [];
  lines.forEach((text, index) => {
    for (const { rule, pattern } of RULES) {
      if (pattern.test(text)) violations.push({ rule, line: index + 1, text: text.trim() });
    }
  });
  for (const m of code.matchAll(SPECIFIER)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    if (!spec.startsWith("./") && !spec.startsWith("../")) {
      const line = code.slice(0, m.index).split("\n").length;
      violations.push({ rule: "bare module specifier", line, text: spec });
    }
  }
  return violations;
}
