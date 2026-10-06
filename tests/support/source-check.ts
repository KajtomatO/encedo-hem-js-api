// Static check of library source text: imports and platform APIs that `src/`
// must not use. Pure string processing, so it runs in Node and in the browser.
// supports: REQ-BUILD-003, REQ-API-009

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly text: string;
}

interface Rule {
  readonly name: string;
  readonly pattern: RegExp;
}

// Applied to code with comments and string contents blanked out. Node globals
// and `console` are matched after a dot too (`globalThis.process`).
const codeRules: Rule[] = [
  // REQ-BUILD-003: Node-only globals.
  { name: 'Buffer', pattern: /(?<![\w$])Buffer\b/g },
  { name: 'process', pattern: /(?<![\w$])process\b/g },
  { name: 'require', pattern: /(?<![\w$])require\b/g },
  { name: '__dirname/__filename', pattern: /(?<![\w$.])__(?:dirname|filename)\b/g },
  { name: 'Node or other runtime global', pattern: /(?<![\w$.])(?:global|Deno|Bun)\b/g },
  // REQ-BUILD-003: cryptography only through globalThis.crypto. A bare `crypto`
  // or `self.crypto`/`window.crypto` is refused; a property named `crypto`
  // (`client.crypto`, `crypto: …`) is not a platform API and is allowed.
  { name: 'crypto not through globalThis', pattern: /(?<![\w$.])crypto\b(?!\s*\??:)|\b(?:self|window|frames|parent|top)\s*\.\s*crypto\b/g },
  // REQ-BUILD-003: networking only through fetch.
  { name: 'networking other than fetch', pattern: /(?<![\w$.])(?:XMLHttpRequest|WebSocket|EventSource|WebTransport|RTCPeerConnection)\b|\bsendBeacon\b/g },
  // REQ-API-009: no console output.
  { name: 'console', pattern: /(?<![\w$])console\b/g },
  // REQ-API-009: no persistent storage and no environment variables.
  { name: 'web storage', pattern: /(?<![\w$])(?:localStorage|sessionStorage)\b/g },
  { name: 'IndexedDB', pattern: /(?<![\w$])indexedDB\b/g },
  { name: 'cache or cookie storage', pattern: /(?<![\w$])(?:caches|cookieStore)\b|\bdocument\s*\.\s*cookie\b/g },
  { name: 'file system', pattern: /\bnavigator\s*\.\s*storage\b|(?<![\w$.])(?:showSaveFilePicker|showOpenFilePicker|showDirectoryPicker)\b/g },
  { name: 'environment variables', pattern: /\bimport\s*\.\s*meta\s*\.\s*env\b/g },
  // REQ-API-001: no module-level state. A `let` or `var` at column 0 (optionally
  // exported) is module state; `const` bindings and block-scoped variables are not.
  { name: 'module-level let/var', pattern: /^(?:export\s+)?(?:let|var)\b/gm },
];

/**
 * Blank out comments and the contents of string, template and regular-expression
 * literals, keeping line breaks and the code inside `${…}`.
 */
export function stripCommentsAndStrings(source: string): string {
  let out = '';
  let i = 0;
  // Stack of template-literal brace depths; non-empty while inside `${…}`.
  const templates: number[] = [];
  let lastSignificant = '';
  const blank = (text: string): string => text.replace(/[^\n]/g, ' ');

  const readTemplateChunk = (): void => {
    // At a position inside a template literal's text: copy blanks until `${` or the closing backtick.
    while (i < source.length) {
      const ch = source[i] as string;
      if (ch === '\\') {
        out += blank(source.slice(i, i + 2));
        i += 2;
      } else if (ch === '`') {
        out += '`';
        i += 1;
        lastSignificant = '`';
        return;
      } else if (ch === '$' && source[i + 1] === '{') {
        out += '${';
        i += 2;
        templates.push(0);
        lastSignificant = '{';
        return;
      } else {
        out += ch === '\n' ? '\n' : ' ';
        i += 1;
      }
    }
  };

  while (i < source.length) {
    const ch = source[i] as string;
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
    } else if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      out += ch + blank(source.slice(i + 1, j)) + ch;
      i = j + 1;
      lastSignificant = ch;
    } else if (ch === '`') {
      out += '`';
      i += 1;
      readTemplateChunk();
    } else if (ch === '/' && (lastSignificant === '' || '(,=:[!&|?{};+-*%<>~^'.includes(lastSignificant))) {
      // A regular-expression literal.
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== '\n') {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === '[') inClass = true;
        else if (source[j] === ']') inClass = false;
        else if (source[j] === '/' && !inClass) break;
        j += 1;
      }
      out += '/' + blank(source.slice(i + 1, j)) + '/';
      i = j + 1;
      lastSignificant = '/';
    } else {
      if (templates.length > 0) {
        if (ch === '{') templates[templates.length - 1] = (templates.at(-1) as number) + 1;
        if (ch === '}') {
          if (templates.at(-1) === 0) {
            templates.pop();
            out += '}';
            i += 1;
            readTemplateChunk();
            continue;
          }
          templates[templates.length - 1] = (templates.at(-1) as number) - 1;
        }
      }
      out += ch;
      i += 1;
      if (!/\s/.test(ch)) lastSignificant = /[\w$]/.test(ch) ? 'w' : ch;
    }
  }
  return out;
}

/** Module specifiers of static imports/exports, `import()` and `require()`, with their offsets. */
export function moduleSpecifiers(source: string): { specifier: string; index: number }[] {
  // Blanking keeps offsets, so a quoted range found in the stripped code is read back from the source.
  const code = stripCommentsAndStrings(source);
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w$*{}\s,]+\s+from\s+)?(['"])( *)\1/g,
    /\bexport\s+(?:type\s+)?(?:[\w$*{}\s,]+\s+)?from\s+(['"])( *)\1/g,
    /\b(?:import|require)\s*\(\s*(['"`])( *)\1/g,
  ];
  return patterns
    .flatMap((pattern) =>
      [...code.matchAll(pattern)].map((match) => {
        const start = match.index + match[0].length - (match[2] as string).length - 1;
        return { specifier: source.slice(start, start + (match[2] as string).length), index: match.index };
      }),
    )
    .sort((a, b) => a.index - b.index);
}

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

/**
 * Check one source file. Relative imports are reported only by the caller,
 * which knows the directory layout; everything else that is not relative is
 * a violation here.
 */
export function checkSource(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const lines = source.split('\n');
  const report = (index: number, rule: string): void => {
    const line = lineOf(source, index);
    violations.push({ file, line, rule, text: (lines[line - 1] ?? '').trim() });
  };

  for (const { specifier, index } of moduleSpecifiers(source)) {
    if (specifier.startsWith('node:')) report(index, 'node: import');
    else if (!specifier.startsWith('./') && !specifier.startsWith('../')) report(index, 'bare module specifier');
  }

  const code = stripCommentsAndStrings(source);
  for (const rule of codeRules) {
    for (const match of code.matchAll(rule.pattern)) {
      report(match.index, rule.name);
    }
  }
  return violations.sort((a, b) => a.line - b.line);
}
