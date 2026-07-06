"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { generateKey } from "@/lib/mcp/keys";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  return user.id;
}

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const userId = await requireUserId();
  const { data, error } = await serviceClient()
    .schema("private")
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as ApiKeyRow[];
}

/** Creates a key and returns the full token — shown exactly once. */
export async function createApiKey(name: string): Promise<{ token: string }> {
  const userId = await requireUserId();
  const trimmed = name.trim().slice(0, 60) || "Claude";
  const { token, hash, prefix } = generateKey();
  const { error } = await serviceClient().schema("private").from("api_keys").insert({
    user_id: userId,
    name: trimmed,
    key_hash: hash,
    key_prefix: prefix,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return { token };
}

export async function revokeApiKey(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await serviceClient()
    .schema("private")
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
