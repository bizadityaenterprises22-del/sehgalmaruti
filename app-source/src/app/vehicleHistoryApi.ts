/*
  Sehgal Autoriders Vehicle History - the two database calls behind the "Vehicle History" screen.

  Goes in: src/app/vehicleHistoryApi.ts  (see INTEGRATION.md).

  This file does NOT import @supabase/supabase-js. src/app/api.ts is the ONE gateway that
  owns the client, so it hands the client in here (see the two lines INTEGRATION.md adds to
  api.ts). Anything that needs a Supabase client type uses the small structural RpcClient
  below, which the real client satisfies.

  The server functions (supabase/0300 + 0302 + 0303, already deployed):
    vehicle_history_report(p_vehicle text, p_tenant text default null) -> VehicleHistoryReport
    vehicle_history_search(p_query text, p_tenant text default null, p_limit int default 20) -> VhSearchResponse
    vh_is_consultant() -> boolean
  Scoping happens in the database, never here: p_tenant = 'sehgal_maruti' returns this
  tenant's own visits only; p_tenant = null returns every dealer and the server refuses it
  for anyone who is not a consultant.
*/
import type { VehicleHistoryReport, VhScope } from "@/lib/vehicle-history/types";

/** The org code of this app's tenant - passed as p_tenant for "own visits only". */
export const SEHGAL_TENANT = "sehgal_maruti";

/** The server refuses anything shorter than this many letters+digits. */
export const MIN_KEY_LENGTH = 5;

/** The search refuses anything shorter than this many letters+digits. */
export const MIN_QUERY_LENGTH = 3;

/** How many rows one search returns (the server caps it at 50). */
export const SEARCH_LIMIT = 20;

/** The only part of a Supabase client this file uses. */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** Same rule the server applies: upper-case letters and digits only. */
export function vehicleKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isSearchable(raw: string): boolean {
  return vehicleKey(raw).length >= MIN_KEY_LENGTH;
}

/** Same rule the server applies to the search box (letters and digits only are counted). */
export function isSearchableQuery(raw: string): boolean {
  return vehicleKey(raw).length >= MIN_QUERY_LENGTH;
}

/** A person never sees "TypeError: Failed to fetch" - say what to do. */
function plain(message: string): string {
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return "Could not reach the server. Check the internet connection and press Search again.";
  }
  return message;
}

function isReport(x: unknown): x is VehicleHistoryReport {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  const scope = r.scope as Record<string, unknown> | null | undefined;
  return (
    typeof r.registration === "string" &&
    Array.isArray(r.visits) &&
    typeof scope === "object" &&
    scope !== null &&
    (scope.mode === "tenant" || scope.mode === "consultant")
  );
}

/**
 * One vehicle's history. `tenant` = SEHGAL_TENANT for this dealer's own visits, or null for
 * every dealer (consultants only - anyone else gets the server's plain refusal as an Error).
 * Every failure is thrown as an Error whose message is fit to show on screen.
 */
export async function fetchVehicleHistory(client: RpcClient, vehicle: string, tenant: string | null): Promise<VehicleHistoryReport> {
  if (!isSearchable(vehicle)) throw new Error("Type the full registration number or VIN");
  let res: { data: unknown; error: { message: string } | null };
  try {
    res = await client.rpc("vehicle_history_report", { p_vehicle: vehicle.trim(), p_tenant: tenant });
  } catch (e) {
    throw new Error(plain((e as Error).message));
  }
  if (res.error) throw new Error(plain(res.error.message));
  if (!isReport(res.data)) throw new Error("The server answered in a form this screen does not understand.");
  return res.data;
}

/**
 * True when a report with no visits in this view still holds something worth showing (release 1.2): the owner, the
 * vehicle, or facts such as insurance due. Most Hero customers have no job card in the cloud yet but are known.
 */
export function holdsAnything(report: VehicleHistoryReport): boolean {
  const filled = (o?: object) => Object.values(o ?? {}).some((x) => (Array.isArray(x) ? x.length > 0 : String(x ?? "").trim() !== ""));
  return filled(report.customer) || filled(report.vehicle) || (report.vehicle_facts ?? []).some((f) => String(f.value ?? "").trim() !== "");
}

/** What the smart search decided the text was. Any other string the server adds is shown as it is. */
export type SearchedAs = "registration" | "partial" | "vin" | "chassis_or_engine" | "mobile" | "name" | "jobcard" | "words" | (string & {});

/** One vehicle found by the search. Every field may be missing - show it blank, never a placeholder. */
export interface VhSearchResult {
  registration?: string;
  vin?: string;
  /** The maker (release 1.2), e.g. "HERO", and its display name "Hero MotoCorp". */
  brand?: string;
  brand_name?: string;
  model?: string;
  variant?: string;
  customer_name?: string;
  mobile?: string;
  city?: string;
  sold_by?: string;
  /** Printed as dd-mm-yyyy by the server. */
  sold_date?: string;
  visits?: number;
  /** dd-mm-yyyy */
  last_visit?: string;
  last_dealer?: string;
  /** Which kinds of text matched: "registration", "mobile", "name", ... */
  matched_on?: string[];
}

export interface VhSearchResponse {
  query: string;
  searched_as?: SearchedAs;
  scope: Pick<VhScope, "mode" | "tenant_code" | "tenant_name">;
  /** All matches the server found; `results` holds at most SEARCH_LIMIT of them. */
  total: number;
  results: VhSearchResult[];
}

function isSearchResponse(x: unknown): x is VhSearchResponse {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  const scope = r.scope as Record<string, unknown> | null | undefined;
  return (
    Array.isArray(r.results) && typeof scope === "object" && scope !== null && (scope.mode === "tenant" || scope.mode === "consultant")
  );
}

/** What to hand to vehicle_history_report for one search row: its registration, else its VIN, else nothing. */
export function openKeyOf(row: VhSearchResult): string | null {
  const reg = row.registration?.trim() ?? "";
  if (isSearchable(reg)) return reg;
  const vin = row.vin?.trim() ?? "";
  return isSearchable(vin) ? vin : null;
}

/**
 * Smart search: registration (full or part), VIN, chassis or engine digits, mobile in any format,
 * customer name (contains), job card number. `tenant` works exactly as for the report. Every failure
 * is thrown as an Error whose message is fit to show on screen.
 */
export async function fetchVehicleSearch(client: RpcClient, query: string, tenant: string | null): Promise<VhSearchResponse> {
  if (!isSearchableQuery(query)) throw new Error("Type at least 3 letters or digits");
  let res: { data: unknown; error: { message: string } | null };
  try {
    res = await client.rpc("vehicle_history_search", { p_query: query.trim(), p_tenant: tenant, p_limit: SEARCH_LIMIT });
  } catch (e) {
    throw new Error(plain((e as Error).message));
  }
  if (res.error) throw new Error(plain(res.error.message));
  if (!isSearchResponse(res.data)) throw new Error("The server answered in a form this screen does not understand.");
  const total = typeof res.data.total === "number" ? res.data.total : res.data.results.length;
  return { ...res.data, total };
}

/**
 * Is this login a consultant (may see every dealer)? If the check itself fails this THROWS,
 * and the caller must treat that as "not a consultant" (the safe side) - it is not cached as
 * a "no" by TanStack Query, so the next visit to the screen asks again.
 */
export async function fetchIsConsultant(client: RpcClient): Promise<boolean> {
  let res: { data: unknown; error: { message: string } | null };
  try {
    res = await client.rpc("vh_is_consultant");
  } catch (e) {
    throw new Error(plain((e as Error).message));
  }
  if (res.error) throw new Error(plain(res.error.message));
  return res.data === true;
}

// ---------------------------------------------------------------------------
// Live from the DMS (0212_vh_live_dms.sql). Ravi 27-10-2026: "just put in the reg no and it comes ... from the dms itself -
// live even if the vehicle has been served 1 min back". The screen asks once per opened vehicle, shows what we already hold,
// and polls until our DMS reader has read the vehicle's whole life; then it reloads the report.
// ---------------------------------------------------------------------------

/** An Indian registration as typed (MH12AB1234, MH12A1234, 22BH1234AA ...) - only these are asked of the DMS live. */
export function liveRegOf(raw: string | null | undefined): string | null {
  const k = vehicleKey(raw ?? "");
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{3,4}$/.test(k) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(k) ? k : null;
}

export interface VhLiveStatus {
  id: number;
  reg: string;
  state: "asked" | "reading" | "done" | "failed";
  step: string | null;
  asked_at: string;
  taken_at: string | null;
  done_at: string | null;
  job_cards: number | null;
  note: string | null;
  reader: { alive: boolean; seen_at: string | null; state: string | null };
}

async function liveCall(client: RpcClient, fn: string, args: Record<string, unknown>): Promise<VhLiveStatus> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(plain(error.message));
  return data as VhLiveStatus;
}

export const fetchVhLiveAsk = (client: RpcClient, reg: string) => liveCall(client, "vh_live_ask", { p_reg: reg });
export const fetchVhLiveStatus = (client: RpcClient, id: number) => liveCall(client, "vh_live_status", { p_id: id });
