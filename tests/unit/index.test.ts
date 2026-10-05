import { describe, expect, it } from 'vitest';
import { HEM_API_VERSION } from '../../src/index.js';

describe('package entry point', () => {
  // verifies: REQ-API-010
  it('exports the targeted API version 1.2.2', () => {
    expect(HEM_API_VERSION).toBe('1.2.2');
  });
});
