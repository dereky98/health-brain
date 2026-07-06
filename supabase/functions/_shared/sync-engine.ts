import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getValidAccessToken, ReauthRequiredError } from "./connections.ts";
import { getProvider } from "./registry.ts";
import type { Connection, SyncBatch } from "./providers/types.ts";

const BACKFILL_DAYS = 90;
const POLL_INTERVAL_MIN = 15;
const MAX_BACKOFF_MIN = 24 * 60;
const UPSERT_CHUNK = 500;

const CONFLICT_KEY = "user_id,provider,external_id";

async function upsertBatch(db: SupabaseClient, connection: Connection, batch: SyncBatch): Promise<number> {
  let count = 0;
  const tag = { user_id: connection.user_id, provider: connection.provider };

  const tables: Array<[string, Record<string, unknown>[]]> = [
    ["sleep_sessions", batch.sleep as unknown as Record<string, unknown>[]],
    ["workouts", batch.workouts as unknown as Record<string, unknown>[]],
    ["recovery_metrics", batch.recovery as unknown as Record<string, unknown>[]],
  ];

  for (const [table, rows] of tables) {
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK).map((r) => ({ ...r, ...tag }));
      const { error } = await db.from(table).upsert(chunk, { onConflict: CONFLICT_KEY });
      if (error) throw new Error(`upsert ${table} failed: ${error.message}`);
      count += chunk.length;
    }
  }
  return count;
}

/**
 * Sync one connection: refresh token if needed, pull records, upsert, advance
 * cursor. Loops while the provider reports more pages and the deadline allows.
 */
export async function syncConnection(
  db: SupabaseClient,
  connection: Connection,
  opts: { deadline?: number } = {},
): Promise<{ upserted: number }> {
  const deadline = opts.deadline ?? Date.now() + 4 * 60_000;
  const provider = getProvider(connection.provider);

  try {
    const accessToken = await getValidAccessToken(db, connection, provider);

    let cursor = connection.sync_cursor ?? {};
    let upserted = 0;

    for (let i = 0; i < 20; i++) {
      const batch = await provider.sync(accessToken, cursor, { backfillDays: BACKFILL_DAYS });
      upserted += await upsertBatch(db, connection, batch);
      if (batch.cursor) cursor = batch.cursor;
      if (!batch.hasMore || Date.now() > deadline) break;
    }

    await db
      .from("provider_connections")
      .update({
        status: "active",
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
        sync_cursor: cursor,
        consecutive_failures: 0,
        next_sync_at: new Date(Date.now() + POLL_INTERVAL_MIN * 60_000).toISOString(),
      })
      .eq("id", connection.id);

    return { upserted };
  } catch (err) {
    await recordSyncFailure(db, connection, err);
    throw err;
  }
}

export async function recordSyncFailure(db: SupabaseClient, connection: Connection, err: unknown): Promise<void> {
  const isReauth = err instanceof ReauthRequiredError;
  const failures = (connection as unknown as { consecutive_failures?: number }).consecutive_failures ?? 0;
  const backoffMin = Math.min(2 ** failures * POLL_INTERVAL_MIN, MAX_BACKOFF_MIN);

  await db
    .from("provider_connections")
    .update({
      status: isReauth ? "reauth_required" : "error",
      last_sync_error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      consecutive_failures: failures + 1,
      next_sync_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
    })
    .eq("id", connection.id);
}

export async function loadConnection(db: SupabaseClient, id: string): Promise<Connection | null> {
  const { data } = await db.from("provider_connections").select("*").eq("id", id).maybeSingle();
  return (data as Connection) ?? null;
}

export async function findConnectionByExternalUser(
  db: SupabaseClient,
  provider: string,
  externalUserId: string,
): Promise<Connection | null> {
  const { data } = await db
    .from("provider_connections")
    .select("*")
    .eq("provider", provider)
    .eq("provider_user_id", externalUserId)
    .neq("status", "disconnected")
    .maybeSingle();
  return (data as Connection) ?? null;
}
