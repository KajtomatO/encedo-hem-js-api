// Public-surface extraction from emitted type declarations, for the
// additive-API snapshot. Pure string processing.
// supports: REQ-API-008

/** Exported names of the package root, from the text of `index.d.ts`, with the module each comes from ('' = index itself). */
export function exportedNames(indexDts: string): Map<string, string> {
  const names = new Map<string, string>();
  const code = stripComments(indexDts);
  for (const match of code.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    for (const raw of (match[1] as string).split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.set(name, match[2] as string);
    }
  }
  for (const match of code.matchAll(/export\s+(?:declare\s+)?(?:const|function|class|interface|type)\s+(\w+)/g)) {
    names.set(match[1] as string, '');
  }
  return names;
}

/** Remove comments; a JSDoc block marked `@internal` becomes the marker `__internal__`. */
export function stripComments(text: string): string {
  return text
    .replace(/\/\*\*?[\s\S]*?\*\//g, (comment) => (comment.includes('@internal') ? ' __internal__ ' : ' '))
    .replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
}

const normalise = (text: string): string => text.replace(/\s+/g, ' ').replace(/\s*([(){}[\]<>,;:|&=?])\s*/g, '$1').trim();

/** Split `text` at `;` outside brackets and braces. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if ('{(['.includes(ch)) depth += 1;
    if ('})]'.includes(ch)) depth -= 1;
    if (ch === ';' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  if (current.trim() !== '') parts.push(current);
  return parts;
}

/** Find the end of the `{ … }` block that opens at `open`. */
function blockEnd(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

/**
 * Surface entries of one exported name in a declaration file: the
 * declaration header, and for classes and interfaces one entry per public
 * member (`Name.member`). Private and `@internal` members are left out.
 */
export function surfaceEntries(name: string, dts: string): Map<string, string> {
  const code = stripComments(dts);
  const entries = new Map<string, string>();
  const start = code.search(new RegExp(`export\\s+(?:declare\\s+)?(?:abstract\\s+)?(?:const|function|class|interface|type)\\s+${name}\\b`));
  if (start < 0) throw new Error(`declaration of ${name} not found`);
  const kind = /(const|function|class|interface|type)/.exec(code.slice(start))?.[1];
  if (kind === 'class' || kind === 'interface') {
    const open = code.indexOf('{', start);
    const close = blockEnd(code, open);
    entries.set(name, normalise(code.slice(start, open)));
    const seen = new Map<string, number>();
    for (const part of splitTopLevel(code.slice(open + 1, close))) {
      const member = part.trim();
      if (member === '' || member.startsWith('#') || member.includes('__internal__') || /^private\b/.test(member)) continue;
      const memberName = /^(?:static\s+)?(?:readonly\s+)?(?:get\s+|set\s+)?([\w$]+)/.exec(member)?.[1] ?? member;
      const count = (seen.get(memberName) ?? 0) + 1;
      seen.set(memberName, count);
      entries.set(`${name}.${memberName}${count > 1 ? `#${count}` : ''}`, normalise(member));
    }
  } else {
    // Up to the first top-level semicolon.
    const [declaration] = splitTopLevel(code.slice(start));
    entries.set(name, normalise(declaration ?? ''));
  }
  return entries;
}

/** Serialise entries as sorted `key<TAB>value` lines. */
export function formatSurface(entries: Map<string, string>): string {
  return [...entries.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}\t${value}`)
    .join('\n')
    .concat('\n');
}

export function parseSurface(text: string): Map<string, string> {
  return new Map(
    text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        const tab = line.indexOf('\t');
        return [line.slice(0, tab), line.slice(tab + 1)] as [string, string];
      }),
  );
}

/** Entries of the baseline that are missing or changed in the current surface. Additions are allowed. */
export function breakingChanges(baseline: Map<string, string>, current: Map<string, string>): string[] {
  const problems: string[] = [];
  for (const [key, value] of baseline) {
    const now = current.get(key);
    if (now === undefined) problems.push(`removed: ${key}`);
    else if (now !== value) problems.push(`changed: ${key}\n  was: ${value}\n  now: ${now}`);
  }
  return problems;
}
