// The snapshot comparison must fail on changes and removals and pass on additions.
import { describe, expect, it } from 'vitest';
import { breakingChanges, exportedNames, formatSurface, parseSurface, surfaceEntries } from '../support/surface.js';

const v1 = `/** Doc; with a semicolon. */
export declare class KeysApi {
    #private;
    /** @internal */
    constructor(context: Context);
    /** Create; returns the id. */
    create(params: CreateKeyParams, options?: CallOptions): Promise<string>;
    get(kid: string, options?: CallOptions): Promise<KeyDetails>;
    get role(): Role | undefined;
}
export interface CreateKeyParams {
    label: string;
    type: KeyType;
}
export type KeyType = 'AES256' | 'SHA2-256';
export declare const HEM_API_VERSION = "1.2.2";
`;

const surface = (text: string): Map<string, string> => {
  const all = new Map<string, string>();
  for (const name of ['KeysApi', 'CreateKeyParams', 'KeyType', 'HEM_API_VERSION']) for (const [k, v] of surfaceEntries(name, text)) all.set(k, v);
  return all;
};

describe('surface snapshot comparison', () => {
  // verifies: REQ-API-008
  it('extracts one entry per declaration and public member, leaving out private and internal ones', () => {
    expect([...surface(v1).keys()].sort()).toEqual([
      'CreateKeyParams',
      'CreateKeyParams.label',
      'CreateKeyParams.type',
      'HEM_API_VERSION',
      'KeyType',
      'KeysApi',
      'KeysApi.create',
      'KeysApi.get',
      'KeysApi.role',
    ]);
    expect(surface(v1).get('KeysApi.create')).toBe('create(params:CreateKeyParams,options?:CallOptions):Promise<string>');
  });

  // verifies: REQ-API-008
  it('passes when entries are only added', () => {
    const v2 = v1
      .replace('    get role()', '    list(options?: CallOptions): Promise<KeyPage>;\n    get role()')
      .replace('    type: KeyType;\n', '    type: KeyType;\n    descr?: Uint8Array;\n');
    expect(breakingChanges(surface(v1), surface(v2))).toEqual([]);
  });

  // verifies: REQ-API-008
  it.each([
    ['a changed signature', v1.replace('create(params: CreateKeyParams, options?: CallOptions): Promise<string>', 'create(params: CreateKeyParams): Promise<string>')],
    ['a removed method', v1.replace('    get(kid: string, options?: CallOptions): Promise<KeyDetails>;\n', '')],
    ['a narrowed type', v1.replace("'AES256' | 'SHA2-256'", "'AES256'")],
    ['a changed constant', v1.replace('"1.2.2"', '"1.3.0"')],
    ['a removed property', v1.replace('    label: string;\n', '')],
  ])('fails on %s', (_, changed) => {
    expect(breakingChanges(surface(v1), surface(changed)).length).toBeGreaterThan(0);
  });

  it('round-trips through the snapshot format and reads index exports', () => {
    expect(parseSurface(formatSurface(surface(v1)))).toEqual(surface(v1));
    expect(exportedNames("export { A, B as C } from './a.js';\nexport type { D } from './d.js';\nexport declare const E = 1;")).toEqual(
      new Map([['A', './a.js'], ['C', './a.js'], ['D', './d.js'], ['E', '']]),
    );
  });
});
