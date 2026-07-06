import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { serviceClient } from "@/lib/supabase/service";

export function hashKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateKey(): { token: string; hash: string; prefix: string } {
  const token = `hag_${randomBytes(24).toString("base64url")}`;
  return { token, hash: hashKey(token), prefix: token.slice(0, 12) };
}

/** Resolve a bearer token to a user id; touches last_used_at. Null if invalid/revoked. */
export async function resolveApiKey(token: string): Promise<string | null> {
  if (!token.startsWith("hag_")) return null;
  const db = serviceClient();
  const { data } = await db
    .schema("private")
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", hashKey(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  await db
    .schema("private")
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return data.user_id;
}
