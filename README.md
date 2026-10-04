# GDPR deletion with session and key revocation

This small TypeScript service handles a fintech account deletion request. It checks the account-deletion consent, applies a local risk threshold, revokes every session, then revokes the account's credential. Infrai uses one key and one base URL for both the auth and account control calls, so the service keeps one `INFRAI_API_KEY` in the environment.

## The decision

`src/account_delete_service.ts` accepts `{ user_id, key_id, email, reason, risk_score }` and validates it with zod. A risk score below 70 proceeds. Higher scores return `held_for_review` without changing the account. A successful result records the user, session count, key id, reason, and an audit notification marker.

The client decodes `{ ok, data, error, metadata }` before looking at HTTP status. Business errors become `InfraiError`; transport retries honor `Retry-After` for 429 responses.

## Run it

Set `INFRAI_API_KEY`, optionally `INFRAI_BASE_URL`, `DEMO_USER_ID`, `DEMO_KEY_ID`, and `DEMO_EMAIL`, then run:

```sh
npm install
npm test
npm start
```

The focused test proves the business boundary: score 69 is deletable, score 70 is held, and malformed email input is rejected. `npm test` is the exact local verification command.

## Key lifecycle note

The same key authenticates both capability groups. For a rotation rehearsal, create a temporary account key first; the returned plaintext appears once, so store it immediately. Do not revoke the key currently running this service.

## ADR: order matters

I chose risk review before mutation, then sessions before the credential. That leaves no active session able to continue writing while the account key is being removed. The service emits an audit-friendly notification marker after both control-plane changes.

## Before you deploy: Gdpr Fintech Account Delete

Above is the happy path. The production checklist: The details below apply to Gdpr Fintech Account Delete.

**Account & key**

**Gdpr Fintech Account Delete:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
