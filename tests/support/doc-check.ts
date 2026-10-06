// Checks the TSDoc of public operations in emitted type declarations.
// supports: REQ-API-007

export interface DocumentedMethod {
  readonly className: string;
  readonly method: string;
  readonly doc: string;
}

/** Methods of exported `*Api` classes in a `.d.ts` text, each with the JSDoc block right above it ('' if none). */
export function documentedMethods(declarations: string): DocumentedMethod[] {
  const found: DocumentedMethod[] = [];
  for (const match of declarations.matchAll(/export declare class (\w+Api)\b[^{]*\{([\s\S]*?)\n\}/g)) {
    const className = match[1] as string;
    const body = match[2] as string;
    for (const member of body.matchAll(/(\/\*\*[\s\S]*?\*\/\s*)?^ {4}(\w+)(?:<[^>]*>)?\(/gm)) {
      const method = member[2] as string;
      if (method === 'constructor') continue;
      found.push({ className, method, doc: member[1] ?? '' });
    }
  }
  return found;
}

/** Problems with one method's documentation: missing scope or missing milestone. */
export function docProblems(doc: string): string[] {
  const problems: string[] = [];
  if (!/Token scope: [^.\n]+/.test(doc)) problems.push('no token scope');
  if (!/Introduced in M\d+\./.test(doc)) problems.push('no milestone');
  return problems;
}
