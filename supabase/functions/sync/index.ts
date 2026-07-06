import { serviceClient, userFromRequest, json, corsHeaders } from "../_shared/db.ts";
import { syncConnection } from "../_shared/sync-engine.ts";
import type { Connection } from "../_shared/providers/types.ts";

// Routes (verify_jwt=false; auth per-route):
//   POST /sync/run   — pg_cron scheduler (x-sync-secret header). Drains due connections.
//   POST /sync/now   — user-triggered (Authorization: Bearer <user jwt>). Syncs caller.

const RUN_BATCH = 25;
const RUN_BUDGET_MS = 4.5 * 60_000;

async function handleRun(req: Request): Promise<Response> {
  if (req.headers.get("x-sync-secret") !== Deno.env.get("SYNC_SECRET")) {
    return json({ error: "unauthorized" }, 401);
  }

  const db = serviceClient();
  const deadline = Date.now() + RUN_BUDGET_MS;

  const { data: due, error } = await db
    .from("provider_connections")
    .select("*")
    .in("status", ["active", "error"])
    .lte("next_sync_at", new Date().toISOString())
    .order("next_sync_at", { ascending: true })
    .limit(RUN_BATCH);
  if (error) return json({ error: error.message }, 500);

  const results: Record<string, string> = {};
  for (const conn of (due ?? []) as Connection[]) {
    if (Date.now() > deadline) break;
    try {
      const { upserted } = await syncConnection(db, conn, { deadline });
      results[conn.id] = `ok:${upserted}`;
    } catch (err) {
      results[conn.id] = `error:${err instanceof Error ? err.message.slice(0, 120) : err}`;
    }
  }

  return json({ processed: Object.keys(results).length, results });
}

async function handleNow(req: Request): Promise<Response> {
  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const providerFilter = url.searchParams.get("provider");

  const db = serviceClient();
  let query = db
    .from("provider_connections")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["active", "error"]);
  if (providerFilter) query = query.eq("provider", providerFilter);
  const { data: conns, error } = await query;
  if (error) return json({ error: error.message }, 500);
  if (!conns?.length) return json({ error: "no active connections" }, 404);

  // Simple per-user rate limit: skip connections synced within the last minute.
  const results: Record<string, string> = {};
  for (const conn of conns as Connection[]) {
    const last = (conn as unknown as { last_synced_at?: string }).last_synced_at;
    if (last && Date.now() - new Date(last).getTime() < 60_000) {
      results[conn.provider] = "skipped:recently_synced";
      continue;
    }
    try {
      const { upserted } = await syncConnection(db, conn);
      results[conn.provider] = `ok:${upserted}`;
    } catch (err) {
      results[conn.provider] = `error:${err instanceof Error ? err.message.slice(0, 120) : err}`;
    }
  }

  return json({ results });
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  const path = new URL(req.url).pathname;
  if (path.endsWith("/run")) return handleRun(req);
  if (path.endsWith("/now")) return handleNow(req);
  return json({ error: "not found" }, 404);
});
