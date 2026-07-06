// The pluggable provider interface. Adding a provider = one module implementing
// Provider + one enum value in the DB + a card in the integrations page.

export type ProviderSlug = "whoop" | "strava" | "eight_sleep";

export type Connection = {
  id: string;
  user_id: string;
  provider: ProviderSlug;
  provider_user_id: string | null;
  status: "active" | "error" | "reauth_required" | "disconnected";
  sync_cursor: Record<string, unknown>;
  last_synced_at: string | null;
};

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  /** ISO timestamp when the access token expires; null = non-expiring */
  expiresAt: string | null;
};

// Canonical records (already unit-normalized). `raw` keeps the provider payload.
export type CanonicalSleep = {
  external_id: string;
  start_at: string;
  end_at: string;
  local_date: string;
  timezone: string | null;
  duration_asleep_s: number | null;
  time_in_bed_s: number | null;
  latency_s: number | null;
  efficiency_pct: number | null;
  stage_deep_s: number | null;
  stage_rem_s: number | null;
  stage_light_s: number | null;
  stage_awake_s: number | null;
  hr_avg_bpm: number | null;
  hr_lowest_bpm: number | null;
  hrv_rmssd_ms: number | null;
  respiratory_rate: number | null;
  temp_c: number | null;
  score: number | null;
  is_nap: boolean;
  raw: unknown;
};

export type CanonicalWorkout = {
  external_id: string;
  start_at: string;
  end_at: string | null;
  local_date: string;
  timezone: string | null;
  sport: string;
  provider_sport: string | null;
  duration_s: number | null;
  moving_s: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  calories_kcal: number | null;
  avg_hr_bpm: number | null;
  max_hr_bpm: number | null;
  avg_power_w: number | null;
  strain: number | null;
  raw: unknown;
};

export type CanonicalRecovery = {
  external_id: string;
  local_date: string;
  recovery_score: number | null;
  hrv_rmssd_ms: number | null;
  resting_hr_bpm: number | null;
  spo2_pct: number | null;
  skin_temp_c: number | null;
  day_strain: number | null;
  day_kcal: number | null;
  raw: unknown;
};

export type SyncBatch = {
  sleep: CanonicalSleep[];
  workouts: CanonicalWorkout[];
  recovery: CanonicalRecovery[];
  /** Updated cursor to persist; null means unchanged */
  cursor: Record<string, unknown> | null;
  /** True when a backfill still has more pages to fetch */
  hasMore: boolean;
};

export type WebhookHint = {
  /** Provider-side user id, used to find the connection */
  externalUserId: string;
  eventType: string;
  /** Object to re-fetch, when the payload identifies one */
  objectId: string | null;
  isDeletion: boolean;
  isDeauthorization: boolean;
};

export type OAuthProvider = {
  kind: "oauth";
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet & { providerUserId: string; scopes: string[] }>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  /** Revoke access at the provider (best effort) */
  revoke(accessToken: string): Promise<void>;
};

export type CredentialProvider = {
  kind: "credentials";
  /** Exchange user credentials for tokens; the password is never persisted. */
  login(email: string, password: string): Promise<TokenSet & { providerUserId: string }>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
};

export type Provider = (OAuthProvider | CredentialProvider) & {
  slug: ProviderSlug;
  /**
   * Incremental sync + chunked backfill. Called with a valid access token and
   * the connection's cursor; returns canonical records and the next cursor.
   */
  sync(accessToken: string, cursor: Record<string, unknown>, opts: { backfillDays: number }): Promise<SyncBatch>;
  /** Parse + verify a webhook request into a hint (null = ignore). */
  parseWebhook?(req: Request, rawBody: string): Promise<WebhookHint | null>;
  /** Fetch a single object referenced by a webhook and canonicalize it. */
  fetchWebhookObject?(accessToken: string, hint: WebhookHint): Promise<SyncBatch | null>;
};
