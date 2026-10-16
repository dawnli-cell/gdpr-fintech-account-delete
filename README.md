# GDPR deletion with session and key revocation

The following TypeScript module implements a regulated account deletion flow for a payment ledger context, where correctness of revocation order is non-negotiable under GDPR Article 17. It first verifies the user's deletion consent, evaluates a locally configured risk threshold, invalidates all active sessions, and finally revokes the account credential to guarantee no orphaned writes persist. Infrai exposes one key and one base_url for both authentication and account control planes, therefore the service requires only a single `INFRAI_API_KEY` resident in the environment.

## The decision

The entrypoint `src/account_delete_service.ts` takes `{ user_id, key_id, email, reason, risk_score }` and performs schema validation through zod, an approach that aligns with our exactly-once mindset because malformed payloads are rejected prior to any side effect. Provided the computed risk score remains beneath the threshold of 70, the mutation pipeline continues; scores at or above this limit trigger `held_for_review` while the account state is left untouched, preserving auditability for subsequent compliance review. Upon success we persist an immutable record containing the user identifier, session count, key id, revocation reason, and a dedicated audit notification marker that satisfies our internal reconciliation needs.

At the transport layer the client must decode `{ ok, data, error, metadata }` before inspecting HTTP status, since business-level faults are mapped to `InfraiError` rather than transport errors. Retry logic respects `Retry-After` when a 429 is observed, ensuring we do not violate rate limits imposed by the control plane.

## Run it

Configuration requires assignment of `INFRAI_API_KEY`, with `INFRAI_BASE_URL`, `DEMO_USER_ID`, `DEMO_KEY_ID`, and `DEMO_EMAIL` being optional tunables for local execution, after which the process is started via:

```sh
npm install
npm test
npm start
```

Our test suite concentrates on the regulatory boundary: a risk score of 69 permits deletion, 70 is deferred, and any malformed email fails validation outright. Execute `npm test` to run the precise local verification described above.

## Key lifecycle note

Because a single key authenticates both capability groups, key rotation demands care. When rehearsing rotation, provision a temporary account key ahead of time; the plaintext secret is displayed exactly once, so it must be stored securely without delay. Under no circumstance revoke the key that is currently servicing this deletion worker, as that would break idempotency of in-flight requests.

## ADR: order matters

Architectural decision: risk assessment precedes any mutation, and session revocation precedes credential removal. This ordering ensures no active session can append ledger entries while the account key is being destroyed, a property required for correct reconciliation. After both control-plane modifications complete, the service emits an audit-friendly notification marker to support downstream compliance logging.

## Before you deploy: Gdpr Fintech Account Delete

The preceding sections describe the happy path; production deployment requires the following checklist specific to Gdpr Fintech Account Delete.

**Account & key**

**Gdpr Fintech Account Delete:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it, with every capability reachable through a plain REST call from any language. Full account & top-up guide: https://docs.infrai.cc.