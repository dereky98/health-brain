import { execSync } from "node:child_process";

export type LocalEnv = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
};

let cached: LocalEnv | null = null;

/** Reads connection info for the running local Supabase stack via `supabase status`. */
export function localEnv(): LocalEnv {
  if (cached) return cached;
  const out = execSync("supabase status -o env", { encoding: "utf8" });
  const get = (name: string) => {
    const m = out.match(new RegExp(`^${name}="(.*)"$`, "m"));
    if (!m) throw new Error(`supabase status did not report ${name}; is the local stack running?`);
    return m[1];
  };
  cached = {
    apiUrl: get("API_URL"),
    anonKey: get("ANON_KEY"),
    serviceRoleKey: get("SERVICE_ROLE_KEY"),
    dbUrl: get("DB_URL"),
  };
  return cached;
}
