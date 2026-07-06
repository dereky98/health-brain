import { serviceClient, userFromRequest, json, corsHeaders } from "../_shared/db.ts";
import { saveTokens } from "../_shared/connections.ts";
import { getProvider } from "../_shared/registry.ts";
import { syncConnection, loadConnection } from "../_shared/sync-engine.ts";

// Routes (function is deployed with verify_jwt=false; auth is handled per-route):
//   GET /oauth/start?provider=whoop&platform=web|ios   (Authorization: Bearer <user jwt>)
//     -> { url } to open in a browser / ASWebAuthenticationSession
//   GET /oauth/callback?code=...&state=...             (called by the provider)
//     -> 302 to the app (web) or healthagg:// (ios)

function redirectUri(): string {
  // Locally SUPABASE_URL resolves to the internal docker host; override it.
  const base = Deno.env.get("FUNCTIONS_BASE_URL") ?? `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
  return `${base}/oauth/callback`;
}

function appUrl(): string {
  return Deno.env.get("APP_URL") ?? "http://localhost:3000";
}

async function handleStart(req: Request): Promise<Response> {
  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const providerSlug = url.searchParams.get("provider") ?? "";
  const platform = url.searchParams.get("platform") === "ios" ? "ios" : "web";

  const provider = getProvider(providerSlug);
  if (provider.kind !== "oauth") return json({ error: `${providerSlug} does not use OAuth` }, 400);

  const state = crypto.randomUUID();
  const db = serviceClient();
  const { error } = await db.schema("private").from("oauth_states").insert({
    state,
    user_id: user.id,
    provider: providerSlug,
    platform,
  });
  if (error) return json({ error: "failed to persist state" }, 500);

  return json({ url: provider.authorizeUrl(state, redirectUri()) });
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const db = serviceClient();

  const fail = (reason: string, platform = "web") => {
    const dest =
      platform === "ios"
        ? `healthagg://connect-error?reason=${encodeURIComponent(reason)}`
        : `${appUrl()}/integrations?error=${encodeURIComponent(reason)}`;
    return Response.redirect(dest, 302);
  };

  if (!code || !state) return fail("missing_code_or_state");

  // Claim the state row (single use).
  const { data: stateRow } = await db
    .schema("private")
    .from("oauth_states")
    .delete()
    .eq("state", state)
    .gt("expires_at", new Date().toISOString())
    .select()
    .maybeSingle();
  if (!stateRow) return fail("invalid_or_expired_state");

  const provider = getProvider(stateRow.provider);
  if (provider.kind !== "oauth") return fail("bad_provider", stateRow.platform);

  try {
    const result = await provider.exchangeCode(code, redirectUri());

    const { data: conn, error: connErr } = await db
      .from("provider_connections")
      .upsert(
        {
          user_id: stateRow.user_id,
          provider: stateRow.provider,
          provider_user_id: result.providerUserId,
          status: "active",
          scopes: result.scopes,
          last_sync_error: null,
          consecutive_failures: 0,
          next_sync_at: new Date().toISOString(),
          sync_cursor: {},
        },
        { onConflict: "user_id,provider" },
      )
      .select()
      .single();
    if (connErr || !conn) throw new Error(`connection upsert failed: ${connErr?.message}`);

    await saveTokens(db, conn.id, result);

    // Kick the initial backfill without blocking the redirect.
    EdgeRuntime.waitUntil(
      (async () => {
        const fresh = await loadConnection(db, conn.id);
        if (fresh) await syncConnection(db, fresh).catch((e) => console.error("backfill failed", e));
      })(),
    );

    const dest =
      stateRow.platform === "ios"
        ? `healthagg://connected?provider=${stateRow.provider}`
        : `${appUrl()}/integrations?connected=${stateRow.provider}`;
    return Response.redirect(dest, 302);
  } catch (err) {
    console.error("oauth callback failed", err);
    return fail("exchange_failed", stateRow.platform);
  }
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  const path = new URL(req.url).pathname;
  if (path.endsWith("/start")) return handleStart(req);
  if (path.endsWith("/callback")) return handleCallback(req);
  return json({ error: "not found" }, 404);
});
