// Providers report timezone as a UTC offset string like "-08:00" or "+05:30".

/** Local calendar date (YYYY-MM-DD) of an instant, given a UTC offset string. */
export function localDateFromOffset(instantIso: string, offset: string | undefined | null): string {
  const t = new Date(instantIso).getTime();
  return new Date(t + offsetMinutes(offset) * 60_000).toISOString().slice(0, 10);
}

export function offsetMinutes(offset: string | undefined | null): number {
  if (!offset) return 0;
  const m = offset.match(/^([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

/** We only get an offset (not an IANA zone); store it as-is for display. */
export function timezoneFromOffset(offset: string | undefined | null): string | null {
  return offset ? `UTC${offset}` : null;
}

/** Local calendar date of an instant in an IANA timezone (used when providers give a zone). */
export function localDateInZone(instantIso: string, timeZone: string): string {
  const d = new Date(instantIso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // en-CA gives YYYY-MM-DD
}
