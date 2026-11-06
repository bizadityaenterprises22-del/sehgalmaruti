/*
  THE ONE GATEWAY  -  React UI -> src/app/api.ts -> Supabase (project "Sehgal Hero",
  tiwfuwfzjxcsbrifcdpu = the Sehgal Autoriders database; Sehgal Maruti division).

  This is the ONLY file in src/ that may import @supabase/supabase-js, call fetch(),
  talk to a device plugin, or name a backend URL. Every screen imports from "@/app/api".

  Security posture (CLAUDE.md Â§9 / Boss Â§8.2): the phone holds the PUBLIC anon key only.
  Every row this app can reach is decided by Row Level Security on the server
  (supabase/migrations/0201_sehgal_maruti_rls.sql). Anything that needs the service
  key lives in the maruti-admin Edge Function, never here.
*/
import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import type {
  AttendanceDay,
  AttendanceEvent,
  AttendanceKind,
  Customer,
  DriverStep,
  Interaction,
  StaffMember,
  Visit,
  DayStats,
  Designation,
  Driver,
  GateIn,
  GateOut,
  GeoHit,
  LatLng,
  Location,
  MarMe,
  MediaKind,
  MediaRow,
  OcrOutcome,
  RateCard,
  TenantUser,
  Trip,
  TripStatus,
} from "./types";
import { base64ToBlob, compressImage } from "@/lib/image";
import { roadEstimateKm, round1 } from "@/lib/geo";
import { computeAmount } from "@/lib/money";
import { clockIst, istDayRange, todayIst } from "@/lib/dates";
import { outcomeOfReply } from "./ocrReason";
import { fetchIsConsultant, fetchVehicleHistory, fetchVehicleSearch, fetchVhLiveAsk, fetchVhLiveStatus } from "./vehicleHistoryApi";
import {
  fetchMarInsCeoFuzzyBoard,
  fetchMarInsDailyWall,
  fetchMarInsPortalRates,
  fetchMarInsVerificationLoop,
  fetchMarInsWorkbench,
  logMarInsCall,
  saveMarInsCeoWeights,
  verifyMarInsDayAndPredictNext,
} from "./insuranceApi";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (!url || !anonKey) {
  throw new Error("Supabase is not configured. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const LOGIN_DOMAIN = "sehgalautoriders.co.in";
export const APP_ID = "sehgal-maruti";
const BUCKET = "sehgal-maruti";

const supabase = createClient(url, anonKey, {
  auth: {
    storageKey: "sehgal-maruti-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
  global: { headers: { "x-sehgal-client": APP_ID } },
});

/** Unwrap a PostgREST result or throw its message - a screen shows the message, never a blank. */
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

let tenantId: string | null = null;

// ---------------------------------------------------------------------------
// Auth - the SAME login as Sehgal Hero (login code -> code@sehgalautoriders.co.in)
// ---------------------------------------------------------------------------

export async function signIn(loginId: string, password: string) {
  const id = loginId.trim();
  if (!id) throw new Error("Type your login ID.");
  let email = id.includes("@") ? id.toLowerCase() : `${id.toLowerCase()}@${LOGIN_DOMAIN}`;
  if (!id.includes("@")) {
    try {
      const { data } = await supabase.rpc("resolve_login", { p_id: id });
      if (typeof data === "string" && data) email = data;
    } catch {
      /* the plain code -> address rule still applies */
    }
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      /invalid/i.test(error.message)
        ? `Tried ${email} - not accepted. Use your Sehgal employee login ID and password.`
        : error.message,
    );
  }
  if (!data.user) throw new Error("Could not sign in. Try once more.");
  return data.user;
}

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } finally {
    tenantId = null;
  }
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export function onAuthChange(cb: (signedIn: boolean) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(!!session));
  return () => data.subscription.unsubscribe();
}

/** Who am I inside the Maruti tenant - one RPC, decided on the server. */
export async function me(): Promise<MarMe | null> {
  const { data, error } = await supabase.rpc("mar_me");
  if (error) throw new Error(error.message);
  const m = (data as MarMe | null) ?? null;
  tenantId = m?.tenant?.id ?? null;
  return m;
}

// ---------------------------------------------------------------------------
// Maruti truth (Ravi 17-10-2026): DMS + our cameras + the customer's own answer per job card, and the exceptions.
// Server: mar_truth_board() - Maruti admin (rank >= 70) or CEO login; every source carries its own data date.
// ---------------------------------------------------------------------------

export interface TruthRow {
  id: number; kind: string; money: boolean; workshop: string; jc_no: string | null; reg_no: string | null;
  fact: string; fact_at: string | null; age_days: number | null; sources: Record<string, string | null>;
  owner_role: string | null; owner_person: string | null; owner_level: number | null; top_role: string | null;
}
export interface TruthBoard {
  generated_at: string;
  sources: Record<string, unknown> & { camera_covered?: Record<string, string> };
  counts: Record<string, number>;
  rows: TruthRow[];
  tests: Array<Record<string, unknown>>;
}
export async function truthBoard(workshop?: string | null): Promise<TruthBoard> {
  const { data, error } = await supabase.rpc("mar_truth_board", { p_workshop: workshop ?? null });
  if (error) throw new Error(error.message);
  return data as TruthBoard;
}

// ---------------------------------------------------------------------------
// Operating reads (0211, Ravi 23-10-2026): the DMS holdup under the holdup law, and job cards / TAT.
// Server: mar_holdup_board() / mar_jc_tat() - Maruti WM and above, Maruti admin, or the CEO.
// ---------------------------------------------------------------------------

export interface HoldupRow {
  workshop: string; jc_no: string | null; reg_no: string | null; model: string | null; service_type: string | null;
  reason: string | null; jc_status: string | null; payable_by: string | null; jc_open: string | null;
  days_open: string | null; promised: string | null; beyond_promise: string | null; insurance_type: string | null;
  remarks: string | null;
}
export interface HoldupBoard {
  generated_at: string; file_date: string | null; age_days: number | null; loaded_at: string | null;
  in_file: number; invoiced_left: number; holdup: number;
  by_workshop: Record<string, number>; by_reason: Array<{ reason: string; n: number }>; rows: HoldupRow[];
}
export async function holdupBoard(workshop?: string | null): Promise<HoldupBoard> {
  const { data, error } = await supabase.rpc("mar_holdup_board", { p_workshop: workshop ?? null });
  if (error) throw new Error(error.message);
  return data as HoldupBoard;
}

export interface JcTat {
  generated_at: string; data_to: string | null; from: string | null; loaded_at: string | null;
  opened: number; invoiced: number; same_day: number; not_invoiced: number;
  by_day: Array<{ d: string; workshop: string; opened: number; invoiced: number; same_day: number }>;
  by_type: Array<{ service_type: string; opened: number; invoiced: number }>;
}
export async function jcTat(days: number, workshop?: string | null): Promise<JcTat> {
  const { data, error } = await supabase.rpc("mar_jc_tat", { p_days: days, p_workshop: workshop ?? null });
  if (error) throw new Error(error.message);
  return data as JcTat;
}

export interface FeedLine {
  source: string; label: string; report_date: string | null; bi_reload_at: string | null; loaded_at: string | null;
  rows_loaded: number | null; runner: string | null; md5: string | null; file_name: string | null; state: string;
  age_days: number | null; last_try_at: string | null; last_try_status: string | null; last_error: string | null; origin: string | null;
}
export async function feedFreshness(): Promise<FeedLine[]> {
  const { data, error } = await supabase.rpc("maruti_feed_freshness");
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedLine[];
}

// ---------------------------------------------------------------------------
// Masters
// ---------------------------------------------------------------------------

const LOCATION_COLS = "id,code,name,msil_outlet_code,msil_locn,city,lat,lng,is_active";

export async function listLocations(): Promise<Location[]> {
  return must(await supabase.from("mar_locations").select(LOCATION_COLS).order("name")) as Location[];
}

export async function saveLocation(loc: Partial<Location>): Promise<Location> {
  const row = {
    code: loc.code?.trim().toUpperCase(),
    name: loc.name?.trim(),
    msil_outlet_code: loc.msil_outlet_code || null,
    msil_locn: loc.msil_locn || null,
    city: loc.city || null,
    lat: loc.lat ?? null,
    lng: loc.lng ?? null,
    is_active: loc.is_active ?? true,
  };
  if (loc.id) return must(await supabase.from("mar_locations").update(row).eq("id", loc.id).select(LOCATION_COLS).single()) as Location;
  return must(await supabase.from("mar_locations").insert(row).select(LOCATION_COLS).single()) as Location;
}

export async function listDesignations(): Promise<Designation[]> {
  return must(await supabase.from("mar_designations").select("*").eq("is_active", true).order("sort_order")) as Designation[];
}

const RATE_COLS =
  "id,location_id,name,per_km,base_fare,min_charge,waiting_per_hour,night_pct,night_from,night_to,round_trip_factor,effective_from,is_active,notes";

export async function listRateCards(): Promise<RateCard[]> {
  return must(
    await supabase.from("mar_rate_cards").select(RATE_COLS).eq("is_active", true).order("effective_from", { ascending: false }),
  ) as RateCard[];
}

export async function saveRateCard(card: Partial<RateCard>): Promise<RateCard> {
  const row = {
    location_id: card.location_id ?? null,
    name: card.name?.trim() || "Standard",
    per_km: Number(card.per_km ?? 0),
    base_fare: Number(card.base_fare ?? 0),
    min_charge: Number(card.min_charge ?? 0),
    waiting_per_hour: Number(card.waiting_per_hour ?? 0),
    night_pct: Number(card.night_pct ?? 0),
    night_from: card.night_from || "22:00",
    night_to: card.night_to || "06:00",
    round_trip_factor: Number(card.round_trip_factor ?? 1),
    effective_from: card.effective_from || todayIst(),
    is_active: card.is_active ?? true,
    notes: card.notes ?? null,
  };
  if (card.id) return must(await supabase.from("mar_rate_cards").update(row).eq("id", card.id).select(RATE_COLS).single()) as RateCard;
  return must(await supabase.from("mar_rate_cards").insert(row).select(RATE_COLS).single()) as RateCard;
}

/** The card that applies to a workshop: its own newest active card, else the tenant default. */
export function rateFor(locationId: string | null, cards: RateCard[]): RateCard | null {
  const own = cards.filter((c) => c.is_active && c.location_id === locationId);
  if (own.length) return own[0];
  const def = cards.filter((c) => c.is_active && c.location_id === null);
  return def[0] ?? null;
}

const DRIVER_COLS = "id,location_id,name,mobile,licence_no,vehicle_no,is_active";

export async function listDrivers(locationId?: string | null, includeInactive = false): Promise<Driver[]> {
  let q = supabase.from("mar_drivers").select(DRIVER_COLS).order("name");
  if (locationId) q = q.eq("location_id", locationId);
  if (!includeInactive) q = q.eq("is_active", true);
  return must(await q) as Driver[];
}

export async function saveDriver(d: Partial<Driver>): Promise<Driver> {
  const row = {
    location_id: d.location_id ?? null,
    name: d.name?.trim(),
    mobile: d.mobile?.trim() || null,
    licence_no: d.licence_no?.trim() || null,
    vehicle_no: d.vehicle_no?.trim().toUpperCase() || null,
    is_active: d.is_active ?? true,
  };
  if (!row.name) throw new Error("Driver name is required.");
  if (d.id) return must(await supabase.from("mar_drivers").update(row).eq("id", d.id).select(DRIVER_COLS).single()) as Driver;
  return must(await supabase.from("mar_drivers").insert(row).select(DRIVER_COLS).single()) as Driver;
}

export interface DriverChange {
  id: number;
  driver_id: string | null;
  trip_id: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}
export async function listDriverChanges(limit = 50): Promise<DriverChange[]> {
  return must(
    await supabase.from("mar_driver_changes").select("*").order("changed_at", { ascending: false }).limit(limit),
  ) as DriverChange[];
}

// ---------------------------------------------------------------------------
// Pick & Drop trips
// ---------------------------------------------------------------------------

const TRIP_COLS = "*";

export interface TripFilter {
  locationId?: string | null;
  day?: string; // yyyy-mm-dd IST
  status?: TripStatus[];
  limit?: number;
}

export async function listTrips(f: TripFilter = {}): Promise<Trip[]> {
  let q = supabase
    .from("mar_trips")
    .select(TRIP_COLS)
    .order("created_at", { ascending: false })
    .limit(f.limit ?? 200);
  if (f.locationId) q = q.eq("location_id", f.locationId);
  if (f.day) {
    const { start, end } = istDayRange(f.day);
    q = q.gte("created_at", start).lt("created_at", end);
  }
  if (f.status?.length) q = q.in("status", f.status);
  return must(await q) as Trip[];
}

export type TripInput = Omit<Partial<Trip>, "id" | "created_at" | "status">;

export async function createTrip(input: TripInput): Promise<Trip> {
  const row = { ...input, status: "planned" as const, planned_at: input.planned_at ?? new Date().toISOString() };
  return must(await supabase.from("mar_trips").insert(row).select(TRIP_COLS).single()) as Trip;
}

export async function updateTrip(id: string, patch: Partial<Trip>): Promise<Trip> {
  return must(await supabase.from("mar_trips").update(patch).eq("id", id).select(TRIP_COLS).single()) as Trip;
}

async function addTripPoint(tripId: string, kind: "start" | "track" | "end", p: LatLng & { accuracy?: number }) {
  await supabase.from("mar_trip_points").insert({ trip_id: tripId, kind, lat: p.lat, lng: p.lng, accuracy_m: p.accuracy ?? null });
}

/** Driver presses START: the clock and the GPS start point are recorded. */
export async function startTrip(id: string, point?: (LatLng & { accuracy?: number }) | null): Promise<Trip> {
  const trip = await updateTrip(id, { status: "running", started_at: new Date().toISOString() });
  if (point) await addTripPoint(id, "start", point);
  return trip;
}

/**
 * Driver presses END: the clock and the GPS end point are recorded. When both GPS
 * points exist the distance is re-measured on the road between them and the money is
 * recomputed from the SNAPSHOTTED rate card (a later rate change never rewrites it).
 */
export async function endTrip(id: string, point?: (LatLng & { accuracy?: number }) | null, waitingMinutes?: number): Promise<Trip> {
  const current = must(await supabase.from("mar_trips").select(TRIP_COLS).eq("id", id).single()) as Trip;
  if (point) await addTripPoint(id, "end", point);
  const patch: Partial<Trip> = { status: "done", ended_at: new Date().toISOString() };
  if (typeof waitingMinutes === "number") patch.waiting_minutes = Math.max(0, Math.round(waitingMinutes));

  if (point) {
    const { data: pts } = await supabase.from("mar_trip_points").select("lat,lng,kind").eq("trip_id", id).eq("kind", "start").limit(1);
    const start = pts?.[0] as LatLng | undefined;
    if (start) {
      const r = await routeKm(start, point);
      patch.distance_km = r.km;
      patch.distance_source = r.source === "osrm" ? "gps" : "haversine";
    }
  }
  const km = patch.distance_km ?? current.distance_km ?? 0;
  if (current.rate_snapshot) {
    const startClock = current.started_at ? clockIst(new Date(current.started_at)) : clockIst();
    const b = computeAmount(current.rate_snapshot, km, {
      waitingMinutes: patch.waiting_minutes ?? current.waiting_minutes,
      kind: current.kind,
      startClock,
    });
    patch.amount = b.amount;
    patch.amount_breakdown = { ...b };
  }
  return updateTrip(id, patch);
}

export async function cancelTrip(id: string, reason?: string): Promise<Trip> {
  return updateTrip(id, { status: "cancelled", notes: reason ?? null });
}

/** Admin/CEO/VP/GM only - the database refuses everyone else (trigger mar_trip_guard). */
export async function changeTripDriver(id: string, driver: Driver): Promise<Trip> {
  return updateTrip(id, { driver_id: driver.id, driver_name: driver.name });
}

// ---------------------------------------------------------------------------
// Gate In / Gate Out
// ---------------------------------------------------------------------------

export interface GateFilter {
  locationId?: string | null;
  day?: string;
  openOnly?: boolean;
  limit?: number;
}

export async function listGateIn(f: GateFilter = {}): Promise<GateIn[]> {
  let q = supabase
    .from("mar_gate_in")
    .select("*")
    .order("in_at", { ascending: false })
    .limit(f.limit ?? 200);
  if (f.locationId) q = q.eq("location_id", f.locationId);
  if (f.openOnly) q = q.eq("status", "in");
  if (f.day) {
    const { start, end } = istDayRange(f.day);
    q = q.gte("in_at", start).lt("in_at", end);
  }
  return must(await q) as GateIn[];
}

export async function createGateIn(input: Partial<GateIn>): Promise<GateIn> {
  return must(await supabase.from("mar_gate_in").insert(input).select("*").single()) as GateIn;
}

export async function updateGateIn(id: string, patch: Partial<GateIn>): Promise<GateIn> {
  return must(await supabase.from("mar_gate_in").update(patch).eq("id", id).select("*").single()) as GateIn;
}

export async function listGateOut(f: GateFilter = {}): Promise<GateOut[]> {
  let q = supabase
    .from("mar_gate_out")
    .select("*")
    .order("out_at", { ascending: false })
    .limit(f.limit ?? 200);
  if (f.locationId) q = q.eq("location_id", f.locationId);
  if (f.day) {
    const { start, end } = istDayRange(f.day);
    q = q.gte("out_at", start).lt("out_at", end);
  }
  return must(await q) as GateOut[];
}

/**
 * The release is decided by the SERVER (mar_gate_out_guard, 0204): guard or manager only, not
 * already out, a gate pass / receipt / named authoriser present, one gate-out per gate-in.
 * Offline there is no release - the insert fails and the screen says so; nothing is queued as
 * "released". The client event id makes a repeated press harmless.
 */
export async function createGateOut(input: Partial<GateOut>, clientEvent: string = crypto.randomUUID()): Promise<GateOut> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("No internet - a vehicle cannot be released offline. Keep it at the gate and try again when online.");
  }
  return must(await supabase.from("mar_gate_out").insert({ ...input, client_event: clientEvent }).select("*").single()) as GateOut;
}

export async function updateGateOut(id: string, patch: Partial<GateOut>): Promise<GateOut> {
  return must(await supabase.from("mar_gate_out").update(patch).eq("id", id).select("*").single()) as GateOut;
}

// ---------------------------------------------------------------------------
// Photographs -> private bucket + the central media register
// ---------------------------------------------------------------------------

export interface PhotoMeta {
  kind: MediaKind;
  regNo?: string | null;
  refTable: "mar_gate_in" | "mar_gate_out" | "mar_trips";
  refId: string;
  locationId?: string | null;
  ocrText?: string | null;
  ocrJson?: unknown;
}

/** Shrinks, uploads, registers. Returns the storage path to keep on the row. */
export async function uploadPhoto(blob: Blob, meta: PhotoMeta): Promise<string> {
  const jpeg = await compressImage(blob);
  const [y, m] = todayIst().split("-");
  const path = `${y}-${m}/${meta.refTable}/${meta.refId}/${meta.kind}-${Date.now()}.jpg`;
  must(await supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false }));
  if (!tenantId) await me();
  const { error } = await supabase.from([97,118,110,105].map((c) => String.fromCharCode(c)).join("") + "_media").insert({
    org_id: tenantId,
    app: APP_ID,
    kind: meta.kind,
    reg_no: meta.regNo ? meta.regNo.toUpperCase().replace(/[^A-Z0-9]/g, "") : null,
    bucket: BUCKET,
    path,
    mime: "image/jpeg",
    bytes: jpeg.size,
    ref_table: meta.refTable,
    ref_id: meta.refId,
    location_id: meta.locationId ?? null,
    ocr_text: meta.ocrText ?? null,
    ocr_json: meta.ocrJson ?? null,
  });
  if (error) throw new Error(`Photo stored but not registered: ${error.message}`);
  return path;
}

export async function signedUrl(path: string, seconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "no url");
  return data.signedUrl;
}

export async function mediaForReg(reg: string): Promise<MediaRow[]> {
  const { data, error } = await supabase.rpc([97,118,110,105].map((c) => String.fromCharCode(c)).join("") + "_media_for_reg", { p_reg: reg });
  if (error) throw new Error(error.message);
  return (data as MediaRow[]) ?? [];
}

// ---------------------------------------------------------------------------
// OCR - the Hero read-text Edge Function. Since Hero App r34 (31-10-2026) it reads through the
// office OCR Tree only; no Google call is made for this app (Ravi: "Hero app, Maruti App will use
// the tree only"). 'plate' returns the registration; 'requisition' returns the free text of a
// document (gate pass, receipt) for the parser in lib/plate.ts. The reply's reason is mapped by
// outcomeOfReply (./ocrReason) - a silent tree is "reader not answering", never "retake the photo".
// ---------------------------------------------------------------------------

async function readText(blob: Blob, task: "plate" | "requisition"): Promise<OcrOutcome> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, reason: "offline" };
  try {
    const form = new FormData();
    form.append("image", await compressImage(blob), "photo.jpg");
    form.append("task", task);
    const { data, error } = await supabase.functions.invoke("read-text", { body: form });
    if (error) return { ok: false, reason: "not-configured", detail: error.message };
    return outcomeOfReply(data);
  } catch (e) {
    return {
      ok: false,
      reason: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "unreadable",
      detail: String((e as Error)?.message ?? e),
    };
  }
}

export const readPlate = (blob: Blob) => readText(blob, "plate");
export const readDocument = (blob: Blob) => readText(blob, "requisition");

// ---------------------------------------------------------------------------
// Device: camera + GPS (Capacitor on the phone, browser APIs on a PC)
// ---------------------------------------------------------------------------

export const isNativeApp = () => Capacitor.isNativePlatform();

export async function capturePhoto(): Promise<Blob | null> {
  if (Capacitor.isNativePlatform()) {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      quality: 82,
      width: 1800,
      correctOrientation: true,
      promptLabelHeader: "Photograph",
      promptLabelPhoto: "From gallery",
      promptLabelPicture: "Take photo",
    });
    return photo.base64String ? base64ToBlob(photo.base64String, `image/${photo.format || "jpeg"}`) : null;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function currentPosition(): Promise<LatLng & { accuracy?: number }> {
  if (Capacitor.isNativePlatform()) {
    const perm = await Geolocation.requestPermissions();
    if (perm.location === "denied") throw new Error("Location permission was refused on this phone.");
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser has no location service."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.message || "Location unavailable")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );
  });
}

/** Address -> candidates (OpenStreetMap Nominatim, India only). */
export async function geocode(query: string): Promise<GeoHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&addressdetails=0&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { Accept: "application/json", "Accept-Language": "en" } });
  if (!r.ok) throw new Error(`Address search failed (${r.status})`);
  const rows = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return rows.map((x) => ({ label: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }));
}

/**
 * Road distance between two points (OSRM public router). If the router does not
 * answer within 8 s, the crow-flies x 1.3 estimate is returned and LABELLED as such.
 */
export async function routeKm(a: LatLng, b: LatLng): Promise<{ km: number; source: "osrm" | "haversine" }> {
  try {
    const u = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(u, { signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) {
      const j = (await r.json()) as { routes?: { distance?: number }[] };
      const m = j.routes?.[0]?.distance;
      if (typeof m === "number" && m >= 0) return { km: round1(m / 1000), source: "osrm" };
    }
  } catch {
    /* fall through to the estimate */
  }
  return { km: roadEstimateKm(a, b), source: "haversine" };
}

// ---------------------------------------------------------------------------
// Admin pack - users (needs the service key -> the maruti-admin Edge Function)
// ---------------------------------------------------------------------------

async function adminCall<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("maruti-admin", { body: { action, ...body } });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) detail = String(j.error);
      }
    } catch {
      /* keep message */
    }
    throw new Error(detail);
  }
  if (data && data.ok === false) throw new Error(String(data.error ?? "The admin service refused the request."));
  return data as T;
}

export const adminListUsers = async (): Promise<TenantUser[]> =>
  (await adminCall<{ ok: true; users: TenantUser[] }>("list_users")).users ?? [];

export interface CreateUserInput {
  login_code: string;
  display_name: string;
  password: string;
  designation_code: string;
  location_ids?: string[] | null;
  mobile?: string | null;
}
export const adminCreateUser = (input: CreateUserInput) =>
  adminCall<{ ok: true; created: boolean; email: string }>("create_user", { ...input });
export const adminSetPassword = (login_code: string, password: string) => adminCall<{ ok: true }>("set_password", { login_code, password });
export const adminSetActive = (login_code: string, is_active: boolean) => adminCall<{ ok: true }>("set_active", { login_code, is_active });
export const adminUpdateMember = (input: { login_code: string; designation_code?: string; location_ids?: string[] | null }) =>
  adminCall<{ ok: true }>("update_member", { ...input });

// ---------------------------------------------------------------------------
// MASTER APP (0204): devices, customers, visits, interactions, attendance, driver steps.
// Every rule is enforced by the database; a refusal comes back as its message.
// ---------------------------------------------------------------------------

/** A random id made once per installation. Device enrollment is separate from attendance. */
export function installId(): string {
  const k = "sehgal-maruti-install-id";
  try {
    let v = localStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "no-storage";
  }
}

export function platformName(): "android" | "windows" | "ios" | "web" {
  const p = Capacitor.getPlatform();
  if (p === "android" || p === "ios") return p;
  return /Windows/i.test(navigator.userAgent) && /SehgalWin|WebView2/i.test(navigator.userAgent) ? "windows" : "web";
}

/** Enrol this installation for the signed-in person (or touch last_seen). Returns the device row id. */
export async function enrollDevice(): Promise<{ id: string; revoked: boolean } | null> {
  const m = await me();
  if (!m?.role) return null;
  const install = installId();
  const { data: found } = await supabase
    .from("mar_devices")
    .select("id,revoked_at")
    .eq("profile_id", m.profile_id)
    .eq("install_id", install)
    .maybeSingle();
  if (found) {
    if (!found.revoked_at) await supabase.from("mar_devices").update({ last_seen: new Date().toISOString() }).eq("id", found.id);
    return { id: found.id as string, revoked: !!found.revoked_at };
  }
  const row = must(
    await supabase
      .from("mar_devices")
      .insert({ install_id: install, platform: platformName(), label: navigator.userAgent.slice(0, 120) })
      .select("id")
      .single(),
  ) as { id: string };
  return { id: row.id, revoked: false };
}

export async function listStaff(locationId: string | null): Promise<StaffMember[]> {
  const { data, error } = await supabase.rpc("mar_staff", { p_location: locationId });
  if (error) throw new Error(error.message);
  return (data as StaffMember[]) ?? [];
}

// customers ------------------------------------------------------------------

export async function listCustomers(f: { locationId?: string | null; search?: string; mine?: string | null } = {}): Promise<Customer[]> {
  let q = supabase.from("mar_customers").select("*").order("updated_at", { ascending: false, nullsFirst: false }).limit(200);
  if (f.locationId) q = q.eq("location_id", f.locationId);
  if (f.mine) q = q.eq("owner_profile_id", f.mine);
  const s = f.search?.trim();
  if (s) q = q.or(`name.ilike.%${s.replace(/[%,()]/g, "")}%,mobile.ilike.%${s.replace(/\D/g, "") || "x"}%`);
  return must(await q) as Customer[];
}

export async function saveCustomer(c: Partial<Customer>, reason?: string): Promise<Customer> {
  const row = {
    location_id: c.location_id ?? null,
    name: c.name?.trim(),
    mobile: c.mobile?.replace(/\D/g, "").slice(-10) || null,
    email: c.email?.trim() || null,
    area: c.area?.trim() || null,
    source: c.source ?? null,
    is_test: c.is_test ?? false,
  };
  if (!row.name) throw new Error("Customer name is required.");
  if (row.mobile && row.mobile.length !== 10) throw new Error("Mobile must be 10 digits.");
  if (c.id) {
    // a senior correction carries its reason to the audit trigger in the same request
    const { data, error } = await supabase.rpc("mar_update_customer", {
      p_id: c.id,
      p_name: row.name,
      p_mobile: row.mobile,
      p_email: row.email,
      p_area: row.area,
      p_reason: reason ?? null,
    });
    if (error) throw new Error(error.message);
    return data as Customer;
  }
  return must(await supabase.from("mar_customers").insert(row).select("*").single()) as Customer;
}

// visits ------------------------------------------------------------------------

export async function listVisits(f: { locationId?: string | null; day?: string; assignedTo?: string | null; open?: boolean } = {}): Promise<Visit[]> {
  let q = supabase.from("mar_visits").select("*").order("arrived_at", { ascending: false }).limit(200);
  if (f.locationId) q = q.eq("location_id", f.locationId);
  if (f.assignedTo) q = q.eq("assigned_to", f.assignedTo);
  if (f.open) q = q.in("status", ["arrived", "waiting", "with_staff"]);
  if (f.day) {
    const { start, end } = istDayRange(f.day);
    q = q.gte("arrived_at", start).lt("arrived_at", end);
  }
  return must(await q) as Visit[];
}

export async function createVisit(v: Partial<Visit>): Promise<Visit> {
  return must(await supabase.from("mar_visits").insert(v).select("*").single()) as Visit;
}

export async function updateVisit(id: string, patch: Partial<Visit>): Promise<Visit> {
  return must(await supabase.from("mar_visits").update(patch).eq("id", id).select("*").single()) as Visit;
}

// interactions ----------------------------------------------------------------------

export async function listInteractions(f: { visitId?: string; customerId?: string; mineOpen?: string | null } = {}): Promise<Interaction[]> {
  let q = supabase.from("mar_interactions").select("*").order("created_at", { ascending: false }).limit(200);
  if (f.visitId) q = q.eq("visit_id", f.visitId);
  if (f.customerId) q = q.eq("customer_id", f.customerId);
  if (f.mineOpen) q = q.eq("created_by", f.mineOpen).is("done_at", null).not("due_at", "is", null);
  return must(await q) as Interaction[];
}

export async function saveInteraction(i: Partial<Interaction>): Promise<Interaction> {
  const m = await me();
  const row = { ...i, created_by: m?.profile_id };
  if (i.id) {
    const { id, ...patch } = row;
    return must(await supabase.from("mar_interactions").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id!).select("*").single()) as Interaction;
  }
  return must(await supabase.from("mar_interactions").insert(row).select("*").single()) as Interaction;
}

export async function deleteInteraction(id: string): Promise<void> {
  must(await supabase.from("mar_interactions").delete().eq("id", id));
}

// attendance ----------------------------------------------------------------------------

export async function markAttendance(kind: AttendanceKind, locationId: string | null, reason?: string) {
  let p: (LatLng & { accuracy?: number }) | null = null;
  try {
    p = await currentPosition();
  } catch {
    p = null; // no fix = UNKNOWN evidence, never "absent"
  }
  const dev = await enrollDevice().catch(() => null);
  if (dev?.revoked) throw new Error("This phone was removed from your login. Ask the Admin to enrol it again.");
  const m = await me();
  return must(
    await supabase
      .from("mar_attendance")
      .insert({
        location_id: locationId,
        profile_id: m?.profile_id,
        device_id: dev?.id ?? null,
        kind,
        lat: p?.lat ?? null,
        lng: p?.lng ?? null,
        accuracy_m: p?.accuracy ?? null,
        reason: reason ?? null,
        client_event: crypto.randomUUID(),
      })
      .select("*")
      .single(),
  ) as AttendanceEvent;
}

export async function listAttendance(profileId: string, day = todayIst()): Promise<AttendanceEvent[]> {
  const { start, end } = istDayRange(day);
  return must(await supabase.from("mar_attendance").select("*").eq("profile_id", profileId).gte("at", start).lt("at", end).order("at")) as AttendanceEvent[];
}

export async function attendanceDay(profileId: string, day = todayIst()): Promise<AttendanceDay> {
  const { data, error } = await supabase.rpc("mar_attendance_day", { p_profile: profileId, p_day: day });
  if (error) throw new Error(error.message);
  return data as AttendanceDay;
}

// driver steps ---------------------------------------------------------------------------

export async function myDriverTrips(): Promise<Trip[]> {
  const m = await me();
  const { data: d } = await supabase.from("mar_drivers").select("id").eq("profile_id", m?.profile_id ?? "").limit(5);
  const ids = (d ?? []).map((x) => x.id as string);
  if (!ids.length) return [];
  return must(
    await supabase.from("mar_trips").select("*").in("driver_id", ids).not("status", "in", "(completed,cancelled,done)").order("planned_at"),
  ) as Trip[];
}

export async function tripStep(tripId: string, to: DriverStep | "cancelled", note?: string) {
  let p: LatLng | null = null;
  try {
    p = await currentPosition();
  } catch {
    p = null;
  }
  const { data, error } = await supabase.rpc("mar_trip_step", {
    p_trip: tripId,
    p_to: to,
    p_lat: p?.lat ?? null,
    p_lng: p?.lng ?? null,
    p_note: note ?? null,
    p_client_event: crypto.randomUUID(),
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; from?: string; to: string; replayed?: boolean };
}

/** Opens Google Maps directions in the person's own Maps app / browser. No key, no account access. */
export function googleMapsDirections(dest: LatLng | string): string {
  const d = typeof dest === "string" ? dest : `${dest.lat},${dest.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d)}&travelmode=driving`;
}

// ---------------------------------------------------------------------------
// Home numbers
// ---------------------------------------------------------------------------

export async function dayStats(locationId: string | null, day = todayIst()): Promise<DayStats> {
  const { start, end } = istDayRange(day);
  let giQ = supabase.from("mar_gate_in").select("id", { count: "exact", head: true }).gte("in_at", start).lt("in_at", end);
  let goQ = supabase.from("mar_gate_out").select("id", { count: "exact", head: true }).gte("out_at", start).lt("out_at", end);
  let trQ = supabase.from("mar_trips").select("status,distance_km,amount").gte("created_at", start).lt("created_at", end);
  if (locationId) {
    giQ = giQ.eq("location_id", locationId);
    goQ = goQ.eq("location_id", locationId);
    trQ = trQ.eq("location_id", locationId);
  }
  const [gi, go, trips] = await Promise.all([giQ, goQ, trQ]);
  const rows = (trips.data ?? []) as { status: TripStatus; distance_km: number | null; amount: number | null }[];
  return {
    gateIn: gi.count ?? 0,
    gateOut: go.count ?? 0,
    tripsPlanned: rows.filter((t) => t.status === "planned").length,
    tripsRunning: rows.filter((t) => t.status === "running").length,
    tripsDone: rows.filter((t) => t.status === "done").length,
    kmToday: round1(rows.filter((t) => t.status !== "cancelled").reduce((s, t) => s + (Number(t.distance_km) || 0), 0)),
    payableToday: Math.round(rows.filter((t) => t.status === "done").reduce((s, t) => s + (Number(t.amount) || 0), 0) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Vehicle History - the whole life of a vehicle with us, from our data and the DMS screens. The screen is
// src/pages/VehicleHistoryPage.tsx; the database calls live in ./vehicleHistoryApi and are handed this file's
// client, so this file stays the only one that owns it.
// ---------------------------------------------------------------------------

export const vehicleHistory = (vehicle: string, tenant: string | null) => fetchVehicleHistory(supabase, vehicle, tenant);
export const vehicleSearch = (query: string, tenant: string | null) => fetchVehicleSearch(supabase, query, tenant);
export const isConsultant = () => fetchIsConsultant(supabase);
export const vhLiveAsk = (reg: string) => fetchVhLiveAsk(supabase, reg);
export const vhLiveStatus = (id: number) => fetchVhLiveStatus(supabase, id);

// ---------------------------------------------------------------------------
// Maruti Insurance (0214) - 5-Tier Fuzzy Matching, 9-Parameter Weights,
// 100% Daily Conversion Wall & 13-Portal Live 4W Car Rate Comparison Engine.
// ---------------------------------------------------------------------------

export const marInsDailyWall = (workDate?: string) => fetchMarInsDailyWall(supabase, workDate);
export const marInsWorkbench = (channel = "ALL", search = "", limit = 80) =>
  fetchMarInsWorkbench(supabase, channel, search, limit);
export const marInsPortalRates = (
  query: string,
  opts?: { model?: string; year?: number; cc?: number; ncb?: number; claims?: boolean },
) => fetchMarInsPortalRates(supabase, query, opts);
export const marInsCeoFuzzyBoard = (
  role: string | null | undefined,
  isPlatformAdmin?: boolean,
  from = "2026-10-01",
  to = "2026-11-01",
) => fetchMarInsCeoFuzzyBoard(supabase, role, isPlatformAdmin, from, to);
export const marInsCeoSaveWeights = (
  role: string | null | undefined,
  isPlatformAdmin: boolean | undefined,
  weights: Record<string, number>,
  from = "2026-10-01",
  to = "2026-11-01",
) => saveMarInsCeoWeights(supabase, role, isPlatformAdmin, weights, from, to);
export const marInsLogCall = (input: {
  bookId: number;
  outcome: string;
  temp?: "HOT" | "WARM" | "COLD";
  nextFollowUp?: string | null;
  remark?: string | null;
  quotedRs?: number | null;
}) => logMarInsCall(supabase, input);
export const marInsVerificationLoop = () => fetchMarInsVerificationLoop(supabase);
export const marInsVerifyDayAndPredictNext = (targetDate = "2026-11-03") =>
  verifyMarInsDayAndPredictNext(supabase, targetDate);

// ---------------------------------------------------------------------------
// Maruti Suzuki CRM for Periodic Maintenance Service Calling & PSF (0212)
// 5-Tier Cross-Book Fuzzy Matching, 10-Parameter Weights (100 pts),
// 5-Day Daily Calling vs Conversion Wall & >=90% Top-10% Monthly Capture (91.6%)
// ---------------------------------------------------------------------------

export interface MarCrmQueueRow {
  id: number;
  rank_overall: number;
  rank_in_ws: number;
  segment: string;
  priority_band: string;
  ws_code: string;
  workshop_name: string;
  channel: string;
  vin: string;
  reg_no: string;
  customer_name: string | null;
  mobile: string | null;
  model: string;
  last_service_date: string | null;
  last_service_type: string | null;
  last_paid_service_date: string | null;
  last_paid_service_type: string | null;
  last_bill_amt: number | null;
  last_km: number | null;
  projected_km_now: number | null;
  monthly_km: number | null;
  due_date: string | null;
  days_to_due: number | null;
  due_bucket: string | null;
  next_service_due: string;
  estimate_range_rs: string;
  appt_pipeline: boolean;
  bookings_90d: number;
  noshows_hist: number;
  attempts_90d: number;
  days_since_attempt: number | null;
  last_disp: string | null;
  loyalty_points: number;
  ours_advisor: string | null;
  ours_sa_mspin: string | null;
  why_call: string | null;
  param_scores: Record<string, number>;
  weighted_score: number;
  given_to_smre_date: string;
  assigned_smre: string | null;
  call_status: "PENDING" | "CALLED" | "BOOKED" | "CONVERTED" | "REFUSED";
  call_disposition: string | null;
  followup_date: string | null;
  call_notes: string | null;
  called_at: string | null;
  converted_jc_no: string | null;
  converted_date: string | null;
  converted_service_type: string | null;
  converted_bill_amt: number | null;
  fuzzy_match_tier: string | null;
  fuzzy_confidence: number | null;
  was_given_before_conv: boolean;
}

export interface MarCrmDailyWallRow {
  wall_date: string;
  is_five_day_window: boolean;
  given_for_calling: number;
  smre_calls_logged: number;
  appointments_booked: number;
  total_jc_opened: number;
  pms_converted_total: number;
  bodyshop_converted_total: number;
  presented_before_conv: number;
  not_on_list_walkin: number;
  tier1_exact_vin: number;
  tier2_exact_reg: number;
  tier3_fuzzy_reg_rto: number;
  tier4_vin6_model: number;
  tier5_mobile_fuzzy: number;
  converted_in_top5pct: number;
  converted_in_top10pct: number;
  focused_conv_total: number;
  focused_in_top10pct: number;
  top10pct_capture_rate: number;
  pms_revenue_rs: number;
  notes: string | null;
}

export interface MarCrmDailyVerificationRow {
  verify_date: string;
  next_call_date: string;
  is_five_day_window: boolean;
  given_to_smre_count: number;
  actual_pms_converted: number;
  static_list_caught: number;
  static_catch_pct: number;
  missed_not_due_rr_bodyshop: number;
  missed_fuzzy_tier2_5: number;
  missed_new_delivery_fr: number;
  missed_appt_walkin_pipeline: number;
  recalibrated_caught_total: number;
  next_day_guess_accuracy_pct: number;
  next_day_target_given: number;
  next_day_predicted_conversions: number;
  rule_adjustments_applied: string[];
  verified_at: string;
}

export interface MarCrmRescueRuleRow {
  rule_no: number;
  rule_key: string;
  title: string;
  problem_solved: string;
  next_day_fix: string;
  conversions_rescued_oct: number;
}

export interface MarCrmVerificationLoopData {
  summary: {
    days_verified: number;
    five_day_window_count: number;
    total_given_to_smre: number;
    total_actual_converted: number;
    total_static_caught: number;
    static_catch_pct: number;
    total_missed_not_due_rr_bodyshop: number;
    total_missed_fuzzy_tier2_5: number;
    total_missed_new_delivery_fr: number;
    total_missed_appt_pipeline: number;
    total_recalibrated_caught: number;
    next_day_guess_accuracy_pct: number;
    five_day_converted: number;
    five_day_recalibrated_caught: number;
    five_day_guess_accuracy_pct: number;
    last_verified_at: string | null;
  };
  five_day_loop: MarCrmDailyVerificationRow[];
  all_days_loop: MarCrmDailyVerificationRow[];
  rescue_rules: MarCrmRescueRuleRow[];
}

export interface MarCrmWorkbenchData {
  summary: {
    total_queue: number;
    top10_count: number;
    appt_booked: number;
    called_count: number;
    pending_count: number;
    converted_count: number;
    converted_in_top10: number;
    focused_count: number;
    vhr_count: number;
    future_due_count: number;
  };
  daily_wall: MarCrmDailyWallRow[];
  rows: MarCrmQueueRow[];
  verification_loop?: MarCrmVerificationLoopData;
}

export interface MarCrmWeightRow {
  param_key: string;
  label: string;
  category: string;
  description: string;
  weight_pts: number;
  default_pts: number;
  empirical_lift: string;
  sort_order: number;
}

export interface MarServiceTypeRow {
  service_code: string;
  family_group: "PMS_PAID" | "PMS_FREE" | "BODYSHOP";
  counts_as_pms_conv: boolean;
  bsc_nsc_flag: string | null;
  ravi_sheet_remark: string;
  explanation_detail: string | null;
  cei_dms_aliases: string[];
  dms_jc_raw_count: number;
  dms_jc_alias_count: number;
  dms_jc_total_count: number;
  sort_order: number;
}

export interface MarCrmMonthlyBoardRow {
  month_ym: string;
  source_mode: string;
  total_universe: number;
  focused_active_pool: number;
  pms_conversions_gross: number;
  bsc_excluded: number;
  pms_conversions_net: number;
  bodyshop_conversions: number;
  raw_all_seg_top10_pct: number;
  raw_all_seg_top20_pct: number;
  param10_focused_top5_pct: number;
  param10_focused_top10_pct: number;
  param10_focused_top15_pct: number;
  calls_in_top10_pct: number;
  target_90_met: boolean;
}

export interface MarCrmCeoBoardData {
  weights: MarCrmWeightRow[];
  service_types: MarServiceTypeRow[];
  five_day_wall: MarCrmDailyWallRow[];
  month_wall: MarCrmDailyWallRow[];
  monthly_board: MarCrmMonthlyBoardRow[];
  tier_summary: {
    total_pms_converted: number;
    total_bodyshop_converted: number;
    total_given_for_calling: number;
    total_smre_calls_logged: number;
    total_presented_before_conv: number;
    total_walkin_not_on_list: number;
    tier1_exact_vin: number;
    tier2_exact_reg: number;
    tier3_fuzzy_reg_rto: number;
    tier4_vin6_model: number;
    tier5_mobile_fuzzy: number;
    converted_in_top10pct: number;
    focused_conv_total: number;
    focused_in_top10pct: number;
    focused_top10_capture_pct: number;
    total_pms_revenue_rs: number;
  };
  fuzzy_samples: Array<{
    id: number;
    queue_reg: string;
    queue_vin: string;
    customer_name: string | null;
    model: string;
    ws_code: string;
    workshop_name: string;
    segment: string;
    priority_band: string;
    weighted_score: number;
    converted_jc_no: string;
    converted_date: string;
    converted_service_type: string;
    converted_bill_amt: number;
    fuzzy_match_tier: string;
    fuzzy_confidence: number;
    why_call: string | null;
  }>;
  verification_loop?: MarCrmVerificationLoopData;
}

export async function marCrmSmreWorkbench(
  workshop?: string | null,
  cohort?: string | null,
  search?: string | null,
): Promise<MarCrmWorkbenchData> {
  const { data, error } = await supabase.rpc("mar_crm_smre_workbench", {
    p_workshop: workshop ?? null,
    p_cohort: cohort ?? null,
    p_search: search ?? null,
  });
  if (error) throw new Error(error.message);
  return data as MarCrmWorkbenchData;
}

export async function marCrmLogCall(
  queueId: number,
  disposition: string,
  followupDate?: string | null,
  notes?: string | null,
): Promise<MarCrmQueueRow> {
  const { data, error } = await supabase.rpc("mar_crm_log_call", {
    p_queue_id: queueId,
    p_disposition: disposition,
    p_followup_date: followupDate || null,
    p_notes: notes || null,
  });
  if (error) throw new Error(error.message);
  return data as MarCrmQueueRow;
}

export async function marCrmCeoFuzzyBoard(fromDate = "2026-10-01", toDate = "2026-10-31"): Promise<MarCrmCeoBoardData> {
  const { data, error } = await supabase.rpc("mar_crm_ceo_fuzzy_board", {
    p_from: fromDate,
    p_to: toDate,
  });
  if (error) throw new Error(error.message);
  return data as MarCrmCeoBoardData;
}

export async function marCrmWeightsSet(weights: Record<string, number>, rescore = true): Promise<MarCrmCeoBoardData> {
  const { data, error } = await supabase.rpc("mar_crm_weights_set", {
    p_weights: weights,
    p_rescore: rescore,
  });
  if (error) throw new Error(error.message);
  return data as MarCrmCeoBoardData;
}

export async function marCrmVerifyDayAndPredictNext(
  verifyDate = "2026-10-26",
): Promise<MarCrmVerificationLoopData> {
  const { data, error } = await supabase.rpc("mar_crm_verify_day_and_predict_next", {
    p_date: verifyDate,
  });
  if (error) throw new Error(error.message);
  return data as MarCrmVerificationLoopData;
}

// ---------------------------------------------------------------------------
// Sehgal HR & All-India Manpower + HR Calling Workbench (0215)
// ---------------------------------------------------------------------------
import {
  fetchHrWorkbenchBundle,
  searchHrAllIndiaDirectory,
  searchHrSehgalBubble,
  searchHrSehgalBubbleMatrix,
  fetchHrCallingList,
  logHrCallAction,
  RULE2_TEST_NUMBERS,
  type HrWorkbenchBundle,
  type HrAllIndiaDirectoryRow,
  type HrSehgalBubbleRow,
  type HrCallingQueueRow,
  type HrTenantMatrixBundle,
  type HrBubbleMatrixResult,
  type HrAcceptanceTestRow,
} from "./hrApi";

export { RULE2_TEST_NUMBERS };
export type {
  HrWorkbenchBundle,
  HrAllIndiaDirectoryRow,
  HrSehgalBubbleRow,
  HrCallingQueueRow,
  HrTenantMatrixBundle,
  HrBubbleMatrixResult,
  HrAcceptanceTestRow,
};

export const hrWorkbenchBundle = () => fetchHrWorkbenchBundle(supabase);
export const hrSearchAllIndia = (params: Parameters<typeof searchHrAllIndiaDirectory>[1]) =>
  searchHrAllIndiaDirectory(supabase, params);
export const hrSearchSehgalBubble = (params: Parameters<typeof searchHrSehgalBubble>[1]) =>
  searchHrSehgalBubble(supabase, params);
export const hrSearchSehgalBubbleMatrix = (params: Parameters<typeof searchHrSehgalBubbleMatrix>[1]) =>
  searchHrSehgalBubbleMatrix(supabase, params);
export const hrCallingList = (params: Parameters<typeof fetchHrCallingList>[1]) =>
  fetchHrCallingList(supabase, params);
export const hrLogCallAction = (params: Parameters<typeof logHrCallAction>[1]) =>
  logHrCallAction(supabase, params);


// ---------------------------------------------------------------------------
// R66 (Ravi 04-11-2026): Unified 5-Chat Fuzzy + Claude 1B Parameters Synthesis,
// 100-Call Daily SMRE Queue, Monthly Targets (2,500 Maruti Ins w/ 86%+ 2nd+Yr = 17.5% Payout,
// 800 Nexa PMS + 2,000 Arena PMS = 2,800 One Service Type), Zero-Training Windows App,
// Customer Stamping & Silent Ripe-Lead Anti-Atrophy Balancer (0164 & 0217)
// ---------------------------------------------------------------------------

export interface SmreRosterBalanceRow {
  smre_id: string;
  smre_name: string;
  brand: "Hero" | "Maruti";
  stream: "Insurance" | "Periodic Maintenance Services";
  channel: string;
  employee_code?: string | null;
  closer_tier: "STRONG_CLOSER" | "RISING_MID" | "DEVELOPING_COACHED";
  daily_call_cap: number;
  conversion_rate_30d_pct: number;
  calls_today: number;
  stamped_customers_count: number;
  converted_this_month: number;
  monthly_target_share: number;
  transfers_received_today: number;
  transfers_sent_today: number;
  max_daily_ripe_transfers_in: number;
  min_daily_coaching_share: number;
  anti_atrophy_weight: number;
}

export interface SmreSilentTransferRow {
  transfer_id: number;
  stamp_key: string;
  brand: string;
  stream: string;
  channel: string;
  reg_no: string;
  customer_name: string;
  mobile: string;
  model_name: string;
  fuzzy_score: number;
  cell_1b_lift: number;
  ripe_reason: string;
  from_smre: string;
  from_smre_attempts: number;
  to_smre: string;
  to_smre_tier: string;
  to_smre_conv_rate_pct: number;
  anti_atrophy_rotation_note: string;
  transferred_at: string;
}

export interface SmreStampedCustomerRow {
  stamp_key: string;
  reg_no: string;
  vin_no?: string | null;
  customer_name: string;
  mobile: string;
  model_name: string;
  due_or_expiry_date?: string | null;
  retention_cohort: string;
  service_type_code: string;
  fuzzy_tier: string;
  fuzzy_score: number;
  cell_1b_lift: number;
  stamped_smre: string;
  attempt_count: number;
  disposition: string;
  temp: string;
  quoted_rs?: number | null;
  next_followup_date?: string | null;
  notes?: string | null;
  why_call?: string | null;
}

export interface SmreQueue100Row {
  call_rank_100: number;
  manufacturer?: string;
  insurance_segment?: string;
  selling_method?: string;
  glued_at?: string;
  in_top10_convertible_pool?: boolean;
  lead_id: string;
  reg_no: string;
  vin_no?: string | null;
  customer_name: string;
  mobile: string;
  model_name: string;
  channel: string;
  service_type: string;
  due_or_expiry_date: string;
  cohort_tag: string;
  fuzzy_tier: string;
  fuzzy_score: number;
  cell_1b_lift: number;
  stamped_smre: string;
  is_stamped_to_me: boolean;
  call_status: string;
  estimate_or_quote_rs: number;
  why_call: string;
}

export interface SmreSessionData {
  ok: boolean;
  allocation_mode?: string;
  top10_coverage?: Top10SegmentCoverageRow[];
  smre_name: string;
  brand: "Hero" | "Maruti";
  stream: "Insurance" | "Periodic Maintenance Services";
  channel: string;
  daily_call_cap: number;
  old_daily_call_cap_retired: number;
  queue_count: number;
  stamped_followups_count: number;
  smre_profile?: SmreRosterBalanceRow | null;
  targets: {
    hero_insurance_monthly_target: number;
    maruti_insurance_monthly_target: number;
    maruti_2nd_year_retention_target_pct: number;
    maruti_2nd_year_current_retention_pct: number;
    maruti_retention_payout_slab_pct: number;
    maruti_1st_year_retention_pct: number;
    maruti_pms_nexa_monthly_target: number;
    maruti_pms_arena_monthly_target: number;
    maruti_pms_total_monthly_target: number;
    pms_service_type_rule: string;
  };
  stamped_followups: SmreStampedCustomerRow[];
  queue_100: SmreQueue100Row[];
}

export interface UnifiedFuzzy1BSynthesisData {
  ok: boolean;
  allocation_policy?: string;
  top10_coverage?: Top10SegmentCoverageRow[];
  daily_call_cap_per_smre: number;
  old_call_cap_retired: number;
  monthly_targets: {
    commercial_insurance?: number;
    hero_insurance: number;
    maruti_insurance: number;
    maruti_ins_1st_yr_retention_pct: number;
    maruti_ins_2nd_plus_yr_retention_pct: number;
    maruti_ins_retention_threshold_pct: number;
    maruti_ins_payout_slab_pct: number;
    maruti_pms_nexa_one_service_type: number;
    maruti_pms_arena_one_service_type: number;
    maruti_pms_total_one_service_type: number;
    combined_monthly_conversions_target: number;
  };
  claude_1b_and_gpu_refinery: {
    set6_total_unique_parameters: number;
    set6_sectors: number;
    set6_grid_partitions: number;
    lake_fed_active_1b_cells: number;
    ml_due_date_additional_cells: number;
    gpu_evaluated_automotive_cells: number;
    top_cell_lift_11plus_paid_low_bill: number;
    first_free_service_fr1_lift: number;
    events_churned_gpu_cpu: number;
    persons_resolved: number;
    vehicles_linked: number;
    households_linked: number;
    repeat_vehicle_buyers: number;
    motor_policies_linked: number;
    ac_labour_lines_extracted: number;
  };
  streams: Array<{
    stream_id: string;
    sort_order: number;
    brand: string;
    stream_name: string;
    service_type_rule: string;
    source_chat_ref: string;
    monthly_target_nos: number;
    daily_target_nos: number;
    daily_calls_per_smre: number;
    old_calls_per_smre: number;
    retention_payout_rule: string;
    fuzzy_tiers_active: string[];
    parameter_engine_summary: string;
    claude_1b_cells_linked: number;
    gpu_cpu_events_churned: number;
    households_linked: number;
    top_cell_lift_multiplier: number;
    closed_loop_catch_pct: number;
  }>;
  roster_balance: SmreRosterBalanceRow[];
  silent_transfers: SmreSilentTransferRow[];
  stamped_customers: SmreStampedCustomerRow[];
}

export async function smreStartCallingSession(
  smreName: string,
  brand: "Hero" | "Maruti" = "Maruti",
  stream: "Insurance" | "Periodic Maintenance Services" = "Insurance",
  channel = "ALL",
): Promise<SmreSessionData> {
  const { data, error } = await supabase.rpc("smre_start_calling_session", {
    p_smre_name: smreName,
    p_brand: brand,
    p_stream: stream,
    p_channel: channel,
  });
  if (error) throw new Error(error.message);
  return data as SmreSessionData;
}

export async function smreStampCustomer(input: {
  smreName: string;
  brand?: "Hero" | "Maruti";
  stream: "Insurance" | "Periodic Maintenance Services";
  channel?: string;
  leadRefId?: string;
  regNo: string;
  vinNo?: string;
  customerName: string;
  mobile: string;
  modelName: string;
  dueDate?: string;
  disposition: string;
  temp?: "HOT" | "WARM" | "COLD";
  followupDate?: string | null;
  quotedRs?: number | null;
  notes?: string;
  fuzzyScore?: number;
  cell1bLift?: number;
}): Promise<{
  ok: boolean;
  stamp_key: string;
  reg_no: string;
  stamped_to_smre: string;
  attempt_count: number;
  is_ripe: boolean;
  is_converted: boolean;
  silently_transferred: boolean;
}> {
  const { data, error } = await supabase.rpc("smre_stamp_customer", {
    p_smre_name: input.smreName,
    p_brand: input.brand ?? "Maruti",
    p_stream: input.stream,
    p_channel: input.channel ?? "ALL",
    p_lead_ref_id: input.leadRefId ?? input.regNo,
    p_reg_no: input.regNo,
    p_vin_no: input.vinNo ?? "",
    p_customer_name: input.customerName,
    p_mobile: input.mobile,
    p_model_name: input.modelName,
    p_due_date: input.dueDate ?? "",
    p_disposition: input.disposition,
    p_temp: input.temp ?? "HOT",
    p_followup_date: input.followupDate || null,
    p_quoted_rs: input.quotedRs ?? null,
    p_notes: input.notes ?? "",
    p_fuzzy_score: input.fuzzyScore ?? 92.5,
    p_cell_1b_lift: input.cell1bLift ?? 5.4,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function smreRunSilentRipeTransfer(
  brand = "Maruti",
  stream = "ALL",
): Promise<{
  ok: boolean;
  newly_transferred: number;
  total_silent_transfers: number;
  roster_balance: SmreRosterBalanceRow[];
  recent_transfers: SmreSilentTransferRow[];
}> {
  const { data, error } = await supabase.rpc("smre_run_silent_ripe_transfer", {
    p_brand: brand,
    p_stream: stream,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchUnifiedFuzzy1BSynthesis(): Promise<UnifiedFuzzy1BSynthesisData> {
  const { data, error } = await supabase.rpc("get_unified_fuzzy_1b_synthesis");
  if (error) throw new Error(error.message);
  return data as UnifiedFuzzy1BSynthesisData;
}

export type InsuranceSegmentCode = "COMMERCIAL_INSURANCE" | "BIKE_INSURANCE" | "CAR_INSURANCE" | "ALL";
export type SellingMethodCode =
  | "PHONE_CALL"
  | "WHATSAPP_QUOTE"
  | "WORKSHOP_GATE_IN"
  | "FLEET_VISIT"
  | "LAPSED_RESCUE";

export interface Top10SegmentCoverageRow {
  segment_code: "COMMERCIAL_INSURANCE" | "BIKE_INSURANCE" | "CAR_INSURANCE";
  segment_label: string;
  universe_total: number;
  top10_pool_size: number;
  target_90pct_calls: number;
  called_and_glued_today: number;
  calling_coverage_pct: number;
  target_90_met: boolean;
  unglued_remaining_in_top10: number;
  converted_today: number;
  oem_breakdown: string;
}

export async function insCommonMethodPullNextCustomer(input: {
  smreName: string;
  segment: InsuranceSegmentCode;
  sellingMethod?: SellingMethodCode;
  count?: number;
}): Promise<{
  ok: boolean;
  smre_name: string;
  segment: string;
  selling_method: string;
  glued_count: number;
  glued_customers: SmreQueue100Row[];
  top10_coverage: Top10SegmentCoverageRow[];
}> {
  const { data, error } = await supabase.rpc("ins_common_method_pull_next_customer", {
    p_smre_name: input.smreName,
    p_segment: input.segment,
    p_selling_method: input.sellingMethod ?? "PHONE_CALL",
    p_count: input.count ?? 1,
  });
  if (error) throw new Error(error.message);
  return data;
}
