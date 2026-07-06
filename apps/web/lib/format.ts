export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function fmtClockDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function fmtKm(meters: number | null | undefined): string {
  if (meters == null) return "—";
  return `${(meters / 1000).toFixed(meters >= 100_000 ? 0 : 1)} km`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "11:32p" — tight enough for stat cells */
export function fmtTimeCompact(iso: string | null | undefined): string {
  if (!iso) return "—";
  return fmtTime(iso).replace(" AM", "a").replace(" PM", "p").toLowerCase();
}

export function fmtDateLong(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function fmtDateShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA");
}

export const PROVIDER_LABEL: Record<string, string> = {
  whoop: "WHOOP",
  strava: "Strava",
  eight_sleep: "Eight Sleep",
};

export const SPORT_LABEL: Record<string, string> = {
  run: "Run",
  ride: "Ride",
  swim: "Swim",
  walk: "Walk",
  hike: "Hike",
  strength: "Strength",
  row: "Row",
  yoga: "Yoga",
  pilates: "Pilates",
  tennis: "Tennis",
  golf: "Golf",
  soccer: "Soccer",
  basketball: "Basketball",
  ski: "Ski",
  snowboard: "Snowboard",
  other: "Workout",
};

export function sportLabel(sport: string): string {
  return SPORT_LABEL[sport] ?? sport.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
