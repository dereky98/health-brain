import { serviceClient, json } from "../_shared/db.ts";
import { getProvider } from "../_shared/registry.ts";
import { findConnectionByExternalUser, syncConnection } from "../_shared/sync-engine.ts";
import type { Connection, WebhookHint } from "../_shared/providers/types.ts";

// Routes (verify_jwt=false — providers can't send JWTs; each provider's
// parseWebhook verifies authenticity its own way):
//   POST /webhooks/whoop    (HMAC verified against the client secret)
//   GET|POST /webhooks/strava  (added in M3)
//
// Contract: ACK fast, then do the real work via EdgeRuntime.waitUntil.
// Every event is persisted to private.webhook_events first, so a crashed
// invocation can be re-driven by the cron sweeper (processing is idempotent).

const DELETE_TABLE: Record<string, string> = {
  "sleep.deleted": "sleep_sessions",
  "workout.deleted": "workouts",
};

async function processEvent(eventId: number, providerSlug: string, hint: WebhookHint): Promise<void> {
  const db = serviceClient();
  const done = async (status: string, error?: string) => {
    await db
      .schema("private")
      .from("webhook_events")
      .update({ status, last_error: error ?? null, processed_at: new Date().toISOString() })
      .eq("id", eventId);
  };

  try {
    const connection = await findConnectionByExternalUser(db, providerSlug, hint.externalUserId);
    if (!connection) {
      await done("skipped", "no matching connection");
      return;
    }

    if (hint.isDeletion) {
      const table = DELETE_TABLE[hint.eventType];
      if (table && hint.objectId) {
        await db
          .from(table)
          .delete()
          .eq("user_id", connection.user_id)
          .eq("provider", providerSlug)
          .eq("external_id", hint.objectId);
      }
      // recovery.deleted references a sleep UUID, not our cycle-keyed row; the
      // next poll reconciles it.
      await done("processed");
      return;
    }

    // Update events: pull the recent window (covers the referenced object and
    // any late-scored siblings). Simpler and more robust than per-object fetch.
    await syncConnection(db, connection as Connection);
    await done("processed");
  } catch (err) {
    await done("failed", err instanceof Error ? err.message.slice(0, 500) : String(err));
  }
}

async function handleProviderWebhook(req: Request, providerSlug: string): Promise<Response> {
  const provider = getProvider(providerSlug);
  if (!provider.parseWebhook) return json({ error: "webhooks not supported" }, 400);

  const rawBody = await req.text();
  const hint = await provider.parseWebhook(req, rawBody);
  if (!hint) return json({ error: "invalid signature or payload" }, 401);

  const db = serviceClient();
  const { data: event, error } = await db
    .schema("private")
    .from("webhook_events")
    .insert({
      provider: providerSlug,
      event_type: hint.eventType,
      external_user_id: hint.externalUserId,
      payload: JSON.parse(rawBody),
    })
    .select("id")
    .single();
  if (error) return json({ error: "failed to persist event" }, 500);

  EdgeRuntime.waitUntil(processEvent(event.id, providerSlug, hint));
  return json({ received: true });
}

Deno.serve((req) => {
  const path = new URL(req.url).pathname;
  if (path.endsWith("/whoop") && req.method === "POST") return handleProviderWebhook(req, "whoop");
  return json({ error: "not found" }, 404);
});
