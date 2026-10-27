/**
 * Public entry point of the Encedo HEM client.
 *
 * @packageDocumentation
 */

// implements: REQ-API-008 — everything exported here is recorded in
// tests/surface/public-api.txt; entries may be added, never changed or removed.

/**
 * Version of the HEM REST API this library is written against.
 *
 * Compare it with the firmware version reported by the device to decide
 * whether the two are compatible.
 *
 * @since M1
 */
// implements: REQ-API-010
export const HEM_API_VERSION = '1.2.2';

export {
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
  HemRelayError,
  HemTimeoutError,
  HemTlsRequiredError,
  HemUnauthenticatedError,
  HemUnreachableError,
  HemUnsupportedError,
  HemValidationError,
} from './errors.js';
export type { HemErrorCode, HemErrorOptions } from './errors.js';

export { HemClient } from './client.js';
export type { ApprovalRequest, ApprovalRequestParams, AuthApi, RedeemApprovalParams } from './api/auth-api.js';
export { EncedoApprovalRelay, ENCEDO_NOTIFY_URL } from './relay/approval.js';
export type { ApprovalCheck, ApprovalRelay, ApprovalSubmission, EncedoApprovalRelayOptions } from './relay/approval.js';
export type { Role, SessionInfo } from './auth/session.js';
export type { Clock } from './auth/login.js';
export type { ApprovalDetails, ApprovalPoll, PendingApproval, WaitOptions } from './auth/approval.js';
export type { HemClientOptions, MobileApprovalOptions } from './client.js';
export type { CheckinResult, HealthReport, SystemApi, SystemStatus, SystemVersion } from './api/system.js';
export { EncedoCheckinRelay, ENCEDO_CHECKIN_URL } from './relay/checkin.js';
export type { CheckinRelay, EncedoCheckinRelayOptions } from './relay/checkin.js';
export type { RelayCallOptions } from './relay/http.js';
export type { CallOptions, FetchFunction } from './transport/transport.js';
export { createNodeFetch } from './transport/node-https.js';
export type { NodeFetchOptions } from './transport/node-https.js';
export type {
  CreateKeyParams,
  DeriveKeyParams,
  DescriptionMatch,
  ImportKeyParams,
  KeyDetails,
  KeyEntry,
  KeyPage,
  KeysApi,
  ListKeysParams,
  SearchKeysParams,
  UpdateKeyParams,
} from './api/keymgmt.js';
export type { KeyPeer } from './api/peer.js';
export { DERIVABLE_KEY_TYPES, IMPORTABLE_KEY_TYPES, KEY_ALGORITHMS, KEY_FLAGS, KEY_MODES, KEY_TYPES } from './api/key-type.js';
export type { DerivableKeyType, ImportableKeyType, KeyFlag, KeyMode, KeyType, KeyTypeInfo } from './api/key-type.js';
export type {
  AgreedKeyParams,
  CipherAlgorithm,
  CipherMode,
  CryptoApi,
  DecryptParams,
  EcdhParams,
  EncryptParams,
  EncryptResult,
  HashAlgorithm,
  HmacParams,
  HmacVerifyParams,
  MldsaSignature,
  MldsaSignParams,
  MldsaVerifyParams,
  MlkemDecapsParams,
  MlkemEncapsParams,
  MlkemEncapsulation,
  SignatureAlgorithm,
  SignParams,
  VerifyParams,
  WrapAlgorithm,
  WrapParams,
} from './api/crypto.js';
export {
  AES_BLOCK_BYTES,
  CIPHER_ALGORITHMS,
  HASH_ALGORITHMS,
  MAX_CONTEXT_BYTES,
  MAX_HKDF_CONTEXT_BYTES,
  MAX_MAC_BYTES,
  MLDSA_SIGNATURE_BYTES,
  MLKEM_CIPHERTEXT_BYTES,
  MLKEM_SHARED_SECRET_BYTES,
  SIGNATURE_ALGORITHMS,
} from './api/crypto.js';
