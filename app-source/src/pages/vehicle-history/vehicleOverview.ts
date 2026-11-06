import type { VehicleHistoryReport, VhVisit } from "@/lib/vehicle-history/types";

/*
  The vehicle at a glance, worked out from the same report the visit tabs show (no extra data, no extra call).
  Ravi, 16-10-2026: "Intelligently it should also give all the information based on reg no."

  Every figure says what it covers. Amounts and mileage are only on some visits (the rest are not loaded),
  so they come with "on N of M visits" - a missing amount is never counted as zero.
*/

export interface DealerLine {
  dealer: string;
  visits: number;
  /** Printed job-card date of the newest visit at this dealer. */
  last: string;
}

export interface CountLine {
  label: string;
  count: number;
}

export interface Overview {
  visits: number;
  /** Printed date of the oldest / newest visible visit ("dd/mm/yy"). */
  first: string;
  last: string;
  dealers: DealerLine[];
  serviceTypes: CountLine[];
  /** Sum of total_amount over the visits that carry one, and how many do. */
  spent: number | null;
  spentOn: number;
  /** Newest mileage we hold and the date it was read. */
  mileage: string;
  mileageOn: string;
  psf: { satisfied: number; dissatisfied: number; other: number; none: number };
}

const text = (s?: string | null) => s?.trim() ?? "";
const day = (v: VhVisit) => text(v.jobcard.jobcard_date).split(" ")[0];

function amount(s?: string): number | null {
  const t = text(s).replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function psfOf(v: VhVisit): "satisfied" | "dissatisfied" | "other" | "none" {
  const p = v.jobcard.psf;
  const all = [p?.sa, p?.cce, p?.second].map((x) => text(x).toUpperCase()).filter(Boolean);
  if (!all.length) return "none";
  if (all.some((x) => x.includes("DISSATISF"))) return "dissatisfied";
  if (all.some((x) => x.includes("SATISF"))) return "satisfied";
  return "other";
}

/** Visits come newest first, exactly as the report prints them. */
export function overviewOf(report: VehicleHistoryReport): Overview {
  const visits = report.visits;
  const dealers = new Map<string, DealerLine>();
  const types = new Map<string, number>();
  const psf = { satisfied: 0, dissatisfied: 0, other: 0, none: 0 };
  let spent: number | null = null;
  let spentOn = 0;
  let mileage = "";
  let mileageOn = "";

  for (const v of visits) {
    const jc = v.jobcard;
    const name = text(jc.dealer_name) || text(jc.dealer_code);
    if (name) {
      const d = dealers.get(name);
      if (d) d.visits += 1;
      else dealers.set(name, { dealer: name, visits: 1, last: day(v) });
    }
    const st = text(jc.service_type);
    if (st) types.set(st, (types.get(st) ?? 0) + 1);
    const amt = amount(jc.total_amount);
    if (amt !== null) {
      spent = (spent ?? 0) + amt;
      spentOn += 1;
    }
    if (!mileage && text(jc.mileage)) {
      mileage = text(jc.mileage);
      mileageOn = day(v);
    }
    psf[psfOf(v)] += 1;
  }

  const byCount = (a: CountLine, b: CountLine) => b.count - a.count || a.label.localeCompare(b.label);
  return {
    visits: visits.length,
    first: visits.length ? day(visits[visits.length - 1]) : "",
    last: visits.length ? day(visits[0]) : "",
    dealers: [...dealers.values()].sort((a, b) => b.visits - a.visits),
    serviceTypes: [...types.entries()].map(([label, count]) => ({ label, count })).sort(byCount),
    spent: spent === null ? null : Math.round(spent * 100) / 100,
    spentOn,
    mileage,
    mileageOn,
    psf,
  };
}

/** "₹8,850.25" in the Indian grouping the workshop reads. */
export function rupees(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * THE HOLDUP LAW (Ravi 17-10-2026): a job card with NO INVOICE = the vehicle is in the workshop (HOLDUP), whatever anybody marked.
 * Ravi 27-10-2026: "if the vehicle is not billed - it should be shown in holdup so while the workshop round, i can just put in the
 * reg no and it pulls up."
 * Only the NEWEST job card counts, and only when it was opened in the last 90 days: older source files sometimes carry a billed
 * visit without its bill number, and an old visit must never show as a false red. The live DMS read (Bill No. empty on the DMS
 * screen) is what fills the newest job card.
 */
export interface Holdup {
  jobcard: string;
  opened: string;
  days: number;
  dealer: string;
  sa: string;
  service: string;
}

/** "dd/mm/yy HH:MM" or "dd/mm/yyyy" -> Date (IST wall clock), or null. */
export function printedDate(s: string | undefined): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{2,4})/.exec((s ?? "").trim());
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function holdupOf(report: VehicleHistoryReport, today: Date = new Date()): Holdup | null {
  let newest: { v: VehicleHistoryReport["visits"][number]; at: Date } | null = null;
  for (const v of report.visits) {
    const at = printedDate(v.jobcard.jobcard_date);
    if (at && (!newest || at > newest.at)) newest = { v, at };
  }
  if (!newest) return null;
  const jc = newest.v.jobcard;
  if ((jc.bill_number ?? "").trim() || (jc.bill_date ?? "").trim()) return null;
  const days = Math.floor((today.getTime() - newest.at.getTime()) / 86_400_000);
  if (days < 0 || days > 90) return null;
  return {
    jobcard: jc.jobcard_number ?? "",
    opened: jc.jobcard_date ?? "",
    days,
    dealer: [jc.dealer_code, jc.dealer_name].filter(Boolean).join(" "),
    sa: jc.sa_name ?? "",
    service: jc.service_type ?? "",
  };
}
