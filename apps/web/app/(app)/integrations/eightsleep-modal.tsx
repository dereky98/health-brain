"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FUNCTIONS_URL } from "@/lib/providers";

export function EightSleepConnectModal({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("not signed in");
      const res = await fetch(`${FUNCTIONS_URL}/connect-eightsleep`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "connection failed");
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "connection failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-hairline bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-medium">Connect Eight Sleep</h2>
        <p className="mt-1 text-xs text-muted">
          Eight Sleep has no official API, so we sign in with your account credentials once,
          exchange them for access tokens, and never store your password.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="Eight Sleep email"
            className="w-full rounded-md border border-hairline bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Eight Sleep password"
            className="w-full rounded-md border border-hairline bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
            >
              {pending ? "Connecting…" : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
