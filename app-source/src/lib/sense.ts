/*
  SEHGAL SENSE - automotive relevance + field extraction, ON THE PHONE (no network).

  Honest limits (shown in the screen too):
  - A vocabulary cannot make a microphone hear only car words. Speech is first turned
    into text (by the phone's own voice typing / the browser's speech service, which may
    use the cloud - the screen says so). THEN this file keeps only the sentences that
    carry automotive meaning and drafts fields from them. Everything else is dropped.
  - Every field carries a confidence and the sentence it came from. Nothing becomes a
    customer commitment until the staff member reviews and confirms it.
  - Prices are recorded AS SPOKEN. We never invent a price, an offer or a discount.

  The vocabulary is versioned and meant to grow; unknown model names are allowed.
*/
import type { SenseField } from "@/app/types";

export const VOCAB_VERSION = "sense-auto-1 (09-10-2026)";

// Maruti Suzuki (Arena + Nexa) first, then common competitors heard in a showroom.
const MODELS = [
  "alto k10", "alto", "s-presso", "spresso", "celerio", "wagon r", "wagonr", "swift", "dzire", "baleno", "fronx", "brezza",
  "ertiga", "xl6", "ciaz", "ignis", "grand vitara", "jimny", "invicto", "eeco", "super carry", "e vitara", "victoris",
  "creta", "venue", "i20", "exter", "nexon", "punch", "tiago", "altroz", "xuv700", "xuv 3xo", "scorpio", "thar",
  "innova", "hycross", "glanza", "hyryder", "sonet", "seltos", "magnite", "kiger", "city", "amaze", "elevate",
];
const VARIANTS = ["lxi", "vxi", "zxi", "zxi+", "zxi plus", "sigma", "delta", "zeta", "alpha", "std", "smart hybrid", "strong hybrid"];
const FUEL = ["petrol", "diesel", "cng", "hybrid", "electric", "ev"];
const TRANSMISSION = ["manual", "automatic", "amt", "ags", "cvt", "at"];

const TOPICS: Record<string, string[]> = {
  finance: ["loan", "finance", "emi", "interest", "rate of interest", "roi", "down payment", "downpayment", "tenure", "bank", "byaj", "hapta", "kist", "kisht"],
  price: ["ex-showroom", "ex showroom", "on-road", "on road", "price", "kimat", "keemat", "quotation", "discount", "offer", "rto", "registration", "insurance", "tcs"],
  exchange: ["exchange", "old car", "purani gaadi", "true value", "valuation"],
  test_drive: ["test drive", "trial", "drive karke"],
  booking: ["booking", "book", "token", "advance"],
  delivery: ["delivery", "deliver", "handover", "dhanteras", "diwali"],
  service: ["service", "servicing", "job card", "complaint", "noise", "awaaz", "brake", "clutch", "ac", "battery", "tyre", "alignment", "oil", "engine", "suspension", "pickup", "drop"],
  warranty: ["warranty", "extended warranty", "ew", "ccp", "smp", "amc", "mcp", "claim"],
  parts: ["part", "parts", "spare", "order", "back order", "not available"],
  labour: ["labour", "labor", "estimate", "bill", "approval", "approve"],
};

const DIGIT_WORDS: Record<string, number> = { ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, che: 6, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10 };

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!।])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const has = (s: string, w: string) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(s);

/** "7.5 lakh", "7 lakh 20 hazaar", "₹ 7,50,000", "saat lakh" -> rupees (as spoken, rounded). */
export function spokenRupees(s: string): number | null {
  const t = s.toLowerCase().replace(/,/g, "");
  const lakh = t.match(/(\d+(?:\.\d+)?|[a-z]+)\s*(?:lakh|lac|lakhs)\b(?:\s*(\d+)\s*(?:hazaar|hazar|thousand|k)\b)?/);
  if (lakh) {
    const n = Number(lakh[1]);
    const base = Number.isFinite(n) ? n : DIGIT_WORDS[lakh[1]];
    if (base !== undefined) return Math.round(base * 100000 + (lakh[2] ? Number(lakh[2]) * 1000 : 0));
  }
  const thousand = t.match(/(\d+(?:\.\d+)?)\s*(?:hazaar|hazar|thousand|k)\b/);
  if (thousand) return Math.round(Number(thousand[1]) * 1000);
  const rupees = t.match(/(?:₹|rs\.?|rupees?)\s*(\d{3,8})/) ?? t.match(/(\d{3,8})\s*(?:rupees?|rs)\b/);
  if (rupees) return Number(rupees[1]);
  return null;
}

export interface SenseResult {
  relevant: string[];
  dropped: number;
  fields: SenseField[];
  unclear: string[];
  topics: string[];
}

export function extract(text: string): SenseResult {
  const all = sentences(text);
  const fields: SenseField[] = [];
  const topics = new Set<string>();
  const relevant: string[] = [];
  const unclear: string[] = [];
  const push = (key: string, value: string, confidence: number, excerpt: string) => {
    if (!fields.some((f) => f.key === key && f.value.toLowerCase() === value.toLowerCase())) fields.push({ key, value, confidence, excerpt });
  };

  for (const s of all) {
    const low = s.toLowerCase();
    let hit = false;
    for (const m of MODELS) if (has(low, m)) { push("model", m.replace(/\b\w/g, (c) => c.toUpperCase()), 0.9, s); hit = true; }
    for (const v of VARIANTS) if (has(low, v)) { push("variant", v.toUpperCase(), 0.8, s); hit = true; }
    for (const f of FUEL) if (has(low, f)) { push("fuel", f, 0.8, s); hit = true; }
    for (const g of TRANSMISSION) if (g !== "at" && has(low, g)) { push("transmission", g.toUpperCase(), 0.75, s); hit = true; }
    for (const [topic, words] of Object.entries(TOPICS)) {
      if (words.some((w) => has(low, w))) { topics.add(topic); hit = true; }
    }
    const amt = spokenRupees(low);
    if (amt !== null) {
      const key = /emi|hapta|kist|kisht/.test(low) ? "emi_as_spoken" : /down ?payment|advance|token/.test(low) ? "down_payment_as_spoken" : /on.?road/.test(low) ? "on_road_as_spoken" : /ex.?showroom/.test(low) ? "ex_showroom_as_spoken" : /estimate|bill|labour|labor/.test(low) ? "estimate_as_spoken" : "amount_as_spoken";
      push(key, `₹${amt.toLocaleString("en-IN")}`, 0.7, s);
      hit = true;
    }
    const tenure = low.match(/(\d{1,2})\s*(?:months?|mahine)\b/) ?? low.match(/(\d)\s*(?:years?|saal)\b/);
    if (tenure && /loan|emi|tenure|finance|saal|years?|months?/.test(low) && topics.has("finance")) {
      push("tenure_as_spoken", tenure[0], 0.6, s);
    }
    const rate = low.match(/(\d{1,2}(?:\.\d{1,2})?)\s*(?:%|percent|pratishat)/);
    if (rate && topics.has("finance")) push("interest_as_spoken", `${rate[1]}%`, 0.6, s);
    const when = low.match(/\b(today|tomorrow|kal|parso|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?:st|nd|rd|th)?\s*(?:oct|october|nov|november|dec|december))\b/);
    if (when && hit) push("when_as_spoken", when[1], 0.5, s);
    if (hit) relevant.push(s);
    else if (/\d/.test(low) && low.length < 140) unclear.push(s);
  }
  for (const t of topics) push("topic", t, 0.6, relevant.find((s) => TOPICS[t].some((w) => has(s.toLowerCase(), w))) ?? "");
  return { relevant, dropped: all.length - relevant.length, fields, unclear, topics: [...topics] };
}

/** Next-action drafts - suggestions only; the employee confirms each one. */
export function suggestFollowUps(r: SenseResult): string[] {
  const out: string[] = [];
  if (r.topics.includes("test_drive")) out.push("Fix a test drive time with the customer");
  if (r.topics.includes("finance")) out.push("Share finance options (bank, EMI, tenure) - figures to be confirmed by finance");
  if (r.topics.includes("price")) out.push("Send the official quotation (price from the price list, not from this note)");
  if (r.topics.includes("exchange")) out.push("Book an exchange valuation of the old car");
  if (r.topics.includes("booking")) out.push("Confirm the booking amount and receipt");
  if (r.topics.includes("parts")) out.push("Check parts availability and give the customer a date");
  if (r.topics.includes("labour") || r.topics.includes("warranty")) out.push("Get approval for the estimate / warranty claim");
  if (r.topics.includes("delivery")) out.push("Confirm the delivery date");
  return out;
}
