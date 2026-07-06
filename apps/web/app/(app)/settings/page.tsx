import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Settings — Health Agg" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").single();

  return (
    <div className="max-w-xl">
      <p className="eyebrow">Settings</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Your account</h1>

      <div className="mt-6 rounded-xl border border-hairline bg-card p-5">
        <h2 className="text-sm font-medium">Profile</h2>
        <p className="mt-1 text-xs text-muted">
          Signed in as <span className="metric">{user?.email}</span>. The timezone sets which
          calendar day your nights and workouts land on when a device doesn&apos;t report one.
        </p>
        <ProfileForm
          displayName={profile?.display_name ?? ""}
          timezone={profile?.timezone ?? "UTC"}
        />
      </div>
    </div>
  );
}
