# Health-Agg Architecture

Multi-user health data aggregator: Whoop (API v2), Strava, Eight Sleep (unofficial) → unified
Supabase backend → Next.js web + SwiftUI iOS + MCP server for Claude.

## Principles

- **All provider logic lives in Supabase Edge Functions** (Deno). Next.js is a pure frontend;
  web and iOS share the identical backend surface.
- **Clients read Postgres directly** (supabase-js / supabase-swift) under RLS. Clients have
  no write policies — all health-data writes go through Edge Functions with the service role.
- **Tokens** are encrypted app-layer (AES-256-GCM, key in function secrets) and stored in the
  `private` schema, which is never exposed through PostgREST.
- **Providers are pluggable**: one Deno module per provider in
  `supabase/functions/_shared/providers/` implementing
  `authorizeUrl / exchangeCode / refreshToken / sync / parseWebhook`.

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js App Router: dashboard, sleep/recovery/activity, integrations, settings, `/api/mcp` |
| `apps/ios/HealthAgg` | SwiftUI app (supabase-swift) |
| `supabase/migrations` | Schema: canonical tables + `private` schema + RLS + pg_cron |
| `supabase/functions` | `oauth`, `connect-eightsleep`, `webhooks`, `sync`, `disconnect`, `_shared` |
| `packages/types` | Generated `database.types.ts` (web only; iOS uses hand-written Codable models) |

## Data model (canonical units at ingest)

`sleep_sessions`, `workouts`, `recovery_metrics` — each keyed
`UNIQUE (user_id, provider, external_id)` with a lossless `raw jsonb` payload; seconds/meters/°C/bpm;
`local_date` computed from provider timezone (sleep = local date of `end_at`).
`daily_summaries` is a `security_invoker` view. `provider_connections` tracks status + sync cursor;
`private.provider_credentials` holds encrypted tokens with a refresh lock (Whoop/Strava rotate
refresh tokens — single use).

## Ingestion

- Webhooks (Whoop HMAC-verified; Strava incl. `hub.challenge` + deauth) land in
  `private.webhook_events` (durable inbox), ACK immediately, process via `EdgeRuntime.waitUntil()`.
- pg_cron every 15 min → `sync/run`: due connections (`next_sync_at`), provider `sync(cursor)`,
  exponential backoff on failure, webhook-event drain. Eight Sleep is poll-only.
- Backfill on connect: chunked, cursor-resumable.
- Strava deauth ⇒ delete that user's Strava data (contractual).

See the full plan in `docs/` history / original design notes.
