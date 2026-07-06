import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { resolveApiKey } from "@/lib/mcp/keys";
import { serviceClient } from "@/lib/supabase/service";

// MCP server for Health Agg. Auth: personal access token ("hag_…", created on
// the Settings page) passed as `Authorization: Bearer`. The token maps to one
// user and every query below is explicitly scoped to that user id — user_id is
// never accepted as a tool argument.
//
// Register: claude mcp add --transport http health-agg https://<app>/api/mcp \
//             --header "Authorization: Bearer hag_…"

const dateArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .describe("Date in YYYY-MM-DD");

const rangeArgs = {
  start_date: dateArg.describe("Range start (YYYY-MM-DD), inclusive"),
  end_date: dateArg.describe("Range end (YYYY-MM-DD), inclusive"),
  provider: z.enum(["whoop", "strava", "eight_sleep"]).optional().describe("Filter to one provider"),
  limit: z.number().int().min(1).max(200).default(50).describe("Max rows returned"),
};

function userIdFrom(extra: { authInfo?: { extra?: Record<string, unknown> } }): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("unauthorized");
  return userId;
}

function jsonResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "get_daily_summary",
      "Unified per-day summary of sleep, recovery, and training. Returns one row per day with primary sleep (duration, score, window), recovery (score, HRV, resting HR, day strain), and workout aggregates.",
      { start_date: rangeArgs.start_date, end_date: rangeArgs.end_date },
      async (args, extra) => {
        const userId = userIdFrom(extra);
        const { data, error } = await serviceClient()
          .from("daily_summaries")
          .select("*")
          .eq("user_id", userId)
          .gte("local_date", args.start_date)
          .lte("local_date", args.end_date)
          .order("local_date");
        if (error) throw new Error(error.message);
        return jsonResult(data);
      },
    );

    const tableTools = [
      {
        name: "query_sleep",
        table: "sleep_sessions",
        description:
          "Sleep sessions (whoop + eight_sleep) with stages, HRV, respiratory rate, efficiency, and score. One night can have multiple rows when several devices reported it.",
      },
      {
        name: "query_workouts",
        table: "workouts",
        description:
          "Workouts/activities (strava + whoop) with sport, duration, distance, HR, power, calories, and strain.",
      },
      {
        name: "query_recovery",
        table: "recovery_metrics",
        description:
          "Daily recovery metrics (whoop) with recovery score, HRV, resting HR, SpO2, skin temp, and day strain.",
      },
    ] as const;

    for (const t of tableTools) {
      server.tool(t.name, t.description, rangeArgs, async (args, extra) => {
        const userId = userIdFrom(extra);
        let query = serviceClient()
          .from(t.table)
          .select("*")
          .eq("user_id", userId)
          .gte("local_date", args.start_date)
          .lte("local_date", args.end_date)
          .order("local_date", { ascending: false })
          .limit(args.limit ?? 50);
        if (args.provider) query = query.eq("provider", args.provider);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        // strip bulky raw payloads from MCP responses
        return jsonResult((data ?? []).map(({ raw: _raw, ...rest }) => rest));
      });
    }

    server.tool(
      "get_integration_status",
      "Connection status for each linked provider: status (active/error/reauth_required/disconnected), last sync time, and last sync error.",
      {},
      async (_args, extra) => {
        const userId = userIdFrom(extra);
        const { data, error } = await serviceClient()
          .from("provider_connections")
          .select("provider, status, last_synced_at, last_sync_error, created_at")
          .eq("user_id", userId);
        if (error) throw new Error(error.message);
        return jsonResult(data);
      },
    );

    server.tool(
      "sync_now",
      "Trigger an immediate data sync for the user's connected providers (optionally one provider). Returns per-provider results.",
      { provider: z.enum(["whoop", "strava", "eight_sleep"]).optional() },
      async (args, extra) => {
        const userId = userIdFrom(extra);
        const base =
          process.env.SUPABASE_FUNCTIONS_URL ??
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
        const url = new URL(`${base}/sync/now`);
        url.searchParams.set("user_id", userId);
        if (args.provider) url.searchParams.set("provider", args.provider);
        const res = await fetch(url, {
          method: "POST",
          headers: { "x-sync-secret": process.env.SYNC_SECRET ?? "" },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `sync failed (${res.status})`);
        return jsonResult(body);
      },
    );
  },
  {
    serverInfo: { name: "health-agg", version: "1.0.0" },
  },
  { basePath: "/api" },
);

const verifyToken = async (_req: Request, bearerToken?: string) => {
  if (!bearerToken) return undefined;
  const userId = await resolveApiKey(bearerToken);
  if (!userId) return undefined;
  return {
    token: bearerToken,
    scopes: ["user"],
    clientId: userId,
    extra: { userId },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
