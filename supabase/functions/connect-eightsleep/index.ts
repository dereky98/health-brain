import { serviceClient, userFromRequest, json, corsHeaders } from "../_shared/db.ts";
import { saveTokens } from "../_shared/connections.ts";
import { eightSleep } from "../_shared/providers/eightsleep.ts";
import { syncConnection, loadConnection } from "../_shared/sync-engine.ts";

// POST /connect-eightsleep  { email, password }  (Authorization: Bearer <user jwt>)
// Exchanges the credentials for tokens against the unofficial Eight Sleep auth
// API and stores ONLY the tokens (encrypted). The password is never persisted.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  if (!body.email || !body.password) return json({ error: "email and password required" }, 400);

  const db = serviceClient();

  try {
    const result = await eightSleep.login(body.email, body.password);

    const { data: profile } = await db.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
    const tz = profile?.timezone ?? "UTC";

    const { data: conn, error: connErr } = await db
      .from("provider_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "eight_sleep",
          provider_user_id: result.providerUserId,
          status: "active",
          scopes: null,
          last_sync_error: null,
          consecutive_failures: 0,
          next_sync_at: new Date().toISOString(),
          sync_cursor: { userId: result.providerUserId, tz },
        },
        { onConflict: "user_id,provider" },
      )
      .select()
      .single();
    if (connErr || !conn) throw new Error(`connection upsert failed: ${connErr?.message}`);

    await saveTokens(db, conn.id, result);

    EdgeRuntime.waitUntil(
      (async () => {
        const fresh = await loadConnection(db, conn.id);
        if (fresh) await syncConnection(db, fresh).catch((e) => console.error("backfill failed", e));
      })(),
    );

    return json({ connected: "eight_sleep" });
  } catch (err) {
    console.error("eight sleep connect failed", err);
    const message =
      err instanceof Error && err.name === "InvalidGrantError"
        ? "Eight Sleep rejected those credentials"
        : "Could not reach Eight Sleep — try again later";
    return json({ error: message }, 400);
  }
});
