import { createClient } from "@/lib/supabase/server";
import { PROVIDERS } from "@/lib/providers";
import { IntegrationCard } from "./integration-card";
import { FlashBanner } from "./flash-banner";

export const metadata = { title: "Integrations — Health Agg" };

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: connections } = await supabase
    .from("provider_connections")
    .select("provider, status, last_synced_at, last_sync_error, provider_user_id");

  const bySlug = new Map((connections ?? []).map((c) => [c.provider, c]));

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Connect your devices and services. Data syncs automatically every 15 minutes.
      </p>
      <FlashBanner />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map((p) => (
          <IntegrationCard key={p.slug} meta={p} connection={bySlug.get(p.slug) ?? null} />
        ))}
      </div>
    </div>
  );
}
