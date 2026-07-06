import { InvalidGrantError } from "../connections.ts";
import type {
  CanonicalWorkout,
  Provider,
  SyncBatch,
  TokenSet,
  WebhookHint,
} from "./types.ts";

// Strava API v3. Docs: https://developers.strava.com
// - access tokens last 6h; refresh tokens ROTATE on every refresh
// - webhooks: activity create/update/delete + athlete deauth; NO signature —
//   we validate the subscription id and re-fetch objects from the API
// - rate limits are tight (100 reads/15min default): webhook processing
//   fetches single activities instead of resyncing
// - API agreement: data shown only to the owning user; delete on deauth

const AUTH_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

const PER_PAGE = 100;
const MAX_PAGES = 10;

function clientId(): string {
  return Deno.env.get("STRAVA_CLIENT_ID") ?? "";
}
function clientSecret(): string {
  return Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";
}

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  athlete?: { id: number };
};

async function tokenRequest(params: Record<string, string>): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) {
      throw new InvalidGrantError(`strava token endpoint ${res.status}: ${JSON.stringify(body)}`);
    }
    throw new Error(`strava token endpoint ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as StravaTokenResponse;
}

function toTokenSet(r: StravaTokenResponse): TokenSet {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: new Date(r.expires_at * 1000).toISOString(),
  };
}

async function api<T>(accessToken: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`strava ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// SummaryActivity subset — https://developers.strava.com/docs/reference/#api-models-SummaryActivity
type StravaActivity = {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date: string; // UTC instant
  start_date_local: string; // local wall time rendered with Z suffix
  timezone?: string; // "(GMT-08:00) America/Los_Angeles"
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  calories?: number; // detailed activity only
};

const SPORT_MAP: Record<string, string> = {
  run: "run",
  trailrun: "run",
  virtualrun: "run",
  ride: "ride",
  mountainbikeride: "ride",
  gravelride: "ride",
  virtualride: "ride",
  emountainbikeride: "ride",
  ebikeride: "ride",
  swim: "swim",
  walk: "walk",
  hike: "hike",
  weighttraining: "strength",
  workout: "other",
  crossfit: "strength",
  rowing: "row",
  virtualrow: "row",
  yoga: "yoga",
  pilates: "pilates",
  tennis: "tennis",
  golf: "golf",
  soccer: "soccer",
  alpineski: "ski",
  backcountryski: "ski",
  nordicski: "ski",
  snowboard: "snowboard",
};

function canonicalSport(sportType: string | undefined): string {
  if (!sportType) return "other";
  return SPORT_MAP[sportType.toLowerCase()] ?? sportType.toLowerCase();
}

function ianaZone(tz: string | undefined): string | null {
  // "(GMT-08:00) America/Los_Angeles" -> "America/Los_Angeles"
  const m = tz?.match(/\)\s*(.+)$/);
  return m ? m[1] : null;
}

function mapActivity(a: StravaActivity): CanonicalWorkout {
  const endAt =
    a.elapsed_time != null
      ? new Date(new Date(a.start_date).getTime() + a.elapsed_time * 1000).toISOString()
      : null;
  return {
    external_id: String(a.id),
    start_at: a.start_date,
    end_at: endAt,
    // start_date_local is the local wall time with a fake Z suffix — its date
    // part IS the local date
    local_date: a.start_date_local.slice(0, 10),
    timezone: ianaZone(a.timezone),
    sport: canonicalSport(a.sport_type ?? a.type),
    provider_sport: a.sport_type ?? a.type ?? null,
    duration_s: a.elapsed_time ?? null,
    moving_s: a.moving_time ?? null,
    distance_m: a.distance ?? null,
    elevation_gain_m: a.total_elevation_gain ?? null,
    calories_kcal: a.calories ?? null,
    avg_hr_bpm: a.average_heartrate ?? null,
    max_hr_bpm: a.max_heartrate ?? null,
    avg_power_w: a.average_watts ?? null,
    strain: null,
    raw: a,
  };
}

export const strava: Provider = {
  slug: "strava",
  kind: "oauth",

  authorizeUrl(state: string, redirectUri: string): string {
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", clientId());
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "read,activity:read_all");
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code: string, _redirectUri: string) {
    const res = await tokenRequest({ grant_type: "authorization_code", code });
    if (!res.athlete?.id) throw new Error("strava token response missing athlete id");
    return {
      ...toTokenSet(res),
      providerUserId: String(res.athlete.id),
      scopes: ["read", "activity:read_all"],
    };
  },

  async refreshToken(refreshToken: string) {
    return toTokenSet(await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }));
  },

  async revoke(accessToken: string) {
    // June 2026: /oauth/revoke replaces /oauth/deauthorize; try both.
    const attempt = (path: string) =>
      fetch(`https://www.strava.com/oauth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: accessToken }),
      });
    const res = await attempt("revoke").catch(() => null);
    if (!res || res.status === 404) await attempt("deauthorize").catch(() => {});
  },

  async sync(accessToken, cursor, { backfillDays }): Promise<SyncBatch> {
    const after =
      typeof cursor.after === "number"
        ? cursor.after
        : Math.floor((Date.now() - backfillDays * 86400_000) / 1000);

    const activities: StravaActivity[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await api<StravaActivity[]>(accessToken, "/athlete/activities", {
        after: String(after),
        page: String(page),
        per_page: String(PER_PAGE),
      });
      activities.push(...batch);
      if (batch.length < PER_PAGE) break;
    }

    return {
      sleep: [],
      workouts: activities.map(mapActivity),
      recovery: [],
      // 7-day overlap: title/type edits arrive via webhook, this is the safety net
      cursor: { after: Math.floor(Date.now() / 1000) - 7 * 86400 },
      hasMore: false,
    };
  },

  // Strava sends no signature; authenticity = subscription id match + the fact
  // that we re-fetch everything from the API rather than trusting the payload.
  async parseWebhook(_req: Request, rawBody: string): Promise<WebhookHint | null> {
    let payload: {
      object_type?: string;
      aspect_type?: string;
      object_id?: number;
      owner_id?: number;
      subscription_id?: number;
      updates?: Record<string, unknown>;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return null;
    }
    if (!payload.owner_id || !payload.object_type) return null;

    const expectedSub = Deno.env.get("STRAVA_SUBSCRIPTION_ID");
    if (expectedSub && String(payload.subscription_id) !== expectedSub) return null;

    const isDeauth =
      payload.object_type === "athlete" && payload.updates?.authorized === "false";

    return {
      externalUserId: String(payload.owner_id),
      eventType: `${payload.object_type}.${payload.aspect_type}`,
      objectId: payload.object_id != null ? String(payload.object_id) : null,
      isDeletion: payload.object_type === "activity" && payload.aspect_type === "delete",
      isDeauthorization: isDeauth,
    };
  },

  async fetchWebhookObject(accessToken, hint): Promise<SyncBatch | null> {
    if (!hint.objectId || hint.eventType.startsWith("athlete")) return null;
    const activity = await api<StravaActivity>(accessToken, `/activities/${hint.objectId}`);
    return { sleep: [], workouts: [mapActivity(activity)], recovery: [], cursor: null, hasMore: false };
  },
};
