import assert from "node:assert/strict";
import { shouldDelete, deletionRequest, deleteFintechAccount } from "./account_delete_service.js";
import { InfraiClient } from "./infrai_client.js";
assert.equal(shouldDelete(69), true);
assert.equal(shouldDelete(70), false);
assert.throws(() => deletionRequest.parse({ user_id: "u", key_id: "k", email: "bad", reason: "r" }));
const calls: string[] = [];
const client = {
  async request(path: string) {
    calls.push(path);
    if (path.includes("list_for_user")) return { items: [{ id: "session_1" }] };
    return {};
  },
} as InfraiClient;
const result = await deleteFintechAccount({ user_id: "u", key_id: "k", email: "owner@example.com", reason: "r" }, client);
assert.equal(result.revoked_sessions, 1);
assert.deepEqual(calls, [
  "/v1/auth/consent/check/u/account_deletion",
  "/v1/auth/session/list_for_user/u",
  "/v1/auth/session/revoke/session_1",
  "/v1/account/keys/revoke/k",
]);
console.log("account deletion decision tests passed");
