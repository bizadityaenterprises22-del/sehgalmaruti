/* Dates are dd-mm-yyyy, latest first, always IST (Ravi's standing law). */

const IST = "Asia/Kolkata";

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("day")}-${g("month")}-${g("year")} ${g("hour")}:${g("minute")}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** "HH:MM" wall clock in IST for a date (used for the night-charge test). */
export function clockIst(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** yyyy-mm-dd of today in IST (for filters). */
export function todayIst(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** ISO instants that bound one IST calendar day (start inclusive, end exclusive). */
export function istDayRange(yyyymmdd: string): { start: string; end: string } {
  const start = new Date(`${yyyymmdd}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function fmtDateDMY(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  return y && m && d ? `${d}-${m}-${y}` : yyyymmdd;
}
