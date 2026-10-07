// Expected to FAIL: a transport built without a fetch uses node:https on Node,
// which the guard blocks beyond loopback — even when the rejection is swallowed.
import { expect, it } from 'vitest';
import { Transport } from '../../../src/transport/transport.js';

it('sends through the Node transport without substituting it', async () => {
  await new Transport({ url: 'https://hem.test' }).send({ operation: 'test.op', method: 'GET', path: '/api/system/status' }).catch(() => undefined);
  expect(true).toBe(true);
});
