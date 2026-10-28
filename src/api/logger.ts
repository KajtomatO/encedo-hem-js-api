/**
 * Audit-log bindings (M2): verification key, file listing, file download.
 * The log files themselves are never parsed: their integrity chain is
 * computed over the exact bytes.
 *
 * @packageDocumentation
 */
import { HemProtocolError, HemValidationError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';
import {
  type BindingContext,
  type OperationSpec,
  type ResponseObject,
  invoke,
  invokeRaw,
  readBase64,
  readInteger,
  readStringArray,
  unsupportedOn404,
} from './core.js';

export const LOGGER_KEY: OperationSpec = {
  name: 'logger.key',
  group: 'logger',
  method: 'GET',
  path: '/api/logger/key',
  scope: 'logger:get',
  tlsOnly: false,
  required: ['key', 'nonce', 'nonce_signed'],
};

export const LOGGER_LIST: OperationSpec = {
  name: 'logger.list',
  group: 'logger',
  method: 'GET',
  path: '/api/logger/list',
  scope: 'logger:get',
  tlsOnly: false,
  required: ['total', 'id'],
  mscOnly: true,
};

export const LOGGER_LIST_OFFSET: OperationSpec = { ...LOGGER_LIST, path: '/api/logger/list/{offset}' };

export const LOGGER_FILE: OperationSpec = {
  name: 'logger.download',
  group: 'logger',
  method: 'GET',
  path: '/api/logger/{file}',
  scope: 'logger:get',
  tlsOnly: false,
  required: [],
  mscOnly: true,
};

/** Operations of this module. */
export const LOGGER_OPERATIONS: readonly OperationSpec[] = [LOGGER_KEY, LOGGER_LIST, LOGGER_LIST_OFFSET, LOGGER_FILE];

/** Largest number of file ids one listing returns. */
export const MAX_LOG_IDS_PER_PAGE = 128;

const LOG_FILE_ID = /^[0-9a-fA-F]{8}$/;

/** Result of {@link LoggerApi.key}. */
export interface LoggerKey {
  /** Ed25519 public key that signs the audit log (32 bytes). */
  readonly key: Uint8Array;
  /** Fresh time-based nonce (32 bytes). */
  readonly nonce: Uint8Array;
  /** Ed25519 signature over the raw nonce (64 bytes), proving the device holds the private key now. */
  readonly nonceSigned: Uint8Array;
}

/** Parameters of {@link LoggerApi.list}. */
export interface ListLogsParams {
  /** Directory-entry index to start from; default 0. */
  offset?: number | undefined;
}

/** Result of {@link LoggerApi.list}. */
export interface LogFileList {
  /** Entries in the whole log directory — not the number of ids on this page. */
  readonly total: number;
  /** Log-file ids on this page, 8 lower-case hexadecimal characters each (the power-up timestamp; one file per boot). */
  readonly ids: readonly string[];
}

/** Result of {@link LoggerApi.download}: one audit-log file, untouched. */
export interface LogFile {
  /** The file id, 8 lower-case hexadecimal characters. */
  readonly id: string;
  /** The file content exactly as the device sent it. */
  readonly bytes: Uint8Array;
  /** The content type the device declared, when it did. */
  readonly contentType?: string;
  /** The content decoded as UTF-8 text; the file is pipe-delimited text. */
  text(): string;
}

/** `client.logger`: the device's audit log. */
export interface LoggerApi {
  /**
   * The audit-log verification material: the device's Ed25519 signing
   * public key, a fresh nonce and the signature over it. Verifying log
   * files is the caller's job; this call only provides the key.
   *
   * Device call: `GET /api/logger/key`.
   *
   * @remarks Token scope: `logger:get`. Introduced in M2.
   */
  key(options?: CallOptions): Promise<LoggerKey>;

  /**
   * One page of audit-log file ids, at most 128, from `offset`. `total`
   * counts every entry in the log directory, not the ids returned, so page
   * until `offset` reaches it. Needs mass-storage hardware: on other
   * hardware the device answers 404 and this raises `HemUnsupportedError`.
   *
   * Device calls: `GET /api/logger/list` or `/list/{offset}`, chosen from
   * the parameters.
   *
   * @remarks Token scope: `logger:get`. Introduced in M2.
   */
  list(params?: ListLogsParams, options?: CallOptions): Promise<LogFileList>;

  /**
   * One audit-log file, byte for byte as the device sent it, with a text
   * view; no line is parsed, because the integrity chain is computed over
   * the exact bytes. Needs mass-storage hardware: the device answers 404
   * both on hardware without mass storage and for an unknown file id, so
   * `HemUnsupportedError` names both causes. The file currently being
   * written cannot be read (406, `HemOperationFailedError`).
   *
   * Device call: `GET /api/logger/{file}`.
   *
   * @remarks Token scope: `logger:get`. Introduced in M2.
   */
  download(fileId: string, options?: CallOptions): Promise<LogFile>;
}

function validateOffset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new HemValidationError('Invalid offset: must be a whole number of 0 or more', { parameter: 'offset' });
  }
  return value;
}

/** A log-file id: exactly 8 hexadecimal characters, returned in lower case. */
// implements: REQ-SYS-011
export function validateLogFileId(fileId: unknown, parameter = 'file'): string {
  if (typeof fileId !== 'string' || !LOG_FILE_ID.test(fileId)) {
    throw new HemValidationError(`Invalid ${parameter}: must be exactly 8 hexadecimal characters`, { parameter });
  }
  return fileId.toLowerCase();
}

function readList(spec: OperationSpec, r: ResponseObject): LogFileList {
  const ids = readStringArray(spec, r, 'id');
  for (const id of ids) {
    if (!/^[0-9a-f]{8}$/.test(id)) throw new HemProtocolError(`${spec.name}: response field "id" holds "${id}", not an 8-hex-character file id`, { operation: spec.name });
  }
  return { total: readInteger(spec, r, 'total'), ids };
}

/** @internal Implementation of {@link LoggerApi}. */
export class LoggerApiImpl implements LoggerApi {
  readonly #context: BindingContext;

  /** @internal */
  constructor(context: BindingContext) {
    this.#context = context;
  }

  // implements: REQ-SYS-009
  async key(options?: CallOptions): Promise<LoggerKey> {
    const spec = LOGGER_KEY;
    const r = await invoke(this.#context, spec, {}, options);
    return { key: readBase64(spec, r, 'key'), nonce: readBase64(spec, r, 'nonce'), nonceSigned: readBase64(spec, r, 'nonce_signed') };
  }

  // implements: REQ-SYS-010, REQ-API-011
  async list(params: ListLogsParams = {}, options?: CallOptions): Promise<LogFileList> {
    const offset = params?.offset === undefined ? undefined : validateOffset(params.offset);
    const spec = offset === undefined ? LOGGER_LIST : LOGGER_LIST_OFFSET;
    const values = offset === undefined ? {} : { offset: String(offset) };
    return readList(spec, await invoke(this.#context, spec, { params: values }, options));
  }

  // implements: REQ-SYS-011, REQ-API-011
  async download(fileId: string, options?: CallOptions): Promise<LogFile> {
    const id = validateLogFileId(fileId);
    const spec = LOGGER_FILE;
    let response;
    try {
      response = await invokeRaw(this.#context, spec, { params: { file: id } }, options);
    } catch (error) {
      throw unsupportedOn404(spec, error, 'there is no log file with this id');
    }
    const contentType = response.headers.get('content-type');
    return {
      id,
      bytes: response.body,
      ...(contentType === null ? {} : { contentType }),
      text: () => response.text(),
    };
  }
}
