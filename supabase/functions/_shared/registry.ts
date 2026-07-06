import type { Provider, ProviderSlug } from "./providers/types.ts";
import { whoop } from "./providers/whoop.ts";
import { strava } from "./providers/strava.ts";
import { eightSleep } from "./providers/eightsleep.ts";

const providers: Partial<Record<ProviderSlug, Provider>> = {
  whoop,
  strava,
  eight_sleep: eightSleep,
};

export function getProvider(slug: string): Provider {
  const p = providers[slug as ProviderSlug];
  if (!p) throw new Error(`unknown provider: ${slug}`);
  return p;
}
