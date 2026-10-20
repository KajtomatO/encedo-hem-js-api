---
id: REQ-AUTH-018
title: Approval attempts end as approved, rejected or timed out
status: needs-reverify
priority: must
revision: 4
source: start_point §3; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-014", "REQ-AUTH-015", "REQ-AUTH-016"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval"]
---

# Approval attempts end as approved, rejected or timed out

The approval engine SHALL end every approval attempt in exactly one of three
distinguishable outcomes: approved, rejected, or timed out.

The engine has three operations. Begin obtains the relay key, calls
`ext/request` and submits the result to the relay. Poll performs one check
and, on approval, redeems the reply through `ext/token`. Wait polls every 5
seconds until an outcome or the time limit (default 60 seconds), with at
least one poll.

**Rationale:** A person may approve, refuse, or simply not look at the
phone. The consumer has to treat those differently: proceed, stop, or ask
again. Introduced in M1.

**Acceptance criteria:**
- [x] Approved: the token is cached under the requested scope and the wait
      resolves.
- [x] Rejected: `HemApprovalRejectedError` is raised and `ext/token` is
      never called.
- [x] No answer within the limit, or the relay reporting the request as
      expired: `HemApprovalTimeoutError`.
- [x] A transport error during one poll does not end the wait.
- [x] An `AbortSignal` cancels the wait.
- [x] (M1B) attended: approving, rejecting and ignoring the request on the
      real phone produce the three outcomes — 2026-10-20 [device]: approved
      after 9 s, `HemApprovalRejectedError` after 5 s, `HemApprovalTimeoutError`
      61 s after the submit with a 60 s limit. Observed 2026-10-12: the Encedo
      app shows a push for a scope it does not know (`keymgmt:search`) as
      unknown and offers no reject, so such a wait always times out; the
      attended test uses `keymgmt:list` for all three outcomes.
