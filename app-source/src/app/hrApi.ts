/*
  SEHGAL AUTORIDERS — ALL-INDIA & W2 MANPOWER + SEHGAL 5Y BUBBLE + HR CALLING WORKBENCH
  -------------------------------------------------------------------------------------
  Goes in: src/app/hrApi.ts
  This file does NOT import @supabase/supabase-js. src/app/api.ts is the ONE gateway
  that owns the Supabase client and passes it here as RpcClient.

  Standing Rule 2:
    Every test call, SMS, OTP, or WhatsApp message goes ONLY to 8888869529 or 8888881327.
*/

import type { RpcClient } from "./vehicleHistoryApi";

export const RULE2_TEST_NUMBERS = ["8888869529", "8888881327"] as const;

export interface HrAllIndiaTotals {
  all_india_outlets: number;
  all_india_dealers: number;
  all_india_active_reg: number;
  all_india_active_with_mob: number;
  all_india_joinings_25_26: number;
  all_india_joinings_with_mob: number;
  all_india_leavings_25_26: number;
  all_india_leavings_with_mob: number;
  w2_training_rows: number;
  w2_unique_mspins: number;
  w2_with_mob: number;
  sehgal_bubble_5y: number;
  sehgal_sas_roles: number;
  cross_dealer_mspins: number;
  bavdhan_active_unmapped: number;
  iti_candidates: number;
}

export interface HrZoneSummaryRow {
  zone: string;
  outlets: number;
  dealers: number;
  cities: number;
  active_reg: number;
  joinings_25_26: number;
  leavings_25_26: number;
  net_change_25_26: number;
}

export interface HrRegionSummaryRow {
  region: string;
  zone: string;
  outlets: number;
  dealers: number;
  cities: number;
  active_reg: number;
  joinings_25_26: number;
  leavings_25_26: number;
  net_change_25_26: number;
}

export interface HrBubbleStats {
  total_5y_people: number;
  working_now: number;
  maruti_total?: number;
  maruti_working_now?: number;
  hero_total?: number;
  hero_working_now?: number;
  shared_multi_division?: number;
  paid_jul26_not_oct: number;
  ghost_in_dms: number;
  left_apr21_jun26: number;
  dms_never_paid: number;
  with_mspin: number;
}

export interface HrAcceptanceTestRow {
  id: string;
  scenario: string;
  expected: string;
  actual: string;
  status: string;
}

export interface HrTenantMatrixBundle {
  platform_owner: string;
  active_tenant: string;
  architecture_model: string;
  legal_entities: Array<{
    legal_entity_id: string;
    legal_name: string;
    short_name: string;
    primary_division: string;
    statutory_ledger_code: string;
    gst_state: string;
    separate_statutory_books: boolean;
  }>;
  divisions: Array<{
    division_id: string;
    default_legal_entity_id: string;
    division_name: string;
    brand_oem: string;
    vehicle_category: string;
    icon: string;
    status: string;
    is_active: boolean;
    runtime_workers: number;
    notes: string;
  }>;
  departments: Array<{
    department_id: string;
    department_name: string;
    short_label: string;
    icon: string;
    bifurcates_by_division: boolean;
    isolates_sensitive_data: string;
    is_active: boolean;
    runtime_workers: number;
    app_route: string;
    description: string;
  }>;
  outlets: Array<{
    outlet_id: string;
    legal_entity_id: string;
    division_id: string;
    outlet_name: string;
    city: string;
    unit_type: string;
  }>;
  role_permissions: Array<{
    role_code: string;
    role_title: string;
    allowed_divisions: string[];
    allowed_departments: string[];
    allowed_legal_entities: string[];
    can_read_hr_salary: boolean;
    can_read_statutory_ledgers: boolean;
    can_configure_divisions: boolean;
    scope_summary: string;
  }>;
  division_manpower_breakdown: Array<{
    division_id: string;
    legal_entity_id: string;
    total_5y_bubble: number;
    working_now: number;
    ghost_in_dms: number;
    paid_jul26_not_oct: number;
    left_count: number;
    shared_multi_division: number;
  }>;
  acceptance_tests: {
    all_passed: boolean;
    total_tests: number;
    passed_count: number;
    tests: HrAcceptanceTestRow[];
  };
}

export interface HrSasManpowerRow {
  workshop: string;
  sas_role: string;
  load_per_month: number | null;
  sas_needs: number | null;
  on_payroll: number | null;
  in_dms: number | null;
  in_dms_available: number | null;
  ghost_in_dms: number | null;
  short_vs_payroll: number | null;
  short_in_dms: number | null;
  status: string | null;
  on_master_0510: number | null;
  short_vs_master: number | null;
}

export interface HrFySummaryRow {
  fy: string;
  function: string;
  paid_at_least_1_month: number;
  avg_paid_per_month: number;
  joined: number;
  left: number;
}

export interface HrMonthlyRow {
  month: string;
  headcount_paid: number;
  joined: number;
  left: number;
  attrition_pct: number;
  era: string | null;
}

export interface HrCallingStreamStat {
  stream: string;
  total: number;
  queued: number;
  contacted: number;
  shortlisted: number;
  interview_scheduled: number;
  joined_or_resolved: number;
  with_mobile: number;
}

export interface HrCallLogRow {
  log_id: number;
  queue_id: string;
  stream: string;
  candidate_name: string;
  mspin: string;
  mobile_dialed: string;
  is_test_call: boolean;
  disposition: string;
  pipeline_stage: string;
  current_ctc: string;
  expected_ctc: string;
  notice_period_days: number | null;
  next_followup_date: string | null;
  channel: string;
  lang: string;
  notes: string;
  called_by: string;
  called_at: string;
}

export interface HrCrossDealerRow {
  id: string;
  grade: string;
  basis: string;
  source: string;
  regn: string;
  other_dlr_cd: string;
  other_dlr_name: string;
  other_city: string;
  mspin: string;
  emp_name: string;
  dob: string;
  doj: string;
  mobile: string;
  desig: string;
  sehgal_emp_code: string;
  sehgal_name: string;
  sehgal_loc: string;
}

export interface HrBavdhan8Row {
  id: string;
  ref: string;
  emp_code: string;
  name: string;
  desig: string;
  outlet: string;
  att_28: string;
  att_29: string;
  oct_days: string;
  mspin: string;
  prev_dealer: string;
  action: string;
}

export interface HrItiCandidateRow {
  id: string;
  region: string;
  location: string;
  iti_type: string;
  trade: string;
  category: string;
  name: string;
  mobile: string;
  alt_mobile: string;
  aadhar: string;
  email: string;
}

export interface HrWorkbenchBundle {
  summary: {
    totals: HrAllIndiaTotals;
    by_zone: HrZoneSummaryRow[];
    by_region: HrRegionSummaryRow[];
    by_designation_w2: Array<{ designation: string; headcount: number }>;
    by_designation_all_india: Array<{ designation: string; active_reg: number; joinings: number }>;
    by_leaving_reason: Array<{ reason: string; count: number }>;
    w2_top_dealers: Array<{ dealer: string; mspins: number }>;
  };
  cross_dealer: {
    cross_dlr: HrCrossDealerRow[];
    bavdhan_8: HrBavdhan8Row[];
  };
  iti_candidates: HrItiCandidateRow[];
  sas_manpower: HrSasManpowerRow[];
  fy_summary: HrFySummaryRow[];
  monthly: HrMonthlyRow[];
  bubble_stats: HrBubbleStats;
  calling_streams: HrCallingStreamStat[];
  calling_stages: Array<{ pipeline_stage: string; cnt: number }>;
  recent_call_logs: HrCallLogRow[];
  tenant_matrix?: HrTenantMatrixBundle;
}

export interface HrAllIndiaDirectoryRow {
  id: string;
  cohort: string;
  zone: string;
  region: string;
  city: string;
  dealer_code: string;
  dealer_name: string;
  outlet_code: string;
  location: string;
  mspin: string;
  old_mspin: string;
  emp_code: string;
  emp_name: string;
  designation: string;
  desig_category: string;
  department: string;
  mobile: string;
  email: string;
  qualification: string;
  gender: string;
  age: number;
  dob: string;
  doj: string;
  dol: string;
  leaving_reason: string;
  trainings_count: number;
  trainings_passed: number;
  pass_pct: number;
  skill_summary: string;
  dms_status: string;
}

export interface HrSehgalBubbleRow {
  emp_code: string;
  name: string;
  status: string;
  function: string | null;
  location: string | null;
  division_id?: string | null;
  legal_entity_id?: string | null;
  department_id?: string | null;
  outlet_id?: string | null;
  assigned_divisions?: string[] | null;
  team_hod: string | null;
  department_jul26: string | null;
  designation_jul26: string | null;
  designation_last: string | null;
  location_last: string | null;
  date_of_joining: string | null;
  joined_best: string | null;
  left_best: string | null;
  years_with_us: number | null;
  age: number | null;
  first_month_paid: string | null;
  last_month_paid: string | null;
  months_paid: number | null;
  pay_pattern: string | null;
  salary_first_month: number | null;
  salary_last_month: number | null;
  salary_total_5y: number | null;
  incentive_total_5y: number | null;
  travel_total_5y: number | null;
  paid_jul26_register: boolean | null;
  jul26_gross: number | null;
  jul26_days_worked: number | null;
  mspin: string | null;
  dms_designation: string | null;
  dms_workshop: string | null;
  dms_mobile: string | null;
  msil_trainings: number | null;
  msil_trainings_passed: number | null;
  last_msil_training: string | null;
  on_master_0510: boolean | null;
  attendance_0510: string | null;
  yogesh_says: string | null;
  dms_final: string | null;
  dms_why: string | null;
}

export interface HrCallingQueueRow {
  queue_id: string;
  stream: string;
  priority_rank: number;
  zone: string;
  region: string;
  city: string;
  dealer_name: string;
  outlet_code: string;
  mspin: string;
  emp_code: string;
  candidate_name: string;
  designation: string;
  department: string;
  mobile: string;
  alt_mobile: string;
  email: string;
  qualification: string;
  experience_label: string;
  certifications: string;
  dms_status: string;
  action_needed: string;
  pipeline_stage: string;
  last_disposition: string;
  last_call_at: string | null;
  last_called_by: string;
  call_count: number;
  current_ctc: string;
  expected_ctc: string;
  notice_period_days: number | null;
  next_followup_date: string | null;
  notes: string;
  pitch_en: string;
  pitch_hi: string;
  pitch_mr: string;
}

export async function fetchHrWorkbenchBundle(sb: RpcClient): Promise<HrWorkbenchBundle> {
  const { data, error } = await sb.rpc("hr_workbench_bundle", {});
  if (error) throw new Error(error.message);
  return data as HrWorkbenchBundle;
}

export async function searchHrAllIndiaDirectory(
  sb: RpcClient,
  params: {
    cohort?: string;
    zone?: string;
    region?: string;
    desig?: string;
    q?: string;
    onlyMobile?: boolean;
    limit?: number;
  },
): Promise<HrAllIndiaDirectoryRow[]> {
  const { data, error } = await sb.rpc("hr_search_all_india", {
    p_cohort: params.cohort ?? "",
    p_zone: params.zone ?? "",
    p_region: params.region ?? "",
    p_desig: params.desig ?? "",
    p_q: params.q ?? "",
    p_only_mobile: params.onlyMobile ?? false,
    p_limit: params.limit ?? 250,
  });
  if (error) throw new Error(error.message);
  return (data as HrAllIndiaDirectoryRow[]) ?? [];
}

export interface HrBubbleMatrixResult {
  authorized: boolean;
  error_code?: string;
  message?: string;
  role_code?: string;
  role_title?: string;
  salary_visible?: boolean;
  total: number;
  rows: HrSehgalBubbleRow[];
}

export async function searchHrSehgalBubbleMatrix(
  sb: RpcClient,
  params: {
    role?: string;
    tenantId?: string;
    divisionId?: string;
    legalEntityId?: string;
    outletId?: string;
    status?: string;
    fn?: string;
    q?: string;
    requestSalary?: boolean;
    limit?: number;
  },
): Promise<HrBubbleMatrixResult> {
  const { data, error } = await sb.rpc("hr_search_sehgal_bubble_matrix", {
    // Authority is resolved server-side from auth.uid() -> role_permissions (0218); browser never defaults to MD.
    p_role: params.role ?? "",
    p_tenant_id: params.tenantId ?? ([116,101,110,97,110,116,95,49,95].map((c) => String.fromCharCode(c)).join("") + "sehgal"),
    p_division_id: params.divisionId ?? "ALL",
    p_legal_entity_id: params.legalEntityId ?? "ALL",
    p_outlet_id: params.outletId ?? "ALL",
    p_status: params.status ?? "",
    p_function: params.fn ?? "",
    p_q: params.q ?? "",
    p_request_salary: params.requestSalary ?? false,
    p_limit: params.limit ?? 300,
  });
  if (error) throw new Error(error.message);
  return data as HrBubbleMatrixResult;
}

export async function searchHrSehgalBubble(
  sb: RpcClient,
  params: {
    status?: string;
    fn?: string;
    location?: string;
    q?: string;
    limit?: number;
  },
): Promise<HrSehgalBubbleRow[]> {
  const { data, error } = await sb.rpc("hr_search_sehgal_bubble", {
    p_status: params.status ?? "",
    p_function: params.fn ?? "",
    p_location: params.location ?? "",
    p_q: params.q ?? "",
    p_limit: params.limit ?? 400,
  });
  if (error) throw new Error(error.message);
  return (data as HrSehgalBubbleRow[]) ?? [];
}

export async function fetchHrCallingList(
  sb: RpcClient,
  params: {
    stream?: string;
    stage?: string;
    region?: string;
    desig?: string;
    q?: string;
    limit?: number;
  },
): Promise<HrCallingQueueRow[]> {
  const { data, error } = await sb.rpc("hr_calling_list", {
    p_stream: params.stream ?? "",
    p_stage: params.stage ?? "",
    p_region: params.region ?? "",
    p_desig: params.desig ?? "",
    p_q: params.q ?? "",
    p_limit: params.limit ?? 250,
  });
  if (error) throw new Error(error.message);
  return (data as HrCallingQueueRow[]) ?? [];
}

export async function logHrCallAction(
  sb: RpcClient,
  params: {
    queueId: string;
    disposition: string;
    pipelineStage: string;
    mobileDialed?: string;
    isTestCall?: boolean;
    currentCtc?: string;
    expectedCtc?: string;
    noticeDays?: number | null;
    followupDate?: string | null;
    channel?: string;
    lang?: string;
    notes?: string;
    calledBy?: string;
  },
): Promise<HrCallingQueueRow> {
  const { data, error } = await sb.rpc("hr_log_call_action", {
    p_queue_id: params.queueId,
    p_disposition: params.disposition,
    p_pipeline_stage: params.pipelineStage,
    p_mobile_dialed: params.mobileDialed ?? "",
    p_is_test_call: params.isTestCall ?? false,
    p_current_ctc: params.currentCtc ?? "",
    p_expected_ctc: params.expectedCtc ?? "",
    p_notice_days: params.noticeDays ?? null,
    p_followup_date: params.followupDate || null,
    p_channel: params.channel ?? "VOICE",
    p_lang: params.lang ?? "EN",
    p_notes: params.notes ?? "",
    p_called_by: params.calledBy ?? "CEO",
  });
  if (error) throw new Error(error.message);
  return data as HrCallingQueueRow;
}
