/*
  Money for a pick & drop trip. PURE - no imports, no time zone surprises, fully tested.

  amount = base_fare
         + per_km x km x (round_trip_factor when the trip is a round trip)
         + waiting_per_hour x waiting_minutes / 60
  then x (1 + night_pct / 100) when the trip STARTED inside the night window,
  then never below min_charge. Rounded to the paisa.

  The rate card is the admin's input, entered once per location in the Admin pack
  (Ravi, 05-09-2026). The card used is SNAPSHOTTED onto the trip, so a later rate
  change never rewrites yesterday's money.
*/

export interface RateInputs {
  per_km: number;
  base_fare?: number | null;
  min_charge?: number | null;
  waiting_per_hour?: number | null;
  night_pct?: number | null;
  night_from?: string | null; // "22:00"
  night_to?: string | null; // "06:00"
  round_trip_factor?: number | null;
}

export interface AmountOptions {
  waitingMinutes?: number;
  kind?: "pickup" | "drop" | "round";
  /** local wall-clock time of the trip start, "HH:MM"; omit = not night */
  startClock?: string | null;
}

export interface AmountBreakdown {
  km: number;
  per_km: number;
  distance_charge: number;
  base_fare: number;
  waiting_minutes: number;
  waiting_charge: number;
  round_trip_factor: number;
  night: boolean;
  night_pct: number;
  min_charge: number;
  min_applied: boolean;
  amount: number;
}

const n = (v: number | null | undefined, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const r2 = (v: number): number => Math.round(v * 100) / 100;

const toMinutes = (hhmm: string | null | undefined): number | null => {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]),
    mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
};

/** True when `clock` falls inside [from, to), wrapping midnight when from > to. */
export function isNight(clock: string | null | undefined, from: string | null | undefined, to: string | null | undefined): boolean {
  const c = toMinutes(clock),
    f = toMinutes(from ?? "22:00"),
    t = toMinutes(to ?? "06:00");
  if (c === null || f === null || t === null) return false;
  if (f === t) return false;
  return f < t ? c >= f && c < t : c >= f || c < t;
}

export function computeAmount(rate: RateInputs, km: number, opts: AmountOptions = {}): AmountBreakdown {
  const distance = Math.max(0, n(km));
  const perKm = Math.max(0, n(rate.per_km));
  const factor = opts.kind === "round" ? Math.max(1, n(rate.round_trip_factor, 1)) : 1;
  const base = Math.max(0, n(rate.base_fare));
  const waitMin = Math.max(0, Math.round(n(opts.waitingMinutes)));
  const waitCharge = r2((Math.max(0, n(rate.waiting_per_hour)) * waitMin) / 60);
  const distanceCharge = r2(perKm * distance * factor);
  const night = isNight(opts.startClock, rate.night_from, rate.night_to);
  const nightPct = night ? Math.max(0, n(rate.night_pct)) : 0;
  let amount = (base + distanceCharge + waitCharge) * (1 + nightPct / 100);
  const minCharge = Math.max(0, n(rate.min_charge));
  const minApplied = amount < minCharge;
  if (minApplied) amount = minCharge;
  return {
    km: r2(distance),
    per_km: perKm,
    distance_charge: distanceCharge,
    base_fare: base,
    waiting_minutes: waitMin,
    waiting_charge: waitCharge,
    round_trip_factor: factor,
    night,
    night_pct: nightPct,
    min_charge: minCharge,
    min_applied: minApplied,
    amount: r2(amount),
  };
}

/** Indian rupee display: 1234.5 -> "₹1,234.50" */
export function inr(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
