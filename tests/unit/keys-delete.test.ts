import { describe, expect, it } from 'vitest';
import { HemOperationFailedError, HemValidationError } from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';

const KID = '0123456789abcdef0123456789abcdef';
const EMPTY_PAGE = { offset: 0, total: 0, listed: 0, list: [] };

describe('keys.delete', () => {
  // verifies: REQ-KEY-007
  it('sends DELETE /api/keymgmt/delete/{kid} with scope keymgmt:del and resolves on an empty 200', async () => {
    const fake = loginDevice().on('DELETE', `/api/keymgmt/delete/${KID}`, { status: 200 });
    await expect(loggedInClient(fake).keys.delete(KID.toUpperCase())).resolves.toBeUndefined();

    expect(loginScopes(fake)).toEqual(['keymgmt:del']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('DELETE');
    expect(request?.url.href).toBe(`https://my.ence.do/api/keymgmt/delete/${KID}`);
    expect(Object.keys(request?.headers ?? {})).toEqual(['authorization']);
    expect(request?.body).toBeUndefined();
  });

  // verifies: REQ-KEY-007
  it('raises HemOperationFailedError for 406 (key not present)', async () => {
    const fake = loginDevice().on('DELETE', `/api/keymgmt/delete/${KID}`, { status: 406 });
    await expect(loggedInClient(fake).keys.delete(KID)).rejects.toThrow(HemOperationFailedError);
  });

  // verifies: REQ-KEY-007
  it('discards the cached keymgmt:use:<kid> token of the deleted key and keeps the others', async () => {
    const fake = loginDevice()
      .always('GET', `/api/keymgmt/get/${KID}`, { body: { updated: 1 } })
      .always('GET', '/api/keymgmt/list', { body: EMPTY_PAGE })
      .always('DELETE', `/api/keymgmt/delete/${KID}`, { status: 200 });
    const client = loggedInClient(fake);
    await client.keys.get(KID);
    await client.keys.list();
    await client.keys.delete(KID);
    await client.keys.list();
    await client.keys.get(KID);
    // The list token survived the delete; the per-key token had to be obtained again.
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`, 'keymgmt:list', 'keymgmt:del', `keymgmt:use:${KID}`]);
  });

  // verifies: REQ-KEY-007
  it('keeps the per-key token when the delete fails', async () => {
    const fake = loginDevice()
      .always('GET', `/api/keymgmt/get/${KID}`, { body: { updated: 1 } })
      .always('DELETE', `/api/keymgmt/delete/${KID}`, { status: 406 });
    const client = loggedInClient(fake);
    await client.keys.get(KID);
    await expect(client.keys.delete(KID)).rejects.toThrow(HemOperationFailedError);
    await client.keys.get(KID);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`, 'keymgmt:del']);
  });

  // verifies: REQ-API-005
  it.each(['', 'xyz', `${KID}0`, `${KID.slice(0, 31)}g`])('rejects key id %j with HemValidationError and no request', async (kid) => {
    const fake = loginDevice();
    await expect(loggedInClient(fake).keys.delete(kid)).rejects.toThrow(HemValidationError);
    expect(fake.requests).toHaveLength(0);
  });
});
