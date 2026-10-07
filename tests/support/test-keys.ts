// Keys that device tests create: labelled `EHEMTEST-<unix seconds>-<n>`, remembered,
// deleted in teardown, and stray ones from interrupted runs swept at the start.
// Every delete goes through the prefix, so no other key — in particular the
// protected set of REQ-TEST-005 (the device's TLS material and paired phones) —
// can be reached from here.
// implements: REQ-TEST-006
// implements: REQ-TEST-005 — key mutations are confined to EHEMTEST keys.
import { type CreateKeyParams, type HemClient, HemOperationFailedError, type KeyEntry } from '../../src/index.js';

/** Reserved label prefix of test keys, shared with the C client on the same device. */
export const TEST_LABEL_PREFIX = 'EHEMTEST';

/** The largest label the device accepts. */
const MAX_LABEL_LENGTH = 32;

/** Whether a listed key is a test key, by its label. */
export function isTestKey(key: Pick<KeyEntry, 'label'>): boolean {
  return key.label.startsWith(TEST_LABEL_PREFIX);
}

/** The keys one test (or test file) creates, and their cleanup. */
export class TestKeys {
  readonly #client: HemClient;
  readonly #run: string;
  readonly #created: string[] = [];
  #counter = 0;

  constructor(client: HemClient, now: () => number = Date.now) {
    this.#client = client;
    this.#run = String(Math.floor(now() / 1000));
  }

  /**
   * A fresh label `EHEMTEST-<unix seconds>-<n>`, unique within the run. With
   * `length`, padded with `x` to exactly that many characters (at most 32).
   */
  label(length?: number): string {
    this.#counter += 1;
    const base = `${TEST_LABEL_PREFIX}-${this.#run}-${this.#counter}`;
    if (length === undefined) return base;
    if (length < base.length || length > MAX_LABEL_LENGTH) throw new RangeError(`A test label must be ${base.length} to ${MAX_LABEL_LENGTH} characters, not ${length}`);
    return base.padEnd(length, 'x');
  }

  /** Create a key with a fresh label and remember it for cleanup; returns the key id. */
  async create(params: Omit<CreateKeyParams, 'label'> & { labelLength?: number }): Promise<string> {
    const { labelLength, ...rest } = params;
    const kid = await this.#client.keys.create({ ...rest, label: this.label(labelLength) });
    this.#created.push(kid);
    return kid;
  }

  /** Remember a key created elsewhere with one of this object's labels. */
  track(kid: string): void {
    this.#created.push(kid);
  }

  /** Key ids remembered so far. */
  get created(): readonly string[] {
    return [...this.#created];
  }

  /**
   * Delete every remembered key. A key that is already gone (406) is fine.
   * Every key is tried before a failure is reported, so one error does not
   * leave the others behind.
   */
  async cleanup(): Promise<void> {
    const failures: string[] = [];
    for (const kid of this.#created.splice(0)) {
      try {
        await this.#client.keys.delete(kid);
      } catch (error) {
        if (!(error instanceof HemOperationFailedError)) failures.push(`${kid}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (failures.length > 0) throw new Error(`Test-key cleanup failed for ${failures.join('; ')}`);
  }
}

/**
 * Delete the `EHEMTEST` keys left behind by interrupted earlier runs and return
 * their ids. Keys with any other label are never touched.
 */
export async function sweepTestKeys(client: HemClient): Promise<string[]> {
  const stray = (await client.keys.listAll()).filter(isTestKey);
  for (const key of stray) await client.keys.delete(key.kid);
  return stray.map((key) => key.kid);
}
