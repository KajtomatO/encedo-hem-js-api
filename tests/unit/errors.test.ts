import { describe, expect, it } from 'vitest';
import { errorFromResponse } from '../../src/errors.js';
import * as hem from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';

const {
  HemAbortError,
  HemApprovalRejectedError,
  HemApprovalTimeoutError,
  HemBadRequestError,
  HemDeviceError,
  HemDeviceStateError,
  HemError,
  HemForbiddenError,
  HemOperationFailedError,
  HemOriginRejectedError,
  HemPayloadTooLargeError,
  HemProtocolError,
  HemTimeoutError,
  HemTlsRequiredError,
  HemUnauthenticatedError,
  HemUnreachableError,
  HemUnsupportedError,
  HemValidationError,
} = hem;

/** Fetch one scripted response from the fake device and map it. */
async function mapReply(reply: Parameters<FakeFetch['on']>[2]): Promise<hem.HemError> {
  const fake = new FakeFetch().on('POST', '/api/x', reply);
  const response = await fake.fetch('https://hem.test/api/x', { method: 'POST' });
  return errorFromResponse(response, 'test.op');
}

const statusTable = [
  [400, HemBadRequestError, 'BAD_REQUEST'],
  [401, HemUnauthenticatedError, 'UNAUTHENTICATED'],
  [403, HemForbiddenError, 'FORBIDDEN'],
  [406, HemOperationFailedError, 'OPERATION_FAILED'],
  [409, HemDeviceStateError, 'DEVICE_STATE'],
  [412, HemOriginRejectedError, 'ORIGIN_REJECTED'],
  [413, HemPayloadTooLargeError, 'PAYLOAD_TOO_LARGE'],
  [418, HemTlsRequiredError, 'TLS_REQUIRED'],
  [500, HemDeviceError, 'DEVICE_ERROR'],
] as const;

describe('error classes', () => {
  // verifies: REQ-API-002
  it('are all exported from the package root, extend HemError and carry a fixed code and name', () => {
    const classes = [
      [HemBadRequestError, 'BAD_REQUEST'],
      [HemUnauthenticatedError, 'UNAUTHENTICATED'],
      [HemForbiddenError, 'FORBIDDEN'],
      [HemOperationFailedError, 'OPERATION_FAILED'],
      [HemDeviceStateError, 'DEVICE_STATE'],
      [HemOriginRejectedError, 'ORIGIN_REJECTED'],
      [HemPayloadTooLargeError, 'PAYLOAD_TOO_LARGE'],
      [HemTlsRequiredError, 'TLS_REQUIRED'],
      [HemDeviceError, 'DEVICE_ERROR'],
      [HemTimeoutError, 'TIMEOUT'],
      [HemUnreachableError, 'UNREACHABLE'],
      [HemAbortError, 'ABORTED'],
      [HemValidationError, 'VALIDATION'],
      [HemProtocolError, 'PROTOCOL'],
      [HemUnsupportedError, 'UNSUPPORTED'],
      [HemApprovalRejectedError, 'APPROVAL_REJECTED'],
      [HemApprovalTimeoutError, 'APPROVAL_TIMEOUT'],
    ] as const;
    const codes = new Set<string>();
    for (const [ErrorClass, code] of classes) {
      const error = new ErrorClass('boom', { operation: 'keys.create' });
      expect(error).toBeInstanceOf(ErrorClass);
      expect(error).toBeInstanceOf(HemError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(code);
      expect(error.name).toBe(ErrorClass.name);
      expect(error.message).toBe('boom');
      expect(error.operation).toBe('keys.create');
      expect(error.status).toBeUndefined();
      codes.add(code);
    }
    expect(codes.size).toBe(classes.length);
  });

  // verifies: REQ-API-002
  it('keep the cause and serialise to JSON without the cause', () => {
    const cause = new TypeError('network down');
    const error = new HemUnreachableError('unreachable', { operation: 'system.status', cause });
    expect(error.cause).toBe(cause);
    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: 'HemUnreachableError',
      code: 'UNREACHABLE',
      message: 'unreachable',
      operation: 'system.status',
    });
  });
});

describe('status mapping', () => {
  // verifies: REQ-API-002
  it.each(statusTable)('maps HTTP %i to its own class', async (status, ErrorClass, code) => {
    const error = await mapReply({ status });
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.operation).toBe('test.op');
    expect(error.message).toContain(`HTTP ${status}`);
  });

  // verifies: REQ-API-002
  it('gives every listed status a different class', () => {
    expect(new Set(statusTable.map(([, ErrorClass]) => ErrorClass)).size).toBe(statusTable.length);
  });

  // verifies: REQ-API-002
  it.each([404, 410, 411, 402, 502, 503, 302])('maps unlisted HTTP %i to HemDeviceError with the raw status', async (status) => {
    const error = await mapReply({ status });
    expect(error.constructor).toBe(HemDeviceError);
    expect(error.status).toBe(status);
  });
});

describe('status mapping and the response body', () => {
  // verifies: REQ-API-003
  it.each(statusTable)('maps HTTP %i with an empty body labelled application/json', async (status, ErrorClass) => {
    const error = await mapReply({ status, headers: { 'content-type': 'application/json' } });
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error.body).toBeUndefined();
    expect(error.bodyText).toBeUndefined();
  });

  // verifies: REQ-API-003
  it('maps a whitespace-only JSON-labelled body as empty', async () => {
    const error = await mapReply({ status: 409, body: ' \n', headers: { 'content-type': 'application/json' } });
    expect(error).toBeInstanceOf(HemDeviceStateError);
    expect(error.body).toBeUndefined();
  });

  // verifies: REQ-API-003
  it('keeps a non-JSON body as raw text, even when labelled JSON', async () => {
    const error = await mapReply({ status: 406, body: 'not {json', headers: { 'content-type': 'application/json' } });
    expect(error).toBeInstanceOf(HemOperationFailedError);
    expect(error.body).toBe('not {json');
    expect(error.bodyText).toBe('not {json');
  });

  // verifies: REQ-API-003
  it('exposes a JSON body parsed', async () => {
    const error = await mapReply({ status: 400, body: { reason: 'bad kid' } });
    expect(error).toBeInstanceOf(HemBadRequestError);
    expect(error.body).toEqual({ reason: 'bad kid' });
    expect(error.bodyText).toBe('{"reason":"bad kid"}');
  });

  // verifies: REQ-API-003
  it('maps by status when the body cannot be read at all', async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('connection reset'));
      },
    });
    const error = await mapReply(new Response(broken, { status: 413 }));
    expect(error).toBeInstanceOf(HemPayloadTooLargeError);
    expect(error.body).toBeUndefined();
  });
});
