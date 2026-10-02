// supports: REQ-AUTH-016, REQ-AUTH-018
// An in-memory approval relay whose answers are scripted by the test.
import type { ApprovalCheck, ApprovalRelay } from "../../src/index.js";
import { encodeBase64 } from "../../src/codec/index.js";

export const RELAY_EPK = encodeBase64(Uint8Array.from({ length: 32 }, (_, i) => i + 1));

export interface MemoryRelay extends ApprovalRelay {
  submitted: { authreq: string; epk: string }[];
  checks: number;
  answers: (ApprovalCheck | Error)[];
  submitErrors: Error[];
}

export function memoryApprovalRelay(...answers: (ApprovalCheck | Error)[]): MemoryRelay {
  const r: MemoryRelay = {
    submitted: [],
    checks: 0,
    answers,
    submitErrors: [],
    async obtainKey() {
      return { epk: RELAY_EPK, exp: undefined };
    },
    async submit(req) {
      const err = r.submitErrors.shift();
      if (err) throw err;
      r.submitted.push(req);
      return `event-${r.submitted.length}`;
    },
    async check() {
      r.checks++;
      const next = r.answers.length > 1 ? r.answers.shift()! : r.answers[0] ?? { state: "pending" };
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return r;
}
