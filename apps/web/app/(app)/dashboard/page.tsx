import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Health Agg" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Signed in as {user?.email}. Connect a provider on the Integrations page to start syncing
        data.
      </p>
    </div>
  );
}
