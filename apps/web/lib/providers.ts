export type ProviderSlug = "whoop" | "strava" | "eight_sleep";

export type ProviderMeta = {
  slug: ProviderSlug;
  name: string;
  tagline: string;
  dataTypes: string[];
  /** Brand accent for the card */
  color: string;
  auth: "oauth" | "credentials";
  beta?: boolean;
};

export const PROVIDERS: ProviderMeta[] = [
  {
    slug: "whoop",
    name: "WHOOP",
    tagline: "Recovery, strain, sleep, and workouts from your WHOOP band.",
    dataTypes: ["Sleep", "Recovery", "HRV", "Workouts", "Strain"],
    color: "#00F19F",
    auth: "oauth",
  },
  {
    slug: "strava",
    name: "Strava",
    tagline: "Runs, rides, and every activity you record on Strava.",
    dataTypes: ["Activities", "Distance", "Pace", "Elevation", "Heart rate"],
    color: "#FC5200",
    auth: "oauth",
  },
  {
    slug: "eight_sleep",
    name: "Eight Sleep",
    tagline: "Sleep stages, heart rate, and bed temperature from your Pod.",
    dataTypes: ["Sleep stages", "HR / HRV", "Respiratory rate", "Bed temperature"],
    color: "#1E40AF",
    auth: "credentials",
    beta: true,
  },
];

export const FUNCTIONS_URL =
  process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
