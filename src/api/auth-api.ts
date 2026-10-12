/**
 * `client.auth`: the session as seen by the caller, and the device calls of
 * mobile approval.
 *
 * @packageDocumentation
 */
import { ApprovalEngine, type ApprovalDetails, type PendingApproval, type WaitOptions } from '../auth/approval.js';
import type { Clock } from '../auth/login.js';
import type { ClockRecovery } from '../auth/recovery.js';
import type { ApprovalRelay } from '../relay/approval.js';
import type { Role, Session } from '../auth/session.js';
import { base64ToBytes } from '../codec/base64.js';
import { HemForbiddenError, HemValidationError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';
import { AUTH_EXT_REQUEST, redeemReply } from './auth.js';
import { type BindingContext, invoke, readString } from './core.js';

/** Parameters of {@link AuthApi.requestApproval}. */
export interface ApprovalRequestParams {
  /** Key provided by the approval relay, base64 of 32 bytes. */
  epk: string;
  /** Scope to ask the paired apps to approve, at most 1023 characters. */
  scope: string;
  /** Context copied into the request, 1 to 64 characters. */
  ctx?: string | undefined;
  /** Note shown to the approver, 1 to 128 characters. */
  note?: string | undefined;
}

/** The device's authorization request, opaque to the client. */
export interface ApprovalRequest {
  /** Authorization request for the paired apps. */
  readonly authreq: string;
  /** The key the request was made for. */
  readonly epk: string;
}

/** Parameters of {@link AuthApi.redeemApproval}. */
export interface RedeemApprovalParams {
  /** The paired app's reply, as delivered by the approval relay. */
  authreply: string;
  /** The scope that was requested; the token is cached under it. */
  scope: string;
}

function checkLength(value: unknown, parameter: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw new HemValidationError(`Invalid ${parameter}: must be ${min} to ${max} characters`, { parameter });
  }
  return value;
}

/** `client.auth`: role, logout, and the device calls of mobile approval. */
export interface AuthApi {
  /** The approval relay this client was configured with; `null` when approval is disabled. */
  readonly approvalRelay: ApprovalRelay | null;

  /**
   * The role the device granted, read from the `sub` claim of the most
   * recently issued token: user (`U`), master (`M`), or a paired app (any
   * other value, given as `id`). `undefined` before the first login. A
   * master session is refused by every key-management and crypto operation.
   *
   * @remarks Introduced in M1.
   */
  readonly role: Role | undefined;

  /**
   * Discard the credential and every cached token. Afterwards every
   * authenticated call raises `HemUnauthenticatedError` without contacting
   * the device; public calls keep working. Create a new client to log in
   * again.
   *
   * @remarks Token scope: none (makes no request). Introduced in M1.
   */
  logout(): void;

  /**
   * Mobile approval, device step 1: ask the device for an authorization
   * request for `scope`, addressed to the paired apps. The result is opaque
   * and is handed to the approval relay. A 403 (device clock not set) runs
   * one check-in and repeats the request once, like a login.
   *
   * Device call: `POST /api/auth/ext/request`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  requestApproval(params: ApprovalRequestParams, options?: CallOptions): Promise<ApprovalRequest>;

  /**
   * Mobile approval, device step 2: redeem a paired app's reply for a bearer
   * token. The token is cached under `scope` — the scope that was
   * requested — with the expiry from its `exp` claim, and is used by every
   * later call needing that scope. A 401 (reply invalid, expired or reused)
   * raises `HemUnauthenticatedError`; it is final, this call is never
   * retried through a login. A 406 (unknown pairing or undecryptable scope)
   * raises `HemOperationFailedError`.
   *
   * Device call: `POST /api/auth/ext/token`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  redeemApproval(params: RedeemApprovalParams, options?: CallOptions): Promise<string>;

  /**
   * Start a mobile approval of `scope`: obtain the relay's key, ask the
   * device for an authorization request (`ext/request`) and submit it to
   * the approval relay. If the broker refuses the request because the
   * device clock has drifted, one check-in runs and the sequence is
   * repeated once. Continue with {@link AuthApi.pollApproval} or
   * {@link AuthApi.waitForApproval}.
   *
   * @throws HemUnsupportedError when the client has no approval relay.
   * @remarks Token scope: none. Introduced in M1.
   */
  beginApproval(scope: string, details?: ApprovalDetails, options?: CallOptions): Promise<PendingApproval>;

  /**
   * Check once for the outcome of an approval. Approved: the reply is
   * redeemed (`ext/token`), the token cached under the requested scope and
   * returned. Rejected raises `HemApprovalRejectedError` (nothing is
   * redeemed); expired raises `HemApprovalTimeoutError`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  pollApproval(pending: PendingApproval, options?: CallOptions): Promise<{ status: 'pending' } | { status: 'approved'; token: string }>;

  /**
   * Wait for the outcome of an approval: poll every 5 seconds (`intervalMs`)
   * for up to 60 seconds (`timeoutMs`), at least once. Approved: the token
   * is cached under the requested scope and returned. Rejected raises
   * `HemApprovalRejectedError`; no answer in time, or an expired request,
   * raises `HemApprovalTimeoutError`. A network failure of one poll does not
   * end the wait; the signal does.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  waitForApproval(pending: PendingApproval, options?: WaitOptions): Promise<string>;

  /**
   * {@link AuthApi.beginApproval} followed by {@link AuthApi.waitForApproval}.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  approve(scope: string, details?: ApprovalDetails, options?: WaitOptions): Promise<string>;
}

/** @internal Implementation of {@link AuthApi}. */
export class AuthApiImpl implements AuthApi {
  readonly #session: Session;
  readonly #context: BindingContext;
  readonly #recovery: ClockRecovery;
  readonly #relay: ApprovalRelay | null;
  /** @internal The approval engine, also used by mobile login mode. */
  readonly engine: ApprovalEngine;

  /** @internal */
  constructor(session: Session, publicContext: BindingContext, recovery: ClockRecovery, relay: ApprovalRelay | null, now: Clock) {
    this.#session = session;
    this.#context = publicContext;
    this.#recovery = recovery;
    this.#relay = relay;
    this.engine = new ApprovalEngine(
      relay,
      {
        request: (params, options) => this.requestApproval(params, options),
        redeem: (authreply, options) => redeemReply(this.#context, authreply, options),
      },
      recovery,
      now,
    );
  }

  get approvalRelay(): ApprovalRelay | null {
    return this.#relay;
  }

  // implements: REQ-AUTH-010
  get role(): Role | undefined {
    return this.#session.role;
  }

  logout(): void {
    this.#session.logout();
  }

  // implements: REQ-AUTH-014
  async requestApproval(params: ApprovalRequestParams, options: CallOptions = {}): Promise<ApprovalRequest> {
    let epkBytes: Uint8Array | undefined;
    try {
      epkBytes = base64ToBytes(String(params?.epk));
    } catch {
      epkBytes = undefined;
    }
    if (typeof params?.epk !== 'string' || epkBytes?.length !== 32) {
      throw new HemValidationError('Invalid epk: must be base64 of 32 bytes', { parameter: 'epk' });
    }
    const body: Record<string, unknown> = { epk: params.epk, scope: checkLength(params.scope, 'scope', 1, 1023) };
    if (params.ctx !== undefined) body['ctx'] = checkLength(params.ctx, 'ctx', 1, 64);
    if (params.note !== undefined) body['note'] = checkLength(params.note, 'note', 1, 128);
    const spec = AUTH_EXT_REQUEST;
    const r = await this.#recovery.once(
      () => invoke(this.#context, spec, { body }, options),
      (error) => error instanceof HemForbiddenError && error.status === 403,
      options,
    );
    return { authreq: readString(spec, r, 'authreq'), epk: readString(spec, r, 'epk') };
  }

  // implements: REQ-AUTH-015
  async redeemApproval(params: RedeemApprovalParams, options?: CallOptions): Promise<string> {
    const authreply = checkLength(params?.authreply, 'authreply', 1, Number.MAX_SAFE_INTEGER);
    const scope = checkLength(params.scope, 'scope', 1, 1023);
    const token = await redeemReply(this.#context, authreply, options);
    // Without an exp claim the token is kept until the device rejects it (the 401 retry handles that).
    this.#session.store(scope, { token, requestedExp: Number.POSITIVE_INFINITY });
    return token;
  }

  // implements: REQ-AUTH-018
  beginApproval(scope: string, details?: ApprovalDetails, options?: CallOptions): Promise<PendingApproval> {
    return this.engine.begin(scope, details, options);
  }

  async pollApproval(pending: PendingApproval, options?: CallOptions): Promise<{ status: 'pending' } | { status: 'approved'; token: string }> {
    const result = await this.engine.poll(pending, options);
    if (result.status === 'approved') this.#session.store(pending.scope, { token: result.token, requestedExp: Number.POSITIVE_INFINITY });
    return result;
  }

  // implements: REQ-AUTH-018
  async waitForApproval(pending: PendingApproval, options?: WaitOptions): Promise<string> {
    const token = await this.engine.wait(pending, options);
    this.#session.store(pending.scope, { token, requestedExp: Number.POSITIVE_INFINITY });
    return token;
  }

  async approve(scope: string, details?: ApprovalDetails, options?: WaitOptions): Promise<string> {
    const pending = await this.beginApproval(scope, details, { signal: options?.signal });
    return this.waitForApproval(pending, options);
  }
}
