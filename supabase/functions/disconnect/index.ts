import { serviceClient, userFromRequest, json, corsHeaders } from "../_shared/db.ts";
import { deleteCredentials, getValidAccessToken } from "../_shared/connections.ts";
import { getProvider } from "../_shared/registry.ts";
import type { Connection } from "../_shared/providers/types.ts";

// POST /disconnect?provider=whoop  (Authorization: Bearer <user jwt>)
// Revokes access at the provider (best effort), deletes credentials, and for
// Strava also purges synced data (contractually required on disconnect).

const PURGE_DATA_PROVIDERS = new Set(["strava"]);
const DATA_TABLES = ["sleep_sessions", "workouts", "recovery_metrics"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const providerSlug = new URL(req.url).searchParams.get("provider") ?? "";
  const db = serviceClient();

  const { data: conn } = await db
    .from("provider_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", providerSlug)
    .maybeSingle();
  if (!conn) return json({ error: "not connected" }, 404);

  const provider = getProvider(providerSlug);

  // Best-effort revoke at the provider.
  if (provider.kind === "oauth") {
    try {
      const token = await getValidAccessToken(db, conn as Connection, provider);
      await provider.revoke(token);
    } catch {
      // token already dead — nothing to revoke
    }
  }

  await deleteCredentials(db, conn.id);

  if (PURGE_DATA_PROVIDERS.has(providerSlug)) {
    for (const table of DATA_TABLES) {
      await db.from(table).delete().eq("user_id", user.id).eq("provider", providerSlug);
    }
  }

  await db
    .from("provider_connections")
    .update({ status: "disconnected", last_sync_error: null })
    .eq("id", conn.id);

  return json({ disconnected: providerSlug });
});
