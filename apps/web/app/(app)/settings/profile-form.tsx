"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const COMMON_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

export function ProfileForm({ displayName, timezone }: { displayName: string; timezone: string }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezones = Array.from(
    new Set([
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...COMMON_TIMEZONES,
      timezone,
    ]),
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        display_name: (form.get("display_name") as string) || null,
        timezone: form.get("timezone") as string,
      })
      .eq("id", user!.id);
    setSaving(false);
    if (updateErr) setError(updateErr.message);
    else setSaved(true);
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div>
        <label htmlFor="display_name" className="mb-1 block text-xs font-medium text-muted">
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          defaultValue={displayName}
          className="w-full rounded-md border border-hairline bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
      </div>
      <div>
        <label htmlFor="timezone" className="mb-1 block text-xs font-medium text-muted">
          Timezone
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={timezone}
          className="w-full rounded-md border border-hairline bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-foreground px-3.5 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-xs text-recovery">Saved</span>}
      </div>
    </form>
  );
}
