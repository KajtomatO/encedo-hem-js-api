import { describe, expect, it } from "vitest";
import * as pkg from "../../src/index.js";
import {
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
} from "../../src/index.js";
import { errorFromStatus } from "../../src/errors.js";

const STATUS_TABLE = [
  [400, HemBadRequestError, "BAD_REQUEST"],
  [401, HemUnauthenticatedError, "UNAUTHENTICATED"],
  [403, HemForbiddenError, "FORBIDDEN"],
  [406, HemOperationFailedError, "OPERATION_FAILED"],
  [409, HemDeviceStateError, "DEVICE_STATE"],
  [412, HemOriginRejectedError, "ORIGIN_REJECTED"],
  [413, HemPayloadTooLargeError, "PAYLOAD_TOO_LARGE"],
  [418, HemTlsRequiredError, "TLS_REQUIRED"],
  [500, HemDeviceError, "DEVICE_ERROR"],
] as const;

describe("error mapping", () => {
  // verifies: REQ-API-002
  it.each(STATUS_TABLE)("maps %i to its own class", (status, Cls, code) => {
    const err = errorFromStatus(status, "keys.create");
    expect(err).toBeInstanceOf(Cls);
    expect(err).toBeInstanceOf(HemError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(code);
    expect(err.status).toBe(status);
    expect(err.operation).toBe("keys.create");
    expect(err.name).toBe(Cls.name);
  });

  // verifies: REQ-API-002
  it("gives every listed status a distinct class", () => {
    const classes = new Set(STATUS_TABLE.map(([s]) => errorFromStatus(s).constructor));
    expect(classes.size).toBe(STATUS_TABLE.length);
  });

  // verifies: REQ-API-002
  it.each([404, 410, 411, 502, 795])("maps unexpected status %i to HemDeviceError with the raw status", (status) => {
    const err = errorFromStatus(status, "system.status");
    expect(err).toBeInstanceOf(HemDeviceError);
    expect(err.status).toBe(status);
  });

  // verifies: REQ-API-003
  it.each(STATUS_TABLE)("maps %i with an empty JSON-labelled body without parsing", async (status, Cls) => {
    const res = new Response("", { status, headers: { "Content-Type": "application/json" } });
    const err = errorFromStatus(res.status, "op", await res.text());
    expect(err).toBeInstanceOf(Cls);
    expect(err.body).toBeUndefined();
    expect(err.json).toBeUndefined();
  });

  // verifies: REQ-API-003
  it("keeps a non-JSON body as raw text", () => {
    const err = errorFromStatus(406, "op", "<html>nope</html>");
    expect(err).toBeInstanceOf(HemOperationFailedError);
    expect(err.body).toBe("<html>nope</html>");
    expect(err.json).toBeUndefined();
  });

  // verifies: REQ-API-003
  it("exposes a JSON body parsed", () => {
    const err = errorFromStatus(409, "op", '{"reason":"busy"}');
    expect(err).toBeInstanceOf(HemDeviceStateError);
    expect(err.body).toBe('{"reason":"busy"}');
    expect(err.json).toEqual({ reason: "busy" });
  });
});

describe("error classes", () => {
  const ALL = [
    HemBadRequestError, HemUnauthenticatedError, HemForbiddenError, HemOperationFailedError,
    HemDeviceStateError, HemOriginRejectedError, HemPayloadTooLargeError, HemTlsRequiredError,
    HemDeviceError, HemTimeoutError, HemUnreachableError, HemAbortError, HemProtocolError,
    HemUnsupportedError, HemApprovalRejectedError, HemApprovalTimeoutError, HemRelayError,
  ];

  // verifies: REQ-API-002
  it("all extend HemError with distinct stable codes and work with instanceof", () => {
    const codes = new Set<string>();
    for (const Cls of ALL) {
      const err = new Cls("m", { operation: "op", cause: new Error("root") });
      expect(err).toBeInstanceOf(HemError);
      expect(err).toBeInstanceOf(Cls);
      expect(err.operation).toBe("op");
      expect(err.status).toBeUndefined();
      expect((err.cause as Error).message).toBe("root");
      codes.add(err.code);
    }
    const v = new HemValidationError("label", "too long");
    expect(v).toBeInstanceOf(HemError);
    expect(v.parameter).toBe("label");
    expect(v.message).toContain("label");
    codes.add(v.code);
    expect(codes.size).toBe(ALL.length + 1);
  });

  // verifies: REQ-API-002
  it("are exported from the package root", () => {
    for (const Cls of [...ALL, HemValidationError, HemError]) {
      expect((pkg as Record<string, unknown>)[Cls.name]).toBe(Cls);
    }
  });

  it("serialises to JSON with code, status and operation", () => {
    const err = errorFromStatus(403, "crypto.hmac");
    expect(JSON.parse(JSON.stringify(err))).toEqual({
      name: "HemForbiddenError",
      code: "FORBIDDEN",
      message: err.message,
      status: 403,
      operation: "crypto.hmac",
    });
  });
});
