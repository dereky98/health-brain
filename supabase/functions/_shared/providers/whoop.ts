import { InvalidGrantError } from "../connections.ts";
import { localDateFromOffset, timezoneFromOffset } from "../time.ts";
import type {
  CanonicalRecovery,
  CanonicalSleep,
  CanonicalWorkout,
  Provider,
  SyncBatch,
  TokenSet,
  WebhookHint,
} from "./types.ts";

// Whoop API v2. Docs: https://developer.whoop.com
// - access tokens last 1h; refresh tokens are SINGLE USE (rotation handled by connections.ts)
// - rate limit: 100 req/min, 10k/day
// - webhooks: sleep/workout/recovery updated+deleted, HMAC-signed with the client secret

const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API = "https://api.prod.whoop.com/developer";

const SCOPES = [
  "read:recovery",
  "read:cycles",
  "read:workout",
  "read:sleep",
  "read:profile",
  "read:body_measurement",
  "offline",
].join(" ");

const PAGE_LIMIT = 25;
const MAX_PAGES = 12; // per endpoint per sync call; 90-day backfill fits comfortably

const KJ_TO_KCAL = 0.239006;

function clientId(): string {
  return Deno.env.get("WHOOP_CLIENT_ID") ?? "";
}
function clientSecret(): string {
  return Deno.env.get("WHOOP_CLIENT_SECRET") ?? "";
}

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      ...params,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (body?.error === "invalid_grant" || res.status === 400 || res.status === 401) {
      throw new InvalidGrantError(`whoop token endpoint ${res.status}: ${JSON.stringify(body)}`);
    }
    throw new Error(`whoop token endpoint ${res.status}: ${JSON.stringify(body)}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null,
  };
}

async function api<T>(accessToken: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`whoop ${path} ${res.status}: ${text.slice(0, 300)}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json();
}

type Paginated<T> = { records: T[]; next_token?: string | null };

async function fetchAll<T>(
  accessToken: string,
  path: string,
  startIso: string,
): Promise<T[]> {
  const out: T[] = [];
  let nextToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params: Record<string, string> = { limit: String(PAGE_LIMIT), start: startIso };
    if (nextToken) params.nextToken = nextToken;
    const res = await api<Paginated<T>>(accessToken, path, params);
    out.push(...(res.records ?? []));
    if (!res.next_token) return out;
    nextToken = res.next_token;
  }
  return out; // page cap reached; upserts are idempotent so the next poll fills gaps
}

// ---------------------------------------------------------------------------
// Whoop payload types (subset)
// ---------------------------------------------------------------------------
type WhoopSleep = {
  id: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
    };
    respiratory_rate?: number;
    sleep_performance_percentage?: number;
    sleep_efficiency_percentage?: number;
  };
};

type WhoopWorkout = {
  id: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_name?: string;
  score_state: string;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
    kilojoule?: number;
    distance_meter?: number;
    altitude_gain_meter?: number;
  };
};

type WhoopCycle = {
  id: number;
  start: string;
  end?: string;
  timezone_offset: string;
  score?: { strain?: number; kilojoule?: number };
};

type WhoopRecovery = {
  cycle_id: number;
  sleep_id: string;
  score_state: string;
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
};

const SPORT_MAP: Record<string, string> = {
  running: "run",
  cycling: "ride",
  weightlifting: "strength",
  "functional fitness": "strength",
  walking: "walk",
  hiking: "hike",
  swimming: "swim",
  rowing: "row",
  yoga: "yoga",
  pilates: "pilates",
  tennis: "tennis",
  basketball: "basketball",
  soccer: "soccer",
  golf: "golf",
  skiing: "ski",
  snowboarding: "snowboard",
};

function canonicalSport(sportName: string | undefined): string {
  if (!sportName) return "other";
  return SPORT_MAP[sportName.toLowerCase()] ?? sportName.toLowerCase().replace(/\s+/g, "_");
}

const ms = (v: number | undefined | null) => (v == null ? null : Math.round(v / 1000));

function mapSleep(s: WhoopSleep): CanonicalSleep {
  const stages = s.score?.stage_summary;
  const asleepMilli =
    stages &&
    (stages.total_light_sleep_time_milli ?? 0) +
      (stages.total_slow_wave_sleep_time_milli ?? 0) +
      (stages.total_rem_sleep_time_milli ?? 0);
  return {
    external_id: s.id,
    start_at: s.start,
    end_at: s.end,
    local_date: localDateFromOffset(s.end, s.timezone_offset),
    timezone: timezoneFromOffset(s.timezone_offset),
    duration_asleep_s: asleepMilli ? ms(asleepMilli) : null,
    time_in_bed_s: ms(stages?.total_in_bed_time_milli),
    latency_s: null,
    efficiency_pct: s.score?.sleep_efficiency_percentage ?? null,
    stage_deep_s: ms(stages?.total_slow_wave_sleep_time_milli),
    stage_rem_s: ms(stages?.total_rem_sleep_time_milli),
    stage_light_s: ms(stages?.total_light_sleep_time_milli),
    stage_awake_s: ms(stages?.total_awake_time_milli),
    hr_avg_bpm: null,
    hr_lowest_bpm: null,
    hrv_rmssd_ms: null,
    respiratory_rate: s.score?.respiratory_rate ?? null,
    temp_c: null,
    score: s.score?.sleep_performance_percentage ?? null,
    is_nap: s.nap,
    raw: s,
  };
}

function mapWorkout(w: WhoopWorkout): CanonicalWorkout {
  const durationS =
    w.end && w.start ? Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 1000) : null;
  return {
    external_id: w.id,
    start_at: w.start,
    end_at: w.end ?? null,
    local_date: localDateFromOffset(w.start, w.timezone_offset),
    timezone: timezoneFromOffset(w.timezone_offset),
    sport: canonicalSport(w.sport_name),
    provider_sport: w.sport_name ?? null,
    duration_s: durationS,
    moving_s: null,
    distance_m: w.score?.distance_meter ?? null,
    elevation_gain_m: w.score?.altitude_gain_meter ?? null,
    calories_kcal: w.score?.kilojoule != null ? Math.round(w.score.kilojoule * KJ_TO_KCAL * 10) / 10 : null,
    avg_hr_bpm: w.score?.average_heart_rate ?? null,
    max_hr_bpm: w.score?.max_heart_rate ?? null,
    avg_power_w: null,
    strain: w.score?.strain ?? null,
    raw: w,
  };
}

function mapRecovery(r: WhoopRecovery, cycle: WhoopCycle | undefined): CanonicalRecovery | null {
  if (!cycle) return null; // cycle gives us the date; without it the row is meaningless
  return {
    external_id: String(r.cycle_id),
    local_date: localDateFromOffset(cycle.start, cycle.timezone_offset),
    recovery_score: r.score?.recovery_score ?? null,
    hrv_rmssd_ms: r.score?.hrv_rmssd_milli ?? null,
    resting_hr_bpm: r.score?.resting_heart_rate ?? null,
    spo2_pct: r.score?.spo2_percentage ?? null,
    skin_temp_c: r.score?.skin_temp_celsius ?? null,
    day_strain: cycle.score?.strain ?? null,
    day_kcal: cycle.score?.kilojoule != null ? Math.round(cycle.score.kilojoule * KJ_TO_KCAL) : null,
    raw: { recovery: r, cycle },
  };
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------
export const whoop: Provider = {
  slug: "whoop",
  kind: "oauth",

  authorizeUrl(state: string, redirectUri: string): string {
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", clientId());
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state); // whoop requires >= 8 chars
    return url.toString();
  },

  async exchangeCode(code: string, redirectUri: string) {
    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    const profile = await api<{ user_id: number }>(tokens.accessToken, "/v2/user/profile/basic");
    return { ...tokens, providerUserId: String(profile.user_id), scopes: SCOPES.split(" ") };
  },

  refreshToken(refreshToken: string) {
    return tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "offline",
    });
  },

  async revoke(accessToken: string) {
    await fetch(`${API}/v2/user/access`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
  },

  async sync(accessToken, cursor, { backfillDays }): Promise<SyncBatch> {
    const since =
      typeof cursor.since === "string"
        ? cursor.since
        : new Date(Date.now() - backfillDays * 86400_000).toISOString();

    const [cycles, recoveries, sleeps, workouts] = await Promise.all([
      fetchAll<WhoopCycle>(accessToken, "/v2/cycle", since),
      fetchAll<WhoopRecovery>(accessToken, "/v2/recovery", since),
      fetchAll<WhoopSleep>(accessToken, "/v2/activity/sleep", since),
      fetchAll<WhoopWorkout>(accessToken, "/v2/activity/workout", since),
    ]);

    const cycleById = new Map(cycles.map((c) => [c.id, c]));
    const recovery: CanonicalRecovery[] = [];
    for (const r of recoveries) {
      let cycle = cycleById.get(r.cycle_id);
      if (!cycle) {
        try {
          cycle = await api<WhoopCycle>(accessToken, `/v2/cycle/${r.cycle_id}`);
        } catch {
          cycle = undefined;
        }
      }
      const mapped = mapRecovery(r, cycle);
      if (mapped) recovery.push(mapped);
    }

    return {
      sleep: sleeps.map(mapSleep),
      workouts: workouts.map(mapWorkout),
      recovery,
      // Re-fetch a 7-day overlap each poll: scores arrive late (PENDING -> SCORED)
      // and webhooks cover the realtime path. Upserts make the overlap free.
      cursor: { since: new Date(Date.now() - 7 * 86400_000).toISOString() },
      hasMore: false,
    };
  },

  async parseWebhook(req: Request, rawBody: string): Promise<WebhookHint | null> {
    const signature = req.headers.get("X-WHOOP-Signature");
    const timestamp = req.headers.get("X-WHOOP-Signature-Timestamp");
    if (!signature || !timestamp) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(clientSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + rawBody));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    if (expected !== signature) return null;

    const payload = JSON.parse(rawBody) as { user_id: number; id: string | number; type: string };
    return {
      externalUserId: String(payload.user_id),
      eventType: payload.type,
      objectId: String(payload.id),
      isDeletion: payload.type.endsWith(".deleted"),
      isDeauthorization: false,
    };
  },
};
