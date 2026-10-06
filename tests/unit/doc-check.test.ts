// The documentation checker must be able to fail.
import { describe, expect, it } from 'vitest';
import { docProblems, documentedMethods } from '../support/doc-check.js';

const sample = `export declare class DemoApi {
    #private;
    /** @internal */
    constructor(context: unknown);
    /**
     * Fine.
     *
     * @remarks Token scope: none. Introduced in M1.
     */
    good(options?: unknown): Promise<void>;
    /**
     * No scope here.
     *
     * @remarks Introduced in M1.
     */
    noScope(): Promise<void>;
    /** Token scope: \`keymgmt:gen\`. */
    noMilestone(): Promise<void>;
    undocumented<T>(x: T): Promise<T>;
    get role(): string;
}`;

describe('documentation checker', () => {
  // verifies: REQ-API-007
  it('finds every method with its doc block and flags a missing scope or milestone', () => {
    const methods = documentedMethods(sample);
    expect(methods.map((m) => [m.method, docProblems(m.doc)])).toEqual([
      ['good', []],
      ['noScope', ['no token scope']],
      ['noMilestone', ['no milestone']],
      ['undocumented', ['no token scope', 'no milestone']],
    ]);
    expect(methods.every((m) => m.className === 'DemoApi')).toBe(true);
  });
});
