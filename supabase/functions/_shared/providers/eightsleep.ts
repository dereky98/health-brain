import { InvalidGrantError } from "../connections.ts";
import type { CanonicalSleep, Provider, SyncBatch, TokenSet } from "./types.ts";

// Eight Sleep has NO official API. This uses the same reverse-engineered client
// API as lukas-clarke/eight_sleep (Home Assistant) and steipete/eightctl:
//   auth:   POST https://auth-api.8slp.net/v1/tokens  (OAuth password grant)
//   trends: GET  https://client-api.8slp.net/v1/users/{userId}/trends
// The client id/secret pair ships inside the official mobile app and is public
// in those repos. Treat this provider as best-effort: endpoints change without
// notice; failures must never affect other providers.
//
// The user's password is exchanged for tokens at connect time and NEVER stored.

const AUTH_URL = "https://auth-api.8slp.net/v1/tokens";
const CLIENT_API = "https://client-api.8slp.net/v1";

// Public credentials from the Eight Sleep Android app (see reference repos).
const DEFAULT_CLIENT_ID = "0894c7f33bb94800a03f1f4df13a4f38";
const DEFAULT_CLIENT_SECRET = "f0954a3ed5763ba3d06834c73731a32f15f168f47d4f164751275def86db0c76";

const HEADERS = {
  "content-type": "application/json",
  "user-agent": "okhttp/4.9.3",
  accept: "application/json",
};

function clientId(): string {
  return Deno.env.get("EIGHTSLEEP_CLIENT_ID") || DEFAULT_CLIENT_ID;
}
function clientSecret(): string {
  return Deno.env.get("EIGHTSLEEP_CLIENT_SECRET") || DEFAULT_CLIENT_SECRET;
}

type EightTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  userId: string;
};

async function tokenRequest(body: Record<string, string>): Promise<EightTokenResponse> {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ client_id: clientId(), client_secret: clientSecret(), ...body }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) {
      throw new InvalidGrantError(`eight sleep auth ${res.status}: ${JSON.stringify(payload).slice(0, 200)}`);
    }
    throw new Error(`eight sleep auth ${res.status}: ${JSON.stringify(payload).slice(0, 200)}`);
  }
  return payload as EightTokenResponse;
}

function toTokenSet(r: EightTokenResponse): TokenSet {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? null,
    expiresAt: new Date(Date.now() + r.expires_in * 1000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Trends payload (subset; day-level aggregates)
// ---------------------------------------------------------------------------
type Timeseries = Record<string, Array<[string, number]>>;

type TrendDay = {
  day: string; // YYYY-MM-DD (local, per tz param)
  score?: number;
  presenceStart?: string;
  presenceEnd?: string;
  presenceDuration?: number; // seconds
  sleepDuration?: number;
  lightDuration?: number;
  deepDuration?: number;
  remDuration?: number;
  tnt?: number;
  sleepQualityScore?: {
    total?: number;
    hrv?: { current?: number };
    respiratoryRate?: { current?: number };
  };
  sleepRoutineScore?: {
    latencyAsleepSeconds?: { current?: number; score?: number };
  };
  sessions?: Array<{ timeseries?: Timeseries }>;
};

function seriesStats(days: TrendDay["sessions"], key: string): { avg: number | null; min: number | null } {
  const values: number[] = [];
  for (const session of days ?? []) {
    for (const point of session.timeseries?.[key] ?? []) {
      if (typeof point[1] === "number") values.push(point[1]);
    }
  }
  if (!values.length) return { avg: null, min: null };
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { avg: Math.round(avg * 10) / 10, min: Math.min(...values) };
}

function mapDay(day: TrendDay, tz: string): CanonicalSleep | null {
  if (!day.presenceStart || !day.presenceEnd || !day.sleepDuration) return null;
  const hr = seriesStats(day.sessions, "heartRate");
  const bedTemp = seriesStats(day.sessions, "tempBedC");
  const awake =
    day.presenceDuration != null && day.sleepDuration != null
      ? Math.max(0, day.presenceDuration - day.sleepDuration)
      : null;
  return {
    external_id: day.day,
    start_at: new Date(day.presenceStart).toISOString(),
    end_at: new Date(day.presenceEnd).toISOString(),
    local_date: day.day,
    timezone: tz,
    duration_asleep_s: day.sleepDuration ?? null,
    time_in_bed_s: day.presenceDuration ?? null,
    latency_s: day.sleepRoutineScore?.latencyAsleepSeconds?.current ?? null,
    efficiency_pct:
      day.sleepDuration != null && day.presenceDuration
        ? Math.round((day.sleepDuration / day.presenceDuration) * 1000) / 10
        : null,
    stage_deep_s: day.deepDuration ?? null,
    stage_rem_s: day.remDuration ?? null,
    stage_light_s: day.lightDuration ?? null,
    stage_awake_s: awake,
    hr_avg_bpm: hr.avg,
    hr_lowest_bpm: hr.min,
    hrv_rmssd_ms: day.sleepQualityScore?.hrv?.current ?? null,
    respiratory_rate: day.sleepQualityScore?.respiratoryRate?.current ?? null,
    temp_c: bedTemp.avg,
    score: day.score ?? day.sleepQualityScore?.total ?? null,
    is_nap: false,
    raw: day,
  };
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const eightSleep: Extract<Provider, { kind: "credentials" }> = {
  slug: "eight_sleep",
  kind: "credentials",

  async login(email: string, password: string) {
    const res = await tokenRequest({ grant_type: "password", username: email, password });
    return { ...toTokenSet(res), providerUserId: res.userId };
  },

  async refreshToken(refreshToken: string) {
    return toTokenSet(await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }));
  },

  async sync(accessToken, cursor, { backfillDays }): Promise<SyncBatch> {
    const userId = cursor.userId as string | undefined;
    if (!userId) throw new Error("eight sleep cursor missing userId (reconnect required)");
    const tz = (cursor.tz as string) ?? "UTC";

    const isBackfill = cursor.since == null;
    const fromDate = isBackfill
      ? new Date(Date.now() - backfillDays * 86400_000)
      : new Date(Date.now() - 7 * 86400_000);

    const url = new URL(`${CLIENT_API}/users/${userId}/trends`);
    url.searchParams.set("tz", tz);
    url.searchParams.set("from", fmtDate(fromDate));
    url.searchParams.set("to", fmtDate(new Date()));
    url.searchParams.set("include-main", "false");
    url.searchParams.set("include-all-sessions", "true");
    url.searchParams.set("model-version", "v2");

    const res = await fetch(url, { headers: { ...HEADERS, authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`eight sleep trends ${res.status}: ${text.slice(0, 300)}`);
    }
    const payload = (await res.json()) as { days?: TrendDay[] };

    const sleep = (payload.days ?? [])
      .map((d) => mapDay(d, tz))
      .filter((s): s is CanonicalSleep => s !== null);

    return {
      sleep,
      workouts: [],
      recovery: [],
      cursor: { userId, tz, since: new Date().toISOString() },
      hasMore: false,
    };
  },
};
