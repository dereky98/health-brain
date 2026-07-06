import { serviceClient, json } from "../_shared/db.ts";
import { getProvider } from "../_shared/registry.ts";
import { getValidAccessToken, deleteCredentials } from "../_shared/connections.ts";
import { findConnectionByExternalUser, syncConnection, upsertBatch } from "../_shared/sync-engine.ts";
import type { Connection, WebhookHint } from "../_shared/providers/types.ts";

// Routes (verify_jwt=false — providers can't send JWTs; each provider's
// parseWebhook verifies authenticity its own way):
//   POST /webhooks/whoop      HMAC verified against the whoop client secret
//   GET  /webhooks/strava     subscription validation (hub.challenge echo, <2s)
//   POST /webhooks/strava     events; no signature — payload treated as a hint,
//                             objects re-fetched from the API
//
// Contract: ACK fast, then do the real work via EdgeRuntime.waitUntil.
// Every event is persisted to private.webhook_events first, so a crashed
// invocation can be re-driven by the cron sweeper (processing is idempotent).

const DELETE_TABLE: Record<string, string> = {
  "sleep.deleted": "sleep_sessions",
  "workout.deleted": "workouts",
  "activity.delete": "workouts",
};

const PURGE_TABLES = ["sleep_sessions", "workouts", "recovery_metrics"];

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

    // Deauthorization (strava athlete.update with authorized=false): the API
    // agreement requires deleting the athlete's data promptly.
    if (hint.isDeauthorization) {
      for (const table of PURGE_TABLES) {
        await db.from(table).delete().eq("user_id", connection.user_id).eq("provider", providerSlug);
      }
      await deleteCredentials(db, connection.id);
      await db
        .from("provider_connections")
        .update({ status: "disconnected", last_sync_error: "Deauthorized at provider" })
        .eq("id", connection.id);
      await done("processed");
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
      // whoop recovery.deleted references a sleep UUID, not our cycle-keyed
      // row; the next poll reconciles it.
      await done("processed");
      return;
    }

    // Update events. Prefer a single-object fetch (rate-limit friendly, e.g.
    // strava); fall back to a windowed resync (whoop scores arrive in bursts).
    const provider = getProvider(providerSlug);
    if (provider.fetchWebhookObject && hint.objectId) {
      const token = await getValidAccessToken(db, connection as Connection, provider);
      const batch = await provider.fetchWebhookObject(token, hint);
      if (batch) {
        await upsertBatch(db, connection as Connection, batch);
        await db
          .from("provider_connections")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", connection.id);
        await done("processed");
        return;
      }
    }

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
  const hint = await provider.parseWebhook(req, rawBody).catch(() => null);
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

// Strava subscription validation handshake: echo hub.challenge within 2s.
function handleStravaValidation(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");
  if (mode === "subscribe" && challenge && verifyToken === Deno.env.get("STRAVA_VERIFY_TOKEN")) {
    return json({ "hub.challenge": challenge });
  }
  return json({ error: "verification failed" }, 403);
}

Deno.serve((req) => {
  const path = new URL(req.url).pathname;
  if (path.endsWith("/whoop") && req.method === "POST") return handleProviderWebhook(req, "whoop");
  if (path.endsWith("/strava") && req.method === "GET") return handleStravaValidation(req);
  if (path.endsWith("/strava") && req.method === "POST") return handleProviderWebhook(req, "strava");
  return json({ error: "not found" }, 404);
});
