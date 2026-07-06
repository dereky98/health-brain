import type { Provider, ProviderSlug } from "./providers/types.ts";
import { whoop } from "./providers/whoop.ts";
import { strava } from "./providers/strava.ts";

const providers: Partial<Record<ProviderSlug, Provider>> = {
  whoop,
  strava,
};

export function getProvider(slug: string): Provider {
  const p = providers[slug as ProviderSlug];
  if (!p) throw new Error(`unknown provider: ${slug}`);
  return p;
}
