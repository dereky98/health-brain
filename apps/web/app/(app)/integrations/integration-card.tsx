"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { FUNCTIONS_URL, type ProviderMeta } from "@/lib/providers";
import { EightSleepConnectModal } from "./eightsleep-modal";

type ConnectionRow = {
  provider: string;
  status: "active" | "error" | "reauth_required" | "disconnected";
  last_synced_at: string | null;
  last_sync_error: string | null;
  provider_user_id: string | null;
} | null;

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("not signed in");
  return fetch(`${FUNCTIONS_URL}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${session.access_token}` },
  });
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function IntegrationCard({ meta, connection }: { meta: ProviderMeta; connection: ConnectionRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEightSleep, setShowEightSleep] = useState(false);
  const [, startTransition] = useTransition();

  const connected = connection && connection.status !== "disconnected";
  const needsReauth = connection?.status === "reauth_required";

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      if (meta.auth === "credentials") {
        setShowEightSleep(true);
        return;
      }
      const res = await authedFetch(`/oauth/start?provider=${meta.slug}&platform=web`);
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error ?? "could not start OAuth");
      window.location.href = body.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "connection failed");
    } finally {
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy("sync");
    setError(null);
    try {
      const res = await authedFetch(`/sync/now?provider=${meta.slug}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "sync failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "sync failed");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!confirm(`Disconnect ${meta.name}? ${meta.slug === "strava" ? "Your synced Strava data will be deleted." : ""}`)) return;
    setBusy("disconnect");
    setError(null);
    try {
      const res = await authedFetch(`/disconnect?provider=${meta.slug}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "disconnect failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "disconnect failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: meta.color }}
          >
            {meta.name.slice(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-medium">{meta.name}</h2>
              {meta.beta && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Beta · Unofficial
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">{meta.tagline}</p>
          </div>
        </div>
        {connected && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              needsReauth || connection!.status === "error"
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            }`}
          >
            {needsReauth ? "Reconnect needed" : connection!.status === "error" ? "Sync error" : "Connected"}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {meta.dataTypes.map((d) => (
          <span
            key={d}
            className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
          >
            {d}
          </span>
        ))}
      </div>

      {connected && connection?.last_sync_error && connection.status !== "active" && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {connection.last_sync_error}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-1 items-end justify-between">
        <span className="text-xs text-neutral-400">
          {connected && connection?.last_synced_at ? `Synced ${timeAgo(connection.last_synced_at)}` : ""}
        </span>
        <div className="flex gap-2">
          {connected ? (
            <>
              <button
                onClick={syncNow}
                disabled={busy !== null}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                {busy === "sync" ? "Syncing…" : "Sync now"}
              </button>
              {needsReauth && (
                <button
                  onClick={connect}
                  disabled={busy !== null}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  Reconnect
                </button>
              )}
              <button
                onClick={disconnect}
                disabled={busy !== null}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
              >
                {busy === "disconnect" ? "…" : "Disconnect"}
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              disabled={busy !== null}
              className="rounded-md px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: meta.color }}
            >
              {busy === "connect" ? "Opening…" : `Connect ${meta.name}`}
            </button>
          )}
        </div>
      </div>

      {showEightSleep && (
        <EightSleepConnectModal
          onClose={() => setShowEightSleep(false)}
          onConnected={() => {
            setShowEightSleep(false);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}
