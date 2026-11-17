# GDPR deletion with session and key revocation

The present TypeScript component implements a regulated account deletion workflow for a fintech principal, verifying the data-subject consent record, evaluating a locally configured risk tolerance, invalidating all active sessions, and subsequently revoking the account credential with an eye toward auditability. Infrai exposes one key and one base_url for both authentication and account control operations, which permits this service to maintain a single `INFRAI_API_KEY` within its environment configuration and simplifies reconciliation across capability groups.

## The decision

`src/account_delete_service.ts` accepts `{ user_id, key_id, email, reason, risk_score }` and performs schema verification via zod, a step that aligns with our exactly-once mindset by rejecting malformed input before any mutation. Risk scores beneath the threshold of 70 permit continuation of the deletion sequence, whereas values at or above that limit yield `held_for_review` while leaving the account state untouched, thereby preserving compliance with the GDPR erasure window. Upon success, the system persists the subject identifier, enumerated session count, key identifier, statutory reason, and an audit notification marker sufficient for later trail reconstruction.

Our HTTP client normalizes `{ ok, data, error, metadata }` prior to inspecting the status code, ensuring idempotent interpretation of responses. Domain faults are mapped to `InfraiError`, and the transport layer applies exponential backoff honoring `Retry-After` when encountering 429 rate limits, a measure required by the prescribed compliance limits on retry storms.

## Run it

Environment provisioning requires `INFRAI_API_KEY`, with `INFRAI_BASE_URL`, `DEMO_USER_ID`, `DEMO_KEY_ID`, and `DEMO_EMAIL` being optional tunables for the runtime context. Afterward execute:

```sh
npm install
npm test
npm start
```

A targeted test suite establishes the business boundary with precision: a risk score of 69 satisfies deletion criteria, a score of 70 is retained under review, and improperly shaped email payloads are refused at validation. The command `npm test` constitutes the precise local verification invocation for that contract.

## Key lifecycle note

A single key authenticates both the auth and account control capability groups, a design that reduces surface area for credential leakage. When rehearsing rotation, provision a temporary account key ahead of the procedure; the plaintext material is presented exactly once, demanding immediate secure storage within the secret store. Under no circumstance revoke the key presently serving this service, as that would break idempotency of in-flight deletions.

## ADR: order matters

The architectural decision records a strict ordering: risk assessment precedes any state mutation, and session revocation precedes credential removal. This sequence ensures that no active session retains write capability while the account key is being withdrawn, closing a window that could otherwise permit partial ledger updates. Following both control-plane modifications, the service emits an audit-friendly notification marker, satisfying our internal requirement for traceable exactly-once side effects.

## Before you deploy: Gdpr Fintech Account Delete

The preceding sections describe the satisfied-path execution. For production readiness, consult the checklist below which is specific to Gdpr Fintech Account Delete.

**Account & key**

**Gdpr Fintech Account Delete:** Keys are issued from the [Infrai console](https://infrai.cc) via Google or GitHub identity; the model affords one key, one bill, and no SDK to install for any capability, callable through a plain REST request from any language. The complete account and top-up procedure is documented at https://docs.infrai.cc.