import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decryptToken, ENC_KEY_VERSION, encryptToken } from "./crypto.ts";
import type { Connection, Provider, TokenSet } from "./providers/types.ts";

// Whoop and Strava rotate refresh tokens (single use). If two workers refresh
// concurrently, the loser invalidates the winner's tokens and the connection is
// bricked until re-auth. We serialize with an atomic lock column:
//   UPDATE ... SET refresh_lock_until = now()+30s
//   WHERE connection_id = ? AND (lock is null OR expired) RETURNING *
// Only the row that wins the update performs the refresh; others wait and re-read.

const LOCK_SECONDS = 30;
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

type CredentialsRow = {
  connection_id: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  enc_key_version: number;
  refresh_lock_until: string | null;
};

function privateSchema(db: SupabaseClient) {
  return db.schema("private");
}

export async function saveTokens(db: SupabaseClient, connectionId: string, tokens: TokenSet): Promise<void> {
  const { error } = await privateSchema(db)
    .from("provider_credentials")
    .upsert(
      {
        connection_id: connectionId,
        access_token_enc: await encryptToken(tokens.accessToken),
        refresh_token_enc: tokens.refreshToken ? await encryptToken(tokens.refreshToken) : null,
        expires_at: tokens.expiresAt,
        enc_key_version: ENC_KEY_VERSION,
        refresh_lock_until: null,
      },
      { onConflict: "connection_id" },
    );
  if (error) throw new Error(`saveTokens failed: ${error.message}`);
}

export async function deleteCredentials(db: SupabaseClient, connectionId: string): Promise<void> {
  const { error } = await privateSchema(db).from("provider_credentials").delete().eq("connection_id", connectionId);
  if (error) throw new Error(`deleteCredentials failed: ${error.message}`);
}

async function readCredentials(db: SupabaseClient, connectionId: string): Promise<CredentialsRow> {
  const { data, error } = await privateSchema(db)
    .from("provider_credentials")
    .select("*")
    .eq("connection_id", connectionId)
    .single();
  if (error || !data) throw new Error(`credentials missing for connection ${connectionId}`);
  return data as CredentialsRow;
}

export class ReauthRequiredError extends Error {
  constructor(provider: string) {
    super(`${provider}: refresh token rejected; user must reconnect`);
    this.name = "ReauthRequiredError";
  }
}

/**
 * Returns a valid access token for the connection, refreshing (with the
 * cross-worker lock) when it is expired or expiring within 5 minutes.
 */
export async function getValidAccessToken(
  db: SupabaseClient,
  connection: Connection,
  provider: Provider,
): Promise<string> {
  let creds = await readCredentials(db, connection.id);

  const fresh = (c: CredentialsRow) =>
    c.access_token_enc && (!c.expires_at || new Date(c.expires_at).getTime() - Date.now() > EXPIRY_MARGIN_MS);

  if (fresh(creds)) return decryptToken(creds.access_token_enc!);
  if (!creds.refresh_token_enc) throw new ReauthRequiredError(connection.provider);

  // Try to win the refresh lock (single atomic statement).
  const nowIso = new Date().toISOString();
  const lockUntil = new Date(Date.now() + LOCK_SECONDS * 1000).toISOString();
  const { data: locked, error: lockErr } = await privateSchema(db)
    .from("provider_credentials")
    .update({ refresh_lock_until: lockUntil })
    .eq("connection_id", connection.id)
    .or(`refresh_lock_until.is.null,refresh_lock_until.lt.${nowIso}`)
    .select();
  if (lockErr) throw new Error(`refresh lock failed: ${lockErr.message}`);

  if (!locked || locked.length === 0) {
    // Another worker is refreshing: wait for it to finish, then use its tokens.
    for (let i = 0; i < LOCK_SECONDS; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      creds = await readCredentials(db, connection.id);
      if (creds.refresh_lock_until === null && fresh(creds)) {
        return decryptToken(creds.access_token_enc!);
      }
    }
    throw new Error(`timed out waiting for concurrent token refresh (${connection.provider})`);
  }

  // We hold the lock: refresh, persist the new pair, release the lock.
  try {
    const refreshToken = await decryptToken(creds.refresh_token_enc);
    const tokens = await provider.refreshToken(refreshToken);
    await saveTokens(db, connection.id, tokens); // also clears the lock
    return tokens.accessToken;
  } catch (err) {
    // Release the lock so the next attempt isn't blocked for LOCK_SECONDS.
    await privateSchema(db)
      .from("provider_credentials")
      .update({ refresh_lock_until: null })
      .eq("connection_id", connection.id);
    if (err instanceof InvalidGrantError) {
      await db
        .from("provider_connections")
        .update({ status: "reauth_required", last_sync_error: "Refresh token rejected — reconnect required" })
        .eq("id", connection.id);
      throw new ReauthRequiredError(connection.provider);
    }
    throw err;
  }
}

/** Thrown by provider refreshToken() implementations on invalid_grant. */
export class InvalidGrantError extends Error {
  constructor(detail: string) {
    super(`invalid_grant: ${detail}`);
    this.name = "InvalidGrantError";
  }
}
