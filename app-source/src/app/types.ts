/*
  Shared shapes for the Sehgal Maruti app. These mirror the mar_* tables created by
  supabase/migrations/0200_sehgal_maruti_schema.sql. Keep them narrow: a screen never
  needs org_id, and every row that reaches a screen has already passed RLS.
*/

export type MarRole =
  | "admin"
  | "ceo"
  | "vp"
  | "avp"
  | "gm"
  | "agm"
  | "wm"
  | "ccm"
  | "bsm"
  | "sa"
  | "sales"
  | "reception"
  | "technician"
  | "guard"
  | "driver"
  | "staff";

export const ROLE_LABEL: Record<MarRole, string> = {
  admin: "Administrator",
  ceo: "CEO",
  vp: "Vice President",
  avp: "Asst. Vice President",
  gm: "General Manager",
  agm: "Asst. General Manager",
  wm: "Workshop Manager",
  ccm: "Customer Care Manager",
  bsm: "Bodyshop Manager",
  sa: "Service Advisor",
  sales: "Sales Executive",
  reception: "Reception",
  technician: "Technician",
  guard: "Security",
  driver: "Driver",
  staff: "Staff",
};

export interface TenantRef {
  id: string;
  code: string;
  name: string;
  tenant_no: number | null;
  role?: MarRole;
}

/** What mar_me() returns: who the signed-in person is INSIDE the Maruti tenant. */
export interface MarMe {
  profile_id: string;
  login_code: string | null;
  display_name: string;
  home_org_id: string;
  is_platform_admin: boolean;
  tenant: TenantRef | null;
  tenants: TenantRef[] | null;
  role: MarRole | null;
  rank: number;
  designation: string | null;
  location_ids: string[] | null;
  can_manage_drivers: boolean;
  is_admin: boolean;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  msil_outlet_code: string | null;
  msil_locn: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
}

export interface Designation {
  code: string;
  name: string;
  role: MarRole;
  rank: number;
  source: string;
  is_active: boolean;
  sort_order: number;
}

export interface RateCard {
  id: string;
  location_id: string | null;
  name: string;
  per_km: number;
  base_fare: number;
  min_charge: number;
  waiting_per_hour: number;
  night_pct: number;
  night_from: string;
  night_to: string;
  round_trip_factor: number;
  effective_from: string;
  is_active: boolean;
  notes: string | null;
}

export interface Driver {
  id: string;
  location_id: string | null;
  name: string;
  mobile: string | null;
  licence_no: string | null;
  vehicle_no: string | null;
  is_active: boolean;
}

export type TripKind = "pickup" | "drop" | "round";
/** planned/running/done = the first Pick & Drop table; assigned..completed = the driver steps (0204). */
export type TripStatus =
  | "planned"
  | "running"
  | "done"
  | "cancelled"
  | "assigned"
  | "accepted"
  | "en_route"
  | "arrived"
  | "custody"
  | "delivered"
  | "completed";
export const DRIVER_STEPS = ["assigned", "accepted", "en_route", "arrived", "custody", "delivered", "completed"] as const;
export type DriverStep = (typeof DRIVER_STEPS)[number];
export type DistanceSource = "osrm" | "gps" | "haversine" | "manual";

export interface Trip {
  id: string;
  location_id: string | null;
  driver_id: string | null;
  driver_name: string | null;
  kind: TripKind;
  reg_no: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  jc_no: string | null;
  pick_address: string | null;
  pick_lat: number | null;
  pick_lng: number | null;
  drop_address: string | null;
  drop_lat: number | null;
  drop_lng: number | null;
  planned_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  distance_km: number | null;
  distance_source: DistanceSource | null;
  waiting_minutes: number;
  rate_card_id: string | null;
  rate_snapshot: RateCard | null;
  amount: number | null;
  amount_breakdown: Record<string, number | string | boolean> | null;
  status: TripStatus;
  notes: string | null;
  created_at: string;
}

export interface GateIn {
  id: string;
  location_id: string | null;
  entry_no: number;
  reg_no: string | null;
  reg_no_ocr: string | null;
  reg_confidence: number | null;
  reg_source: "ocr" | "manual" | null;
  customer_name: string | null;
  mobile: string | null;
  model: string | null;
  km_in: number | null;
  purpose: string | null;
  jc_no: string | null;
  brought_by: string | null;
  sa_name: string | null;
  photo_vehicle: string | null;
  photo_plate: string | null;
  notes: string | null;
  status: "in" | "out";
  in_at: string;
}

export interface GateOut {
  id: string;
  location_id: string | null;
  gate_in_id: string | null;
  reg_no: string | null;
  reg_no_ocr: string | null;
  reg_confidence: number | null;
  reg_source: "ocr" | "manual" | null;
  km_out: number | null;
  gate_pass_no: string | null;
  gate_pass_ocr: string | null;
  receipt_no: string | null;
  receipt_amount: number | null;
  receipt_ocr: string | null;
  photo_vehicle: string | null;
  photo_gate_pass: string | null;
  photo_receipt: string | null;
  authorised_by: string | null;
  notes: string | null;
  out_at: string;
}

export type MediaKind = "gate_in_vehicle" | "gate_in_plate" | "gate_out_vehicle" | "gate_out_gate_pass" | "gate_out_receipt";

export interface MediaRow {
  id: string;
  app: string;
  kind: MediaKind | string;
  reg_no: string | null;
  bucket: string;
  path: string;
  taken_at: string;
  ocr_text: string | null;
}

export interface OcrReading {
  text: string;
  confidence: number;
  provider: string;
  validated: boolean;
}
/**
 * Why a photo gave no reading. Since Hero App r34 (31-10-2026) read-text asks only the office OCR Tree:
 * 'reader-not-answering' = the tree gave nothing back (busy, late or the office PC off - not the photo's fault),
 * 'not-available' = the tree has no reader for this task yet, 'unreadable' = a reply that read nothing.
 */
export type OcrFailReason = "unreadable" | "reader-not-answering" | "not-available" | "not-configured" | "offline";
export type OcrOutcome = { ok: true; reading: OcrReading } | { ok: false; reason: OcrFailReason; detail?: string };

export interface LatLng {
  lat: number;
  lng: number;
}
export interface GeoHit extends LatLng {
  label: string;
}

export interface TenantUser {
  profile_id: string;
  login_code: string | null;
  display_name: string;
  contact_mobile: string | null;
  role: MarRole;
  designation: string | null;
  location_ids: string[] | null;
  is_active: boolean;
}

/* ------------------------------------------------ master app (0204_sehgal_maruti_master) */

export interface Customer {
  id: string;
  location_id: string | null;
  name: string;
  mobile: string | null;
  email: string | null;
  area: string | null;
  owner_profile_id: string | null;
  source: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string | null;
}

export type VisitPurpose = "sales" | "service" | "bodyshop" | "delivery" | "other";
export type VisitStatus = "arrived" | "waiting" | "with_staff" | "done" | "left" | "cancelled";

export interface Visit {
  id: string;
  location_id: string | null;
  visit_no: number;
  gate_in_id: string | null;
  customer_id: string | null;
  visitor_name: string | null;
  visitor_mobile: string | null;
  reg_no: string | null;
  purpose: VisitPurpose;
  appointment_at: string | null;
  assigned_to: string | null;
  assigned_role: string | null;
  w2_ref: string | null;
  status: VisitStatus;
  notes: string | null;
  is_test: boolean;
  arrived_at: string;
  assigned_at: string | null;
  closed_at: string | null;
}

export type InteractionKind = "note" | "test_drive" | "finance" | "quotation" | "follow_up" | "service_note" | "tech_note";

export interface SenseField {
  key: string;
  value: string;
  confidence: number;
  excerpt: string;
}

export interface Interaction {
  id: string;
  location_id: string | null;
  visit_id: string | null;
  customer_id: string | null;
  kind: InteractionKind;
  body: string | null;
  fields: { items: SenseField[]; unclear?: string[]; vocab?: string } | null;
  source: "typed" | "sense";
  consent: boolean;
  confirmed: boolean;
  due_at: string | null;
  done_at: string | null;
  is_test: boolean;
  created_by: string | null;
  created_at: string;
}

export interface StaffMember {
  profile_id: string;
  display_name: string;
  role: MarRole;
  designation: string | null;
}

export type AttendanceKind = "check_in" | "check_out" | "break_start" | "break_end" | "duty_out" | "duty_back";

export interface AttendanceEvent {
  id: string;
  location_id: string | null;
  profile_id: string;
  kind: AttendanceKind;
  at: string;
  distance_m: number | null;
  on_site: boolean | null;
  accuracy_m: number | null;
  reason: string | null;
}

/** mar_attendance_day(): minutes, never a guess - unknown is reported beside the percentages. */
export interface AttendanceDay {
  day: string;
  profile_id: string;
  location: string | null;
  shift_from: string;
  shift_to: string;
  scheduled_min: number;
  on_site_min: number;
  approved_offsite_min: number;
  break_min: number;
  unknown_min: number;
  on_site_pct: number | null;
  accounted_pct: number | null;
  first_check_in: string | null;
  last_verified_on_site: string | null;
  possible_early_leave: boolean;
  outside_episodes: number;
  avg_outside_min: number | null;
}

export interface DayStats {
  gateIn: number;
  gateOut: number;
  tripsPlanned: number;
  tripsRunning: number;
  tripsDone: number;
  kmToday: number;
  payableToday: number;
}
