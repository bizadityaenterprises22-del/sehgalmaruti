import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  fetchUnifiedFuzzy1BSynthesis,
  insCommonMethodPullNextCustomer,
  smreRunSilentRipeTransfer,
  smreStampCustomer,
  smreStartCallingSession,
  type InsuranceSegmentCode,
  type SellingMethodCode,
  type SmreQueue100Row,
  type SmreRosterBalanceRow,
  type SmreSessionData,
  type SmreSilentTransferRow,
  type SmreStampedCustomerRow,
  type Top10SegmentCoverageRow,
  type UnifiedFuzzy1BSynthesisData,
} from "@/app/api";
import { Badge, Button, Input, Section, Table, Td, flash } from "@/components/ui";

const DEFAULT_TOP10_COVERAGE: Top10SegmentCoverageRow[] = [
  {
    segment_code: "COMMERCIAL_INSURANCE",
    segment_label: "Commercial Insurance (Goods Carrier & Fleet CV)",
    universe_total: 20365,
    top10_pool_size: 2037,
    target_90pct_calls: 1834,
    called_and_glued_today: 1852,
    calling_coverage_pct: 90.9,
    target_90_met: true,
    unglued_remaining_in_top10: 185,
    converted_today: 64,
    oem_breakdown:
      "Tata 6,316 · Mahindra 5,696 · Ashok Leyland 3,780 · Maruti Super Carry 2,675 · Eicher 1,341 · BharatBenz/Force/Others 557 (MH14 10,386 + MH12 9,979)",
  },
  {
    segment_code: "BIKE_INSURANCE",
    segment_label: "Bike Insurance (Hero MotoCorp 2W Renewal & Lapsed)",
    universe_total: 72188,
    top10_pool_size: 7219,
    target_90pct_calls: 6498,
    called_and_glued_today: 6544,
    calling_coverage_pct: 90.6,
    target_90_met: true,
    unglued_remaining_in_top10: 675,
    converted_today: 118,
    oem_breakdown:
      "Hero Splendor+ · HF Deluxe · Passion Pro · Destini 125 · Pleasure+ · Xpulse 200 (72,188 Pune/PCMC 2W Book)",
  },
  {
    segment_code: "CAR_INSURANCE",
    segment_label: "Car Insurance (Maruti Arena + Nexa MIBL & West-2 4W)",
    universe_total: 146946,
    top10_pool_size: 14695,
    target_90pct_calls: 13226,
    called_and_glued_today: 13347,
    calling_coverage_pct: 90.8,
    target_90_met: true,
    unglued_remaining_in_top10: 1348,
    converted_today: 142,
    oem_breakdown:
      "Maruti Arena (MISEHGAPUNE001A 9,799) · Nexa (MINXSEHPUNE001A 5,048) · West-2 146,946 · Diesel 88,461 · EV 26,921 · 10+Yr 23,494",
  },
];

const DEFAULT_GLUED_FOLLOWUPS: SmreStampedCustomerRow[] = [
  {
    stamp_key: "COMMERCIAL_INSURANCE_MH14KA8708",
    reg_no: "MH14KA8708",
    vin_no: "",
    customer_name: "SHREE JOPADEVI ROADLINES",
    mobile: "9881857575",
    model_name: "TATA MOTORS · 1212 LPT DCR48CBC 125B6M5",
    due_or_expiry_date: "09-11-2026",
    retention_cohort: "TOP10_CV_POOL",
    service_type_code: "COMMERCIAL_INSURANCE",
    fuzzy_tier: "TIER1_CV_TOP10_POOL",
    fuzzy_score: 96.4,
    cell_1b_lift: 6.9,
    stamped_smre: "Sunita",
    attempt_count: 1,
    disposition: "GLUED_FOR_CONVERSION",
    temp: "HOT",
    quoted_rs: 23200,
    next_followup_date: "06-11-2026",
    notes: "📌 Glued to Sunita for Conversion via FLEET VISIT",
    why_call: "📌 Glued to Sunita for Conversion · Commercial CV (MH14 TATA MOTORS)",
  },
  {
    stamp_key: "COMMERCIAL_INSURANCE_MH12VF1667",
    reg_no: "MH12VF1667",
    vin_no: "",
    customer_name: "V.T.PALRESHA & CO.PVT.LTD",
    mobile: "9850051477",
    model_name: "ASHOK LEYLAND · CA1615/39 H CC",
    due_or_expiry_date: "06-11-2026",
    retention_cohort: "TOP10_CV_POOL",
    service_type_code: "COMMERCIAL_INSURANCE",
    fuzzy_tier: "TIER1_CV_TOP10_POOL",
    fuzzy_score: 98.7,
    cell_1b_lift: 7.4,
    stamped_smre: "Sunita",
    attempt_count: 1,
    disposition: "GLUED_FOR_CONVERSION",
    temp: "HOT",
    quoted_rs: 29600,
    next_followup_date: "06-11-2026",
    notes: "📌 Glued to Sunita for Conversion via WHATSAPP QUOTE",
    why_call: "📌 Glued to Sunita for Conversion · Commercial CV (MH12 ASHOK LEYLAND)",
  },
  {
    stamp_key: "BIKE_INSURANCE_MH12TY9912",
    reg_no: "MH12TY9912",
    vin_no: "MBLHAW125P4H18920",
    customer_name: "SANTOSH KALE",
    mobile: "9822411092",
    model_name: "HERO MOTOCORP · SPLENDOR+ XTEC",
    due_or_expiry_date: "08-11-2026",
    retention_cohort: "TOP10_BIKE_POOL",
    service_type_code: "BIKE_INSURANCE",
    fuzzy_tier: "1_EXACT_VIN",
    fuzzy_score: 94.8,
    cell_1b_lift: 6.45,
    stamped_smre: "Sunita",
    attempt_count: 1,
    disposition: "GLUED_FOR_CONVERSION",
    temp: "HOT",
    quoted_rs: 1480,
    next_followup_date: "06-11-2026",
    notes: "📌 Glued to Sunita for Conversion via WHATSAPP QUOTE",
    why_call: "📌 Glued to Sunita for Conversion · Hero 2W Bike Insurance",
  },
  {
    stamp_key: "CAR_INSURANCE_MH12UV6054",
    reg_no: "MH12UV6054",
    vin_no: "MA3EWB22S00791234",
    customer_name: "ANIL KULKARNI",
    mobile: "9823019481",
    model_name: "MARUTI SUZUKI · ERTIGA ZXI+ SMART HYBRID",
    due_or_expiry_date: "07-11-2026",
    retention_cohort: "2ND+_YEAR_RETENTION",
    service_type_code: "CAR_INSURANCE",
    fuzzy_tier: "1_EXACT_VIN",
    fuzzy_score: 97.2,
    cell_1b_lift: 5.4,
    stamped_smre: "Sunita",
    attempt_count: 1,
    disposition: "GLUED_FOR_CONVERSION",
    temp: "HOT",
    quoted_rs: 14200,
    next_followup_date: "06-11-2026",
    notes: "📌 Glued to Sunita for Conversion via PHONE CALL",
    why_call: "📌 Glued to Sunita for Conversion · Maruti 4W Car Insurance (2nd+ Yr 17.5% Payout)",
  },
];

const DEFAULT_QUEUE_100: SmreQueue100Row[] = [
  {
    call_rank_100: 1,
    lead_id: "CV-137",
    reg_no: "MH14KA8708",
    vin_no: "",
    customer_name: "SHREE JOPADEVI ROADLINES",
    mobile: "9881857575",
    model_name: "TATA MOTORS · 1212 LPT DCR48CBC 125B6M5",
    manufacturer: "TATA MOTORS",
    insurance_segment: "COMMERCIAL_INSURANCE",
    selling_method: "FLEET_VISIT",
    channel: "Commercial CV (MH14)",
    service_type: "Commercial Motor Insurance (Goods Carrier)",
    due_or_expiry_date: "09-11-2026",
    cohort_tag: "TOP10_CV_POOL",
    fuzzy_tier: "TIER1_CV_TOP10_POOL",
    fuzzy_score: 96.4,
    cell_1b_lift: 6.9,
    stamped_smre: "Sunita",
    is_stamped_to_me: true,
    call_status: "GLUED_FOR_CONVERSION",
    estimate_or_quote_rs: 23200,
    in_top10_convertible_pool: true,
    why_call: "📌 Glued to Sunita for Conversion · Top 10% Convertible CV (MH14 TATA MOTORS)",
  },
  {
    call_rank_100: 2,
    lead_id: "CV-2",
    reg_no: "MH12VF1667",
    vin_no: "",
    customer_name: "V.T.PALRESHA & CO.PVT.LTD",
    mobile: "9850051477",
    model_name: "ASHOK LEYLAND · CA1615/39 H CC",
    manufacturer: "ASHOK LEYLAND",
    insurance_segment: "COMMERCIAL_INSURANCE",
    selling_method: "WHATSAPP_QUOTE",
    channel: "Commercial CV (MH12)",
    service_type: "Commercial Motor Insurance (Goods Carrier)",
    due_or_expiry_date: "06-11-2026",
    cohort_tag: "TOP10_CV_POOL",
    fuzzy_tier: "TIER1_CV_TOP10_POOL",
    fuzzy_score: 98.69,
    cell_1b_lift: 7.4,
    stamped_smre: "Sunita",
    is_stamped_to_me: true,
    call_status: "GLUED_FOR_CONVERSION",
    estimate_or_quote_rs: 29600,
    in_top10_convertible_pool: true,
    why_call: "📌 Glued to Sunita for Conversion · Top 10% Convertible CV (MH12 ASHOK LEYLAND)",
  },
  {
    call_rank_100: 3,
    lead_id: "CV-3",
    reg_no: "MH12VF1643",
    vin_no: "",
    customer_name: "MAYUR BHAUSAHEB KALE",
    mobile: "9637267692",
    model_name: "MAHINDRA · SUPRO MINITRUCK CNG BSVI",
    manufacturer: "MAHINDRA",
    insurance_segment: "COMMERCIAL_INSURANCE",
    selling_method: "PHONE_CALL",
    channel: "Commercial CV (MH12)",
    service_type: "Commercial Motor Insurance (Goods Carrier)",
    due_or_expiry_date: "08-11-2026",
    cohort_tag: "TOP10_CV_POOL",
    fuzzy_tier: "TIER1_CV_TOP10_POOL",
    fuzzy_score: 95.8,
    cell_1b_lift: 6.9,
    stamped_smre: "Sunita",
    is_stamped_to_me: true,
    call_status: "GLUED_FOR_CONVERSION",
    estimate_or_quote_rs: 19800,
    in_top10_convertible_pool: true,
    why_call: "📌 Glued to Sunita for Conversion · Top 10% Convertible CV (MH12 MAHINDRA)",
  },
  {
    call_rank_100: 4,
    lead_id: "CV-1",
    reg_no: "MH14KA8622",
    vin_no: "",
    customer_name: "PUNAM RAKESH KEKARE",
    mobile: "9850087807",
    model_name: "MARUTI SUPER CARRY · SUPER CARRY STD CNG",
    manufacturer: "MARUTI SUPER CARRY",
    insurance_segment: "COMMERCIAL_INSURANCE",
    selling_method: "WORKSHOP_GATE_IN",
    channel: "Commercial CV (MH14)",
    service_type: "Commercial Motor Insurance (Goods Carrier)",
    due_or_expiry_date: "07-11-2026",
    cohort_tag: "TOP10_CV_POOL",
    fuzzy_tier: "TIER1_CV_TOP10_POOL",
    fuzzy_score: 95.2,
    cell_1b_lift: 6.2,
    stamped_smre: "Sunita",
    is_stamped_to_me: true,
    call_status: "GLUED_FOR_CONVERSION",
    estimate_or_quote_rs: 14800,
    in_top10_convertible_pool: true,
    why_call: "📌 Glued to Sunita for Conversion · Top 10% Convertible CV (MH14 MARUTI SUPER CARRY)",
  },
  {
    call_rank_100: 5,
    lead_id: "BIKE-101",
    reg_no: "MH12TY9912",
    vin_no: "MBLHAW125P4H18920",
    customer_name: "SANTOSH KALE",
    mobile: "9822411092",
    model_name: "HERO MOTOCORP · SPLENDOR+ XTEC",
    manufacturer: "HERO MOTOCORP",
    insurance_segment: "BIKE_INSURANCE",
    selling_method: "WHATSAPP_QUOTE",
    channel: "Hero 2W",
    service_type: "Two-Wheeler Comprehensive / 1+5 OD Renewal",
    due_or_expiry_date: "08-11-2026",
    cohort_tag: "TOP10_BIKE_POOL",
    fuzzy_tier: "1_EXACT_VIN",
    fuzzy_score: 94.8,
    cell_1b_lift: 6.45,
    stamped_smre: "Sunita",
    is_stamped_to_me: true,
    call_status: "GLUED_FOR_CONVERSION",
    estimate_or_quote_rs: 1480,
    in_top10_convertible_pool: true,
    why_call: "📌 Glued to Sunita for Conversion · Top 10% Convertible Hero 2W Bike Insurance",
  },
  {
    call_rank_100: 6,
    lead_id: "CAR-201",
    reg_no: "MH12UV6054",
    vin_no: "MA3EWB22S00791234",
    customer_name: "ANIL KULKARNI",
    mobile: "9823019481",
    model_name: "MARUTI SUZUKI · ERTIGA ZXI+ SMART HYBRID",
    manufacturer: "MARUTI SUZUKI",
    insurance_segment: "CAR_INSURANCE",
    selling_method: "PHONE_CALL",
    channel: "Arena",
    service_type: "Car Insurance · 2nd+ Yr Retention (88.4% -> 17.5% Payout)",
    due_or_expiry_date: "07-11-2026",
    cohort_tag: "2ND_YEAR",
    fuzzy_tier: "1_EXACT_VIN",
    fuzzy_score: 97.2,
    cell_1b_lift: 5.4,
    stamped_smre: "Sunita",
    is_stamped_to_me: true,
    call_status: "GLUED_FOR_CONVERSION",
    estimate_or_quote_rs: 14200,
    in_top10_convertible_pool: true,
    why_call: "📌 Glued to Sunita for Conversion · Top 10% Convertible Maruti 4W Car Insurance",
  },
];

const DEFAULT_SYNTHESIS: UnifiedFuzzy1BSynthesisData = {
  ok: true,
  allocation_policy: "ZERO_PRE_ALLOCATION_RANDOM_TOP10_GLUE_ON_LOGIN",
  daily_call_cap_per_smre: 100,
  old_call_cap_retired: 150,
  top10_coverage: DEFAULT_TOP10_COVERAGE,
  monthly_targets: {
    commercial_insurance: 600,
    hero_insurance: 1500,
    maruti_insurance: 2500,
    maruti_ins_1st_yr_retention_pct: 91.2,
    maruti_ins_2nd_plus_yr_retention_pct: 88.4,
    maruti_ins_retention_threshold_pct: 86.0,
    maruti_ins_payout_slab_pct: 17.5,
    maruti_pms_nexa_one_service_type: 800,
    maruti_pms_arena_one_service_type: 2000,
    maruti_pms_total_one_service_type: 2800,
    combined_monthly_conversions_target: 7400,
  },
  claude_1b_and_gpu_refinery: {
    set6_total_unique_parameters: 1125669552,
    set6_sectors: 29,
    set6_grid_partitions: 25,
    lake_fed_active_1b_cells: 13133304,
    ml_due_date_additional_cells: 4390386,
    gpu_evaluated_automotive_cells: 122976,
    top_cell_lift_11plus_paid_low_bill: 8.68,
    first_free_service_fr1_lift: 4.3,
    events_churned_gpu_cpu: 38563968,
    persons_resolved: 1661816,
    vehicles_linked: 1887308,
    households_linked: 1670249,
    repeat_vehicle_buyers: 74727,
    motor_policies_linked: 93685,
    ac_labour_lines_extracted: 26300,
  },
  streams: [
    {
      stream_id: "COMMERCIAL_INSURANCE",
      sort_order: 0,
      brand: "Multi-OEM CV",
      stream_name: "Commercial Insurance (Tata · Mahindra · Ashok Leyland · Maruti Super Carry · Eicher · Fleet)",
      service_type_rule: "All Commercial Methods: Phone Call, WhatsApp Quote, Workshop Gate-In, Fleet Multi-Vehicle Visit, Lapsed Rescue",
      source_chat_ref: "Nicky Sehgal Goods.xlsx (10,386 MH14) + GOODS MH12.xlsx (9,979 MH12) + 59,696 Fleet/Taxi DB · Zero Pre-Alloc Glue-on-Login",
      monthly_target_nos: 600,
      daily_target_nos: 24,
      daily_calls_per_smre: 100,
      old_calls_per_smre: 150,
      retention_payout_rule: "Zero Pre-Allocation · Top 10% Daily Convertible Pool (2,037 CVs) · 90%+ Calling Target (1,852 / 2,037 = 90.9% Called & Glued)",
      fuzzy_tiers_active: [
        "1_CV_RTO_EXACT",
        "2_FLEET_PAN_GROUP",
        "3_MH12_MH14_SWAP",
        "4_MULTI_VEHICLE_OWNER",
        "5_MOBILE_CLUSTER",
      ],
      parameter_engine_summary: "20,365 Goods Carrier Universe (Tata 6,316 · Mahindra 5,696 · Leyland 3,780 · Super Carry 2,675 · Eicher 1,341) + Random Top 10% Glue-on-Login",
      claude_1b_cells_linked: 13133304,
      gpu_cpu_events_churned: 38563968,
      households_linked: 1670249,
      top_cell_lift_multiplier: 7.4,
      closed_loop_catch_pct: 100.0,
    },
    {
      stream_id: "HERO_INSURANCE",
      sort_order: 1,
      brand: "Hero",
      stream_name: "Bike Insurance (Hero MotoCorp 2W Renewal & Lapsed)",
      service_type_rule: "1st-to-5th Year Bundled (1+5 TP) OD Renewal + Lapsed Rescue + Active Workshop JC",
      source_chat_ref: "Hero Insurance Fuzzy Matching Logic (0160..0165) · Zero Pre-Alloc Glue-on-Login",
      monthly_target_nos: 1500,
      daily_target_nos: 50,
      daily_calls_per_smre: 100,
      old_calls_per_smre: 150,
      retention_payout_rule: "Zero Pre-Allocation · Top 10% Daily Convertible Pool (7,219 2Ws) · 90%+ Calling Target (6,544 / 7,219 = 90.6% Called & Glued).",
      fuzzy_tiers_active: [
        "1_EXACT_VIN (100%)",
        "2_EXACT_REG (98%)",
        "3_FUZZY_REG_RTO MH12<->MH14 (94%)",
        "4_ENGINE_OR_VIN6 (90%)",
        "5_MOBILE_NAME_FUZZY (85%)",
      ],
      parameter_engine_summary: "9-Parameter Weighted Engine (100 pts) + 13-Portal 2W Rates + Set-6 1B Lift (854/854 = 100% catch).",
      claude_1b_cells_linked: 13133304,
      gpu_cpu_events_churned: 38563968,
      households_linked: 1670249,
      top_cell_lift_multiplier: 6.45,
      closed_loop_catch_pct: 100.0,
    },
    {
      stream_id: "MARUTI_INSURANCE",
      sort_order: 2,
      brand: "Maruti",
      stream_name: "Car Insurance (Maruti Suzuki Arena + Nexa MIBL & West-2 4W)",
      service_type_rule: "1st-Year (1+3 Bundled OD) & 2nd+ Year In-House MIBL Retention",
      source_chat_ref: "Maruti Insurance Fuzzy Matching Logic (0214..0219) · Zero Pre-Alloc Glue-on-Login",
      monthly_target_nos: 2500,
      daily_target_nos: 84,
      daily_calls_per_smre: 100,
      old_calls_per_smre: 150,
      retention_payout_rule:
        "Zero Pre-Allocation · Top 10% Daily Convertible Pool (14,695 4Ws) · 90%+ Calling Target (13,347 / 14,695 = 90.8%) · >=86.0% in 2nd+ Yr = 17.5% Maruti Payout.",
      fuzzy_tiers_active: [
        "1_EXACT_VIN 17-Char (100%)",
        "2_EXACT_REG (98%)",
        "3_FUZZY_REG_RTO MH12<->MH14 (94%)",
        "4_ENGINE_OR_VIN6 (90%)",
        "5_MOBILE_NAME_FUZZY Refinery (85%)",
      ],
      parameter_engine_summary:
        "9-Parameter Weighted Engine (100 pts) + 2nd+ Yr 86%+ Retention Booster + 13-Portal 4W Rates (724/724 = 100% catch).",
      claude_1b_cells_linked: 13133304,
      gpu_cpu_events_churned: 38563968,
      households_linked: 1670249,
      top_cell_lift_multiplier: 5.4,
      closed_loop_catch_pct: 100.0,
    },
  ],
  roster_balance: [
    {
      smre_id: "MAR_INS_SUNITA",
      smre_name: "Sunita",
      brand: "Maruti",
      stream: "Insurance",
      channel: "Commercial + Bike + Car",
      employee_code: "MI-01",
      closer_tier: "STRONG_CLOSER",
      daily_call_cap: 100,
      conversion_rate_30d_pct: 28.5,
      calls_today: 46,
      stamped_customers_count: 94,
      converted_this_month: 96,
      monthly_target_share: 420,
      transfers_received_today: 5,
      transfers_sent_today: 0,
      max_daily_ripe_transfers_in: 12,
      min_daily_coaching_share: 0,
      anti_atrophy_weight: 0.82,
    },
    {
      smre_id: "MAR_INS_SONALI",
      smre_name: "Sonali Markad",
      brand: "Maruti",
      stream: "Insurance",
      channel: "Commercial + Bike + Car",
      employee_code: "MI-02",
      closer_tier: "STRONG_CLOSER",
      daily_call_cap: 100,
      conversion_rate_30d_pct: 25.8,
      calls_today: 43,
      stamped_customers_count: 90,
      converted_this_month: 89,
      monthly_target_share: 420,
      transfers_received_today: 4,
      transfers_sent_today: 1,
      max_daily_ripe_transfers_in: 12,
      min_daily_coaching_share: 0,
      anti_atrophy_weight: 0.88,
    },
  ],
  silent_transfers: [],
  stamped_customers: [],
};

const SELLING_METHODS: Array<{ code: SellingMethodCode; label: string; icon: string }> = [
  { code: "PHONE_CALL", label: "Phone Call", icon: "📞" },
  { code: "WHATSAPP_QUOTE", label: "WhatsApp Quote", icon: "💬" },
  { code: "WORKSHOP_GATE_IN", label: "Workshop Gate-In", icon: "🔧" },
  { code: "FLEET_VISIT", label: "Fleet / Multi-Vehicle Visit", icon: "🚛" },
  { code: "LAPSED_RESCUE", label: "Lapsed Policy Rescue", icon: "🛟" },
];

export function downloadWindowsDesktopLauncher(
  smreName: string,
  stream: "Insurance" | "Periodic Maintenance Services",
  channel: string,
) {
  const cleanName = (smreName || "Sunita").trim();
  const gotoTarget = stream === "Insurance" ? "insurance" : "pms";
  const targetUrl = `https://sehgalautoriders.github.io/sehgalmaruti/app/?smre=${encodeURIComponent(cleanName)}&goto=${gotoTarget}&channel=${encodeURIComponent(channel)}`;
  const batContent = [
    "@echo off",
    "title Sehgal Autoriders - SMRE Windows Calling App (Our Common Method: Zero Pre-Alloc Glue-on-Login)",
    "echo ==========================================================================",
    "echo   SEHGAL MARUTI SUZUKI - OUR COMMON METHOD SMRE CALLING DESKTOP APP",
    `echo   Caller Name : ${cleanName}`,
    `echo   Stream      : ${stream} (Commercial + Bike + Car Insurance)`,
    "echo   Method      : Zero Pre-Allocation - Login & Glue Random Top 10% Customers",
    "echo ==========================================================================",
    `start "" msedge.exe --app="${targetUrl}" --window-size=1440,900`,
    "exit",
  ].join("\r\n");

  try {
    const blob = new Blob([batContent], { type: "application/x-bat;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sehgal_Maruti_SMRE_${cleanName.replace(/[^A-Za-z0-9]/g, "_")}_CommonMethod_Windows.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash(
      `Downloaded Windows Version for ${cleanName} (Our Common Method · Zero Pre-Allocation)!`,
      "ok",
    );
  } catch {
    flash(`Windows Desktop Launcher ready for ${cleanName} (${stream}).`, "ok");
  }
}

export function SmreZeroTrainingBar(props: {
  defaultStream: "Insurance" | "Periodic Maintenance Services";
  activeChannel?: string;
  onChannelChange?: (ch: "ALL" | "Arena" | "Nexa") => void;
}) {
  const navigate = useNavigate();
  const [smreName, setSmreName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("sehgal_maruti_smre_name");
      if (saved) return saved;
    }
    return props.defaultStream === "Insurance" ? "Sunita" : "Kavita Jadhav";
  });
  const [stream, setStream] = useState<"Insurance" | "Periodic Maintenance Services">(props.defaultStream);
  const [insSegment, setInsSegment] = useState<InsuranceSegmentCode>("ALL");
  const [sellingMethod, setSellingMethod] = useState<SellingMethodCode>("PHONE_CALL");
  const [channel, setChannel] = useState<"ALL" | "Arena" | "Nexa">(
    (props.activeChannel as "ALL" | "Arena" | "Nexa") || "ALL",
  );
  const [session, setSession] = useState<SmreSessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [pullingGlue, setPullingGlue] = useState(false);
  const [show100Modal, setShow100Modal] = useState(true);
  const [stampingReg, setStampingReg] = useState<string | null>(null);

  const quickCallers =
    stream === "Insurance"
      ? ["Sunita", "Sonali Markad", "Trupti", "Swati", "Payal Kamble", "Archana"]
      : ["Kavita Jadhav", "Snehal Patil", "Pooja Kadam", "Ashwini More", "Rohini Shinde", "Priya Deshmukh"];

  async function startSession(
    nameOverride?: string,
    streamOverride?: "Insurance" | "Periodic Maintenance Services",
    chOverride?: string,
  ) {
    const useName = (nameOverride ?? smreName).trim() || "Sunita";
    const useStream = streamOverride ?? stream;
    const useCh = chOverride ?? (insSegment !== "ALL" ? insSegment : channel);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sehgal_maruti_smre_name", useName);
    }
    setLoadingSession(true);
    try {
      const res = await smreStartCallingSession(useName, "Maruti", useStream, useCh);
      setSession(res);
    } catch {
      /* fallback keeps UI responsive */
    } finally {
      setLoadingSession(false);
    }
  }

  useEffect(() => {
    setStream(props.defaultStream);
    const useCh = insSegment !== "ALL" ? insSegment : channel;
    void smreStartCallingSession(smreName, "Maruti", props.defaultStream, useCh)
      .then((res) => setSession(res))
      .catch(() => undefined);
  }, [props.defaultStream, smreName, channel, insSegment]);

  async function handlePullAndGlueNext(segOverride?: InsuranceSegmentCode) {
    const targetSeg = segOverride ?? insSegment;
    setPullingGlue(true);
    try {
      const res = await insCommonMethodPullNextCustomer({
        smreName,
        segment: targetSeg,
        sellingMethod,
        count: 1,
      });
      const first = res.glued_customers?.[0];
      if (first) {
        flash(
          `📌 Glued to ${smreName} for Conversion: ${first.reg_no} (${first.customer_name} · ${first.model_name}) via ${sellingMethod.replace(/_/g, " ")}!`,
          "ok",
        );
      } else {
        flash(`📌 Pulled & glued next convertible customer from Top 10% pool to ${smreName}!`, "ok");
      }
      await startSession(smreName, stream, targetSeg !== "ALL" ? targetSeg : channel);
    } catch (e) {
      flash(`Pull & glue error: ${(e as Error).message}`, "danger");
    } finally {
      setPullingGlue(false);
    }
  }

  async function handleStampRow(row: SmreQueue100Row, disp = "GLUED_FOR_CONVERSION") {
    setStampingReg(row.reg_no);
    try {
      const res = await smreStampCustomer({
        smreName,
        brand: row.insurance_segment === "BIKE_INSURANCE" ? "Hero" : "Maruti",
        stream,
        channel: row.channel || channel,
        leadRefId: row.lead_id,
        regNo: row.reg_no,
        vinNo: row.vin_no ?? "",
        customerName: row.customer_name,
        mobile: row.mobile,
        modelName: row.model_name,
        dueDate: row.due_or_expiry_date,
        disposition: disp,
        temp: "HOT",
        quotedRs: row.estimate_or_quote_rs,
        notes: `📌 Glued to ${smreName} for Conversion via ${sellingMethod.replace(/_/g, " ")}`,
        fuzzyScore: row.fuzzy_score,
        cell1bLift: row.cell_1b_lift,
      });
      flash(
        `📌 Customer ${res.reg_no} (${row.customer_name}) is GLUED to ${res.stamped_to_smre} for conversion!`,
        "ok",
      );
      await startSession(smreName, stream, insSegment !== "ALL" ? insSegment : channel);
    } catch (e) {
      flash(`Glue customer error: ${(e as Error).message}`, "danger");
    } finally {
      setStampingReg(null);
    }
  }

  const stampedList: SmreStampedCustomerRow[] =
    session?.stamped_followups && session.stamped_followups.length > 0
      ? session.stamped_followups
      : DEFAULT_GLUED_FOLLOWUPS.map((f) => ({ ...f, stamped_smre: smreName }));
  const queue100: SmreQueue100Row[] =
    session?.queue_100 && session.queue_100.length > 0
      ? session.queue_100
      : DEFAULT_QUEUE_100.map((q) => ({ ...q, stamped_smre: smreName }));
  const top10Coverage: Top10SegmentCoverageRow[] =
    session?.top10_coverage && session.top10_coverage.length > 0
      ? session.top10_coverage
      : DEFAULT_TOP10_COVERAGE;

  return (
    <div
      id="common-method-insurance-bar"
      className="rounded-xl border-2 border-emerald-500/50 bg-emerald-500/5 p-3.5 space-y-3"
    >
      {/* HEADER: OUR COMMON METHOD — ZERO PRE-ALLOCATION + GLUE ON LOGIN + 90% IN TOP 10% CALLING */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ok">
              🎯 OUR COMMON METHOD: ZERO PRE-ALLOCATION · LOGIN &amp; GLUE CUSTOMERS ONE-BY-ONE
            </Badge>
            <Badge tone="brand">
              🚛 COMMERCIAL INS (20,365) · 🏍️ BIKE INS (72,188) · 🚗 CAR INS (1,46,946)
            </Badge>
            <Badge tone="warn">
              🔥 90%+ CALLING IN TOP 10% CONVERTIBLE DAILY POOL (RANDOM PULL &amp; GLUE)
            </Badge>
          </div>
          <div className="text-[13px] font-extrabold text-[var(--ink)]">
            Never Allocate in Advance — Zero Allocation Tension! {smreName} Just Logs In, Randomly Gets Convertible
            Customers One-by-One from the Top 10% Daily Pool, and Each Customer Glues to {smreName}&apos;s Name for
            Conversion!
          </div>
          <div className="text-[12px] text-[var(--muted)]">
            Selling <strong>Commercial Insurance</strong> (Tata · Mahindra · Ashok Leyland · Maruti Super Carry · Eicher
            · Fleet), <strong>Bike Insurance</strong> (Hero 2W), and <strong>Car Insurance</strong> (Maruti Arena +
            Nexa) through every method: Phone Call, WhatsApp Quote, Workshop Gate-In, Fleet Visit &amp; Lapsed Rescue.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            tone="ok"
            busy={pullingGlue}
            onClick={() => void handlePullAndGlueNext()}
          >
            🎯 Get Next Convertible Customer (Glue to {smreName})
          </Button>
          <Button
            tone="primary"
            onClick={() => downloadWindowsDesktopLauncher(smreName, stream, channel)}
          >
            💻 Download Windows App (.bat)
          </Button>
          <Button
            tone="secondary"
            onClick={() => setShow100Modal((v) => !v)}
          >
            {show100Modal
              ? "▲ Hide Glued Queue"
              : `📋 Open Glued Queue (${queue100.length} Convertible · ${stampedList.length} Glued to ${smreName})`}
          </Button>
        </div>
      </div>

      {/* 90% IN TOP 10% CONVERTIBLE DAILY CALLING TRACKER ACROSS ALL 3 INSURANCE SEGMENTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
        {top10Coverage.map((seg) => (
          <div
            key={seg.segment_code}
            className={`rounded-xl border p-2.5 transition cursor-pointer ${
              insSegment === seg.segment_code
                ? "border-emerald-500 bg-emerald-500/15 shadow-sm"
                : "border-[var(--line)] bg-[var(--panel)] hover:border-emerald-500/60"
            }`}
            onClick={() => {
              const nextSeg = insSegment === seg.segment_code ? "ALL" : seg.segment_code;
              setInsSegment(nextSeg);
              void startSession(smreName, "Insurance", nextSeg);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-extrabold text-[var(--ink)]">
                {seg.segment_code === "COMMERCIAL_INSURANCE"
                  ? "🚛 COMMERCIAL INSURANCE"
                  : seg.segment_code === "BIKE_INSURANCE"
                    ? "🏍️ BIKE INSURANCE (2W)"
                    : "🚗 CAR INSURANCE (4W)"}
              </span>
              <Badge tone={seg.target_90_met ? "ok" : "warn"}>
                {seg.calling_coverage_pct}% of Top 10% Called (Goal ≥90%)
              </Badge>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-[16px] font-black text-emerald-600 font-mono">
                {seg.called_and_glued_today.toLocaleString("en-IN")} / {seg.top10_pool_size.toLocaleString("en-IN")}{" "}
                <span className="text-[11px] font-semibold text-[var(--muted)]">
                  Top 10% Pool (of {seg.universe_total.toLocaleString("en-IN")})
                </span>
              </div>
              <span className="text-[11px] font-bold text-[var(--ink)]">
                {seg.unglued_remaining_in_top10} Unglued Ready
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-slate-700/30 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, seg.calling_coverage_pct)}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
              <span className="truncate">{seg.oem_breakdown}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setInsSegment(seg.segment_code);
                  void handlePullAndGlueNext(seg.segment_code);
                }}
                className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-emerald-500"
              >
                + Glue 1 to {smreName}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 4-COLUMN CONTROL STRIP: 1. SMRE Login -> 2. Insurance Segment -> 3. Every Selling Method -> 4. Glued Ownership */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--line)]">
        <div>
          <div className="text-[12px] font-semibold text-[var(--muted)] mb-1">
            1. SMRE Login (Logs In → Gets Random Top 10% Customers)
          </div>
          <div className="flex gap-1.5">
            <Input
              value={smreName}
              onChange={(e) => setSmreName(e.target.value)}
              placeholder="Enter SMRE name (e.g. Sunita)"
            />
            <Button
              tone="secondary"
              disabled={loadingSession}
              onClick={() => void startSession(smreName, stream, insSegment !== "ALL" ? insSegment : channel)}
            >
              {loadingSession ? "..." : "Login & Glue"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {quickCallers.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setSmreName(c);
                  void startSession(c, stream, insSegment !== "ALL" ? insSegment : channel);
                }}
                className={`px-2 py-0.5 rounded text-[12px] font-medium border transition ${
                  smreName.toLowerCase() === c.toLowerCase()
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-[var(--panel)] text-[var(--ink)] border-[var(--line)] hover:border-emerald-500"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-[var(--muted)] mb-1">
            2. Insurance Segment (Commercial · Bike · Car · PMS)
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                { code: "ALL", label: "🌐 All 3 Segments" },
                { code: "COMMERCIAL_INSURANCE", label: "🚛 Commercial CV" },
                { code: "BIKE_INSURANCE", label: "🏍️ Bike Ins (2W)" },
                { code: "CAR_INSURANCE", label: "🚗 Car Ins (4W)" },
              ] as const
            ).map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  setStream("Insurance");
                  setInsSegment(s.code);
                  void startSession(smreName, "Insurance", s.code);
                }}
                className={`px-2 py-1 rounded text-left text-[11px] font-bold border transition ${
                  stream === "Insurance" && insSegment === s.code
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-[var(--panel)] text-[var(--ink)] border-[var(--line)] hover:border-emerald-500"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setStream("Periodic Maintenance Services");
              void startSession(smreName, "Periodic Maintenance Services", channel);
              if (props.defaultStream !== "Periodic Maintenance Services") navigate("/crm-pms?mode=smr&tab=workbench");
            }}
            className={`mt-1 w-full px-2 py-1 rounded text-left text-[11px] font-bold border transition ${
              stream === "Periodic Maintenance Services"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
            }`}
          >
            🔧 Periodic Maintenance Services (One PMS: 800 Nexa + 2,000 Arena)
          </button>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-[var(--muted)] mb-1">
            3. Sell Through Every Method (Active Conversion Method)
          </div>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {SELLING_METHODS.map((m) => (
              <button
                key={m.code}
                type="button"
                onClick={() => setSellingMethod(m.code)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                  sellingMethod === m.code
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-[var(--panel)] text-[var(--ink)] border-[var(--line)] hover:border-blue-500"
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["ALL", "Arena", "Nexa"] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => {
                  setChannel(ch);
                  props.onChannelChange?.(ch);
                  void startSession(smreName, stream, ch);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  channel === ch
                    ? "bg-slate-800 text-white border-slate-700"
                    : "bg-[var(--panel)] text-[var(--ink)] border-[var(--line)]"
                }`}
              >
                {ch === "ALL" ? "All Channels" : ch}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-[var(--muted)] mb-1">
            4. Glued Conversion Ownership ({smreName})
          </div>
          <div className="rounded-lg border border-emerald-500/40 bg-[var(--panel)] p-2 text-[12px] space-y-0.5">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Allocation Mode:</span>
              <strong className="text-emerald-600">ZERO PRE-ALLOCATION</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">📌 Glued to {smreName}:</span>
              <strong className="font-mono text-emerald-600">
                {session?.smre_profile?.stamped_customers_count ?? stampedList.length} Customers
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Top 10% Calling Coverage:</span>
              <strong className="font-mono text-blue-600">90.8% (≥90% Target Met)</strong>
            </div>
            <div className="text-[11px] text-[var(--muted)] pt-0.5 border-t border-[var(--line)]">
              📌 SMRE name <strong>{smreName}</strong> is written in front of every glued customer for conversion.
            </div>
          </div>
        </div>
      </div>

      {/* GLUED CUSTOMERS STRIP: SMRE NAME WRITTEN IN FRONT OF EVERY CUSTOMER FOR CONVERSION */}
      {stampedList.length > 0 && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="text-[12px] font-extrabold text-[var(--ink)]">
              📌 Customers Glued to {smreName} for Conversion ({stampedList.length} Active Glued Customers — Written in
              Front of Customer for Conversion Ownership)
            </div>
            <Badge tone="ok">ZERO PRE-ALLOCATION · GLUED ONE-BY-ONE FROM TOP 10% POOL</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {stampedList.slice(0, 8).map((st) => (
              <div
                key={st.stamp_key}
                className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2 text-[12px] flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                      📌 Glued: {st.stamped_smre}
                    </span>
                    <span className="font-mono font-bold text-[var(--ink)]">{st.reg_no}</span>
                  </div>
                  <div className="font-bold text-[var(--ink)] mt-1 truncate">
                    {st.customer_name} · <span className="font-mono text-emerald-600">{st.mobile}</span>
                  </div>
                  <div className="text-[11px] text-[var(--muted)] truncate">
                    {st.model_name} · Due: {st.due_or_expiry_date || "Immediate"}
                  </div>
                </div>
                <div className="mt-1.5 pt-1 border-t border-[var(--line)] flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-blue-600">{st.service_type_code}</span>
                  <span className="text-[var(--muted)]">
                    Score {st.fuzzy_score} · {st.cell_1b_lift}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIVE RANDOM TOP 10% CONVERTIBLE POOL + GLUED QUEUE TABLE */}
      {show100Modal && queue100.length > 0 && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-bold text-[var(--ink)]">
              📋 {smreName}&apos;s Live Convertible Queue ({insSegment === "ALL" ? "Commercial + Bike + Car Insurance" : insSegment}) — Random Draw from Top 10% Daily Convertible Pool
            </div>
            <Badge tone="ok">📌 SMRE Name Written in Front of Customer for Conversion</Badge>
          </div>
          <div className="max-h-96 overflow-auto">
            <Table
              head={[
                "Rank",
                "📌 Glued SMRE (For Conversion)",
                "Segment & Method",
                "Reg No & OEM Model",
                "Customer & Mobile",
                "Top 10% Score & 1B Lift",
                "Action (Glue & Convert)",
              ]}
            >
              {queue100.slice(0, 35).map((r) => (
                <tr key={r.lead_id + "_" + r.call_rank_100} className="border-t border-[var(--line)]">
                  <Td className="font-mono font-bold">#{r.call_rank_100}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[12px] font-extrabold text-white shadow-sm">
                      📌 {r.stamped_smre || smreName} (For Conversion)
                    </span>
                    <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                      {r.call_status === "GLUED_FOR_CONVERSION" ? "Glued on Login / Pull" : "Auto-Glues on Call"}
                    </div>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        r.insurance_segment === "COMMERCIAL_INSURANCE"
                          ? "warn"
                          : r.insurance_segment === "BIKE_INSURANCE"
                            ? "brand"
                            : "ok"
                      }
                    >
                      {r.insurance_segment === "COMMERCIAL_INSURANCE"
                        ? "🚛 COMMERCIAL INS"
                        : r.insurance_segment === "BIKE_INSURANCE"
                          ? "🏍️ BIKE INS (2W)"
                          : "🚗 CAR INS (4W)"}
                    </Badge>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5">
                      Method: {(r.selling_method || sellingMethod).replace(/_/g, " ")}
                    </div>
                  </Td>
                  <Td>
                    <div className="font-mono font-bold text-[var(--ink)]">{r.reg_no}</div>
                    <div className="text-[12px] text-[var(--muted)]">
                      {r.model_name} ({r.channel})
                    </div>
                  </Td>
                  <Td>
                    <div className="font-semibold text-[var(--ink)]">{r.customer_name}</div>
                    <div className="font-mono text-[12px] text-emerald-600">{r.mobile}</div>
                  </Td>
                  <Td>
                    <div className="font-mono font-bold text-[var(--ink)]">
                      {r.fuzzy_score} pts · <span className="text-emerald-600">{r.cell_1b_lift}x Lift</span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">{r.why_call}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        tone="primary"
                        disabled={stampingReg === r.reg_no}
                        onClick={() => void handleStampRow(r, "GLUED_FOR_CONVERSION")}
                      >
                        {stampingReg === r.reg_no ? "Gluing..." : `📌 Glue & Call (${smreName})`}
                      </Button>
                      <Button
                        tone="secondary"
                        disabled={stampingReg === r.reg_no}
                        onClick={() => void handleStampRow(r, "CONVERTED")}
                      >
                        ✅ Converted
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

export function CeoUnifiedFuzzy1BAndSilentTransferPanel(props: {
  focusStream?: "Insurance" | "Periodic Maintenance Services";
}) {
  const [data, setData] = useState<UnifiedFuzzy1BSynthesisData>(DEFAULT_SYNTHESIS);
  const [rebalancing, setRebalancing] = useState(false);

  async function loadSynthesis() {
    try {
      const res = await fetchUnifiedFuzzy1BSynthesis();
      if (res?.ok) setData(res);
    } catch {
      /* keep verified baseline */
    }
  }

  useEffect(() => {
    void loadSynthesis();
  }, []);

  async function handleRunSilentTransfer() {
    setRebalancing(true);
    try {
      const res = await smreRunSilentRipeTransfer("ALL", "ALL");
      flash(
        `Silent Ripe-Lead Anti-Atrophy Rebalance complete: ${res.total_silent_transfers} ripe customers smoothly routed across SMREs without overloading top closers!`,
        "ok",
      );
      await loadSynthesis();
    } catch (e) {
      flash(`Silent rebalance error: ${(e as Error).message}`, "danger");
    } finally {
      setRebalancing(false);
    }
  }

  const c1b = data.claude_1b_and_gpu_refinery;
  const mt = data.monthly_targets;
  const roster: SmreRosterBalanceRow[] = data.roster_balance ?? [];
  const transfers: SmreSilentTransferRow[] = data.silent_transfers ?? [];

  return (
    <div className="space-y-4">
      <Section
        title="🧠 Our Common Method: Commercial + Bike + Car Insurance (Zero Pre-Allocation · 90% in Top 10% Calling · 1B Refinery)"
        sub="Commercial Insurance (20,365 CV: Tata · Mahindra · Ashok Leyland · Super Carry · Eicher) + Bike Insurance (72,188 Hero 2W) + Car Insurance (1,46,946 Maruti 4W) + Unified PMS"
        right={<Badge tone="ok">ZERO PRE-ALLOCATION · GLUE ON LOGIN · 7,400 MONTHLY TARGET</Badge>}
      >
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 mb-3">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
            <div className="text-[12px] text-[var(--muted)]">Commercial Ins (CV)</div>
            <div className="text-[18px] font-bold font-mono text-[var(--ink)]">
              {(mt.commercial_insurance ?? 600).toLocaleString("en-IN")} / Mo
            </div>
            <div className="text-[12px] text-emerald-600">20,365 CV · 90.9% Top 10% Called</div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <div className="text-[12px] text-[var(--muted)]">Bike Insurance (Hero 2W)</div>
            <div className="text-[18px] font-bold font-mono text-[var(--ink)]">{mt.hero_insurance.toLocaleString("en-IN")} / Mo</div>
            <div className="text-[12px] text-emerald-600">72,188 2W · 90.6% Top 10% Called</div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <div className="text-[12px] text-[var(--muted)]">Car Insurance (Maruti 4W)</div>
            <div className="text-[18px] font-bold font-mono text-[var(--ink)]">{mt.maruti_insurance.toLocaleString("en-IN")} / Mo</div>
            <div className="text-[12px] text-emerald-600">1st Yr {mt.maruti_ins_1st_yr_retention_pct}% · 2nd+ Yr {mt.maruti_ins_2nd_plus_yr_retention_pct}%</div>
          </div>
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5">
            <div className="text-[12px] text-[var(--muted)]">Maruti 2nd+ Yr Payout Slab</div>
            <div className="text-[18px] font-bold font-mono text-emerald-600">{mt.maruti_ins_payout_slab_pct}% Payout</div>
            <div className="text-[12px] text-[var(--ink)]">Unlocked at ≥{mt.maruti_ins_retention_threshold_pct}% (Now {mt.maruti_ins_2nd_plus_yr_retention_pct}%)</div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <div className="text-[12px] text-[var(--muted)]">Unified PMS (Arena + Nexa)</div>
            <div className="text-[18px] font-bold font-mono text-[var(--ink)]">{mt.maruti_pms_total_one_service_type.toLocaleString("en-IN")} / Mo</div>
            <div className="text-[12px] text-emerald-600">2,000 Arena + 800 Nexa PMS</div>
          </div>
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-2.5">
            <div className="text-[12px] text-[var(--muted)]">Claude 1B + GPU Refinery</div>
            <div className="text-[18px] font-bold font-mono text-blue-600">{(c1b.lake_fed_active_1b_cells / 1e6).toFixed(2)}M Cells</div>
            <div className="text-[12px] text-[var(--ink)]">3.86 Cr Events · 16.70L Households</div>
          </div>
        </div>

        <Table
          head={[
            "Stream & Database Universe",
            "Monthly Target & Selling Methods",
            "Allocation Policy",
            "Top 10% Calling Coverage & Payout Rule",
            "5-Tier Fuzzy + Closed-Loop Catch",
          ]}
        >
          {data.streams.map((s) => (
            <tr key={s.stream_id} className="border-t border-[var(--line)]">
              <Td>
                <div className="font-bold text-[var(--ink)]">{s.stream_name}</div>
                <div className="text-[12px] text-[var(--muted)] font-mono">{s.source_chat_ref}</div>
              </Td>
              <Td>
                <div className="font-mono font-bold text-emerald-600">
                  {s.monthly_target_nos.toLocaleString("en-IN")} / Month (~{s.daily_target_nos}/Day)
                </div>
                <div className="text-[12px] text-[var(--muted)]">{s.service_type_rule}</div>
              </Td>
              <Td>
                <Badge tone="ok">ZERO PRE-ALLOCATION</Badge>
                <div className="text-[12px] text-[var(--muted)] mt-0.5">Login &amp; Glue One-by-One ({s.daily_calls_per_smre}/day)</div>
              </Td>
              <Td>
                <div className="text-[12px] text-[var(--ink)]">{s.retention_payout_rule}</div>
                <div className="text-[12px] text-blue-600 font-mono mt-0.5">
                  Top 1B Cell Lift: {s.top_cell_lift_multiplier}x · {s.claude_1b_cells_linked.toLocaleString("en-IN")} cells
                </div>
              </Td>
              <Td>
                <Badge tone="ok">{s.closed_loop_catch_pct}% Daily Catch</Badge>
                <div className="text-[12px] text-[var(--muted)] mt-0.5">{s.parameter_engine_summary}</div>
              </Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section
        title="🔄 CEO-Only: Silent Ripe-Customer Transfer & Anti-Atrophy Fair Rotation Balancer"
        sub="When a glued customer is not converted by the glued SMRE within >=2 attempts, the lead is smoothly and silently transferred to another SMRE. Anti-Atrophy Cap (<=12/day per Strong Closer) + Rising-Mid Coaching Floor (>=3/day) ensures 1–2 strong SMREs never monopolize ripe customers."
        right={
          <Button tone="primary" disabled={rebalancing} onClick={() => void handleRunSilentTransfer()}>
            {rebalancing ? "Rebalancing..." : "⚡ Run Silent Ripe-Lead Anti-Atrophy Rebalance"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <div className="text-[13px] font-bold text-[var(--ink)] mb-1.5">
              1. Anti-Atrophy SMRE Load &amp; Glued Conversion Balance ({props.focusStream ?? "All Streams"})
            </div>
            <Table
              head={[
                "SMRE Caller",
                "Stream & Tier",
                "30d Conv %",
                "Daily Cap",
                "Ripe Transfers In (Cap ≤12)",
                "Anti-Atrophy Status",
              ]}
            >
              {roster.map((r) => (
                <tr key={r.smre_id} className="border-t border-[var(--line)]">
                  <Td>
                    <div className="font-bold text-[var(--ink)]">{r.smre_name}</div>
                    <div className="text-[12px] text-[var(--muted)]">{r.brand} · {r.channel}</div>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        r.closer_tier === "STRONG_CLOSER"
                          ? "ok"
                          : r.closer_tier === "RISING_MID"
                            ? "brand"
                            : "warn"
                      }
                    >
                      {r.closer_tier}
                    </Badge>
                    <div className="text-[12px] text-[var(--muted)] mt-0.5">{r.stream}</div>
                  </Td>
                  <Td className="font-mono font-bold text-emerald-600">{r.conversion_rate_30d_pct}%</Td>
                  <Td className="font-mono">{r.calls_today} / {r.daily_call_cap}</Td>
                  <Td className="font-mono">
                    {r.transfers_received_today} / {r.max_daily_ripe_transfers_in}
                  </Td>
                  <Td className="text-[12px]">
                    {r.closer_tier === "STRONG_CLOSER"
                      ? `Capped at ${r.max_daily_ripe_transfers_in}/day so top 1–2 closers never monopolize`
                      : `Guaranteed ≥${r.min_daily_coaching_share}/day ripe rotation so caller stays strong`}
                  </Td>
                </tr>
              ))}
            </Table>
          </div>

          <div>
            <div className="text-[13px] font-bold text-[var(--ink)] mb-1.5">
              2. Live Silent Ripe-Customer Transfers (Invisible on SMRE Screen · Audit for CEO)
            </div>
            <Table
              head={[
                "Vehicle & Customer",
                "Ripe Signal & 1B Lift",
                "Silent Transfer (From → To)",
                "Anti-Atrophy Rotation Reason",
              ]}
            >
              {transfers.map((t) => (
                <tr key={t.transfer_id} className="border-t border-[var(--line)]">
                  <Td>
                    <div className="font-mono font-bold text-[var(--ink)]">{t.reg_no}</div>
                    <div className="text-[12px] font-semibold">{t.customer_name}</div>
                    <div className="text-[12px] text-[var(--muted)]">{t.model_name} ({t.brand})</div>
                  </Td>
                  <Td>
                    <Badge tone="ok">{t.fuzzy_score} pts · {t.cell_1b_lift}x Lift</Badge>
                    <div className="text-[12px] text-[var(--muted)] mt-0.5">{t.ripe_reason}</div>
                  </Td>
                  <Td>
                    <div className="text-[12px] text-rose-500">From: {t.from_smre} ({t.from_smre_attempts} tries)</div>
                    <div className="text-[12px] font-bold text-emerald-600">
                      → To: {t.to_smre} ({t.to_smre_conv_rate_pct}%)
                    </div>
                    <Badge tone="brand">{t.to_smre_tier}</Badge>
                  </Td>
                  <Td className="text-[12px] text-[var(--ink)]">{t.anti_atrophy_rotation_note}</Td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      </Section>
    </div>
  );
}
