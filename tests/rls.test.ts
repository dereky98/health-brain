import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { localEnv } from "./local-env";

const env = localEnv();
const admin = createClient(env.apiUrl, env.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "test-password-123!";

async function createUserWithData(email: string): Promise<User> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const user = data.user;

  const { error: connErr } = await admin.from("provider_connections").insert({
    user_id: user.id,
    provider: "whoop",
    provider_user_id: `whoop-${email}`,
  });
  if (connErr) throw connErr;

  const { error: sleepErr } = await admin.from("sleep_sessions").insert({
    user_id: user.id,
    provider: "whoop",
    external_id: `sleep-${email}`,
    start_at: "2026-07-04T22:00:00Z",
    end_at: "2026-07-05T06:00:00Z",
    local_date: "2026-07-05",
    duration_asleep_s: 7 * 3600,
    score: 85,
    raw: {},
  });
  if (sleepErr) throw sleepErr;

  const { error: workoutErr } = await admin.from("workouts").insert({
    user_id: user.id,
    provider: "whoop",
    external_id: `workout-${email}`,
    start_at: "2026-07-04T10:00:00Z",
    local_date: "2026-07-04",
    sport: "run",
    raw: {},
  });
  if (workoutErr) throw workoutErr;

  const { error: recoveryErr } = await admin.from("recovery_metrics").insert({
    user_id: user.id,
    provider: "whoop",
    external_id: `recovery-${email}`,
    local_date: "2026-07-05",
    recovery_score: 70,
    raw: {},
  });
  if (recoveryErr) throw recoveryErr;

  return user;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(env.apiUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

let alice: User;
let bob: User;
let aliceClient: SupabaseClient;

const run = Date.now();
const aliceEmail = `alice-${run}@test.local`;
const bobEmail = `bob-${run}@test.local`;

beforeAll(async () => {
  alice = await createUserWithData(aliceEmail);
  bob = await createUserWithData(bobEmail);
  aliceClient = await signIn(aliceEmail);
});

describe("RLS isolation", () => {
  const tables = ["sleep_sessions", "workouts", "recovery_metrics", "provider_connections"] as const;

  for (const table of tables) {
    it(`${table}: user sees only their own rows`, async () => {
      const { data, error } = await aliceClient.from(table).select("user_id");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((r) => r.user_id === alice.id)).toBe(true);
    });

    it(`${table}: direct query for another user's rows returns nothing`, async () => {
      const { data, error } = await aliceClient.from(table).select("*").eq("user_id", bob.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  }

  it("profiles: auto-created by signup trigger, own row only", async () => {
    const { data, error } = await aliceClient.from("profiles").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(alice.id);
  });

  it("clients cannot insert health data", async () => {
    const { error } = await aliceClient.from("sleep_sessions").insert({
      user_id: alice.id,
      provider: "whoop",
      external_id: "forged",
      start_at: "2026-07-04T22:00:00Z",
      end_at: "2026-07-05T06:00:00Z",
      local_date: "2026-07-05",
      raw: {},
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501"); // insufficient_privilege (no insert policy)
  });

  it("clients cannot update another user's profile", async () => {
    const { data, error } = await aliceClient
      .from("profiles")
      .update({ display_name: "hacked" })
      .eq("id", bob.id)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // no visible rows to update

    const { data: bobProfile } = await admin.from("profiles").select("display_name").eq("id", bob.id).single();
    expect(bobProfile!.display_name).not.toBe("hacked");
  });

  it("clients can update their own timezone", async () => {
    const { error } = await aliceClient
      .from("profiles")
      .update({ timezone: "America/Los_Angeles" })
      .eq("id", alice.id);
    expect(error).toBeNull();
    const { data } = await aliceClient.from("profiles").select("timezone").single();
    expect(data!.timezone).toBe("America/Los_Angeles");
  });

  it("private schema is not reachable through the API", async () => {
    const { error } = await aliceClient.schema("private" as never).from("provider_credentials").select("*");
    expect(error).not.toBeNull();
  });

  it("anonymous clients see nothing", async () => {
    const anon = createClient(env.apiUrl, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const table of tables) {
      const { data, error } = await anon.from(table).select("*");
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    }
  });
});
