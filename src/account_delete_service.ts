import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const deletionRequest = z.object({ user_id: z.string().min(1), key_id: z.string().min(1), email: z.string().email(), reason: z.string().min(1), risk_score: z.number().min(0).max(100).default(0) });
export type DeletionRequest = z.infer<typeof deletionRequest>;
type Session = { id: string };
type SessionList = { items: Session[] };

export function shouldDelete(score: number): boolean { return score < 70; }

export async function deleteFintechAccount(input: unknown, client = new InfraiClient()) {
  const request = deletionRequest.parse(input);
  await client.request(`/v1/auth/consent/check/${encodeURIComponent(request.user_id)}/account_deletion`, "GET");
  if (!shouldDelete(request.risk_score)) return { status: "held_for_review", user_id: request.user_id, risk_score: request.risk_score };
  const { items: sessions } = await client.request<SessionList>(`/v1/auth/session/list_for_user/${encodeURIComponent(request.user_id)}`, "GET");
  for (const session of sessions) await client.request(`/v1/auth/session/revoke/${encodeURIComponent(session.id)}`, "POST");
  await client.request(`/v1/account/keys/revoke/${encodeURIComponent(request.key_id)}`, "DELETE");
  return { status: "deleted", user_id: request.user_id, revoked_sessions: sessions.length, revoked_key: request.key_id, audit: { reason: request.reason, notification: "account_deleted" } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = { user_id: process.env.DEMO_USER_ID ?? "user_123", key_id: process.env.DEMO_KEY_ID ?? "key_temp", email: process.env.DEMO_EMAIL ?? "owner@example.com", reason: "GDPR request" };
  deleteFintechAccount(input).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
}
