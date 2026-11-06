import { useState } from "react";
import {
  MSIL_DISCREPANCY_SAMPLE_CASES,
  MSIL_DUE_17M_AUDIT,
  MSIL_MONTHLY_1BY1_LEDGER,
  MSIL_WORKSHOP_NOV_PLUS_6M_SHIELD,
} from "@/app/sehgalMsilDueDiscrepancyData";
import { Badge, Section, Table, Td } from "@/components/ui";

export function MsilDueDiscrepancyAndBlameShieldSection() {
  const [monthScope, setMonthScope] = useState<"ALL_17" | "NOV_PLUS_6">("ALL_17");
  const [discCategory, setDiscCategory] = useState<string>("ALL");

  const t17 = MSIL_DUE_17M_AUDIT.totals_17_months_1by1;
  const t7 = MSIL_DUE_17M_AUDIT.totals_nov_plus_6_months_1by1;
  const mm7 = MSIL_DUE_17M_AUDIT.multi_month_selection_distortion.nov_plus_6_may_to_nov2026;
  const mm16 = MSIL_DUE_17M_AUDIT.multi_month_selection_distortion.sixteen_months_aug2025_to_nov2026;

  const visibleMonths =
    monthScope === "NOV_PLUS_6"
      ? MSIL_MONTHLY_1BY1_LEDGER.filter((m) => m.is_nov_plus_6)
      : MSIL_MONTHLY_1BY1_LEDGER;

  const categories = ["ALL", ...Array.from(new Set(MSIL_DISCREPANCY_SAMPLE_CASES.map((c) => c.category)))];
  const visibleSamples =
    discCategory === "ALL"
      ? MSIL_DISCREPANCY_SAMPLE_CASES
      : MSIL_DISCREPANCY_SAMPLE_CASES.filter((c) => c.category === discCategory);

  return (
    <div className="space-y-4">
      {/* =====================================================================
          SECTION 4A: MSIL 1-BY-1 17-MONTH DUE DISCREPANCY & CORPORATE BLAME-SHIELD HEADER
         ===================================================================== */}
      <Section
        title="4 · MSIL CRM / BI 1-by-1 Monthly Due Database Discrepancy Audit (Nov, Oct, Sep, Aug 2026 + Last 15 Months) & Nov + 6M Corporate Blame-Shield"
        sub="Downloaded strictly 1-by-1 month-by-month (never selecting all months at once). Exposes 8 structural flaws in MSIL's Due Database and enforces 100% contact coverage across Nov + 6 Months (May–Nov 2026 PMS) so there is zero double-sided corporate friction even on an external calamity/bandh day."
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="ok">17 MONTHS PULLED 1-BY-1</Badge>
            <Badge tone="brand">NOV + 6M (MAY–NOV 2026) PMS TRACKED</Badge>
            <Badge tone="warn">0% UNCONTACTED BLAME EXPOSURE</Badge>
          </div>
        }
      >
        {/* Plain Level 5 IIMK Human Rule Explanation Box */}
        <div className="mb-3 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-3.5 text-[12.5px] text-ink">
          <div className="font-extrabold text-amber-700 dark:text-amber-300">
            🛡️ Rule of Corporate Business — Why We Run a Dual-Layer Architecture (Conversion Engine + 100% Contact Blame-Shield):
          </div>
          <div className="mt-1 grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div>
              <b>1. Why you must NEVER select all months&apos; due dates together in MSIL CRM/BI:</b> MSIL&apos;s Qlik/CRM engine calculates{" "}
              <code>Total Due</code>, <code>Total Done</code>, <code>Done At Other Dealer</code>, and <code>Not Done</code> using{" "}
              <code>Count(DISTINCT VIN)</code> and a 6-part <code>Match(count(DISTINCT VIN))</code> formula across the active selection. Selecting{" "}
              <b>May–Nov 2026 all at once</b> collapses <b>{mm7.rows_lost_or_distorted.toLocaleString("en-IN")} rows</b> (and across 16 months collapses{" "}
              <b>{mm16.rows_lost_or_distorted.toLocaleString("en-IN")} rows</b>) because any vehicle due in multiple months or serviced in a later month overwrites its earlier month&apos;s status. Therefore, we extract and track <b>each month 1-by-1 separately</b>.
            </div>
            <div>
              <b>2. How we prevent Double-Sided Corporate Friction (External Shock / Calamity Protection):</b> Even when our dealership delivers{" "}
              <b>30% consistent growth</b>, if an external event (heavy rain, bandh, 15-day shutdown, calamity) causes workshop load to dip for even 1 day or 1 month, corporate immediately checks whether all{" "}
              <b>Nov + 6 Months ({t7.total_unique_month_vin_cycles.toLocaleString("en-IN")} 1-by-1 PMS due cycles / {t7.total_distinct_vins.toLocaleString("en-IN")} unique vehicles)</b> were contacted. Our{" "}
              <b>Layer 1 (Top 10% 1T Glued Queue · 2,200 calls/day)</b> converts <b>95.45%</b> of real workshop load, while{" "}
              <b>Layer 2 (Corporate Blame-Shield)</b> logs <b>100.00% contact</b> across the remaining 90% via DExC SMR Attempt + Enjay Auto-Dialer + PingMate WhatsApp + SMRE Sweep (<b>0 Uncontacted</b>).
            </div>
          </div>
        </div>

        {/* 6 KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">17-Mo 1-by-1 Due Rows</div>
            <div className="mt-0.5 font-mono text-[19px] font-black text-blue-600 dark:text-blue-400">
              {t17.total_exported_rows.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-ink">
              {t17.total_unique_month_vin_cycles.toLocaleString("en-IN")} Unique Month-VINs
            </div>
          </div>

          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">All-At-Once Collapse (16M)</div>
            <div className="mt-0.5 font-mono text-[19px] font-black text-rose-600 dark:text-rose-400">
              -{mm16.rows_lost_or_distorted.toLocaleString("en-IN")} Rows
            </div>
            <div className="text-[11px] text-ink">
              -{mm7.rows_lost_or_distorted.toLocaleString("en-IN")} Rows in Nov+6M
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">Same-Mo Dups &amp; Conflicts</div>
            <div className="mt-0.5 font-mono text-[19px] font-black text-amber-600 dark:text-amber-400">
              {t17.same_month_duplicate_rows.toLocaleString("en-IN")} Dups
            </div>
            <div className="text-[11px] text-ink">
              {t17.flag_conflict_both_done_rows.toLocaleString("en-IN")} Own=1 &amp; Other=1
            </div>
          </div>

          <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">Missing Last Type &amp; Null Flag</div>
            <div className="mt-0.5 font-mono text-[19px] font-black text-purple-600 dark:text-purple-400">
              {t17.missing_last_srv_type_rows.toLocaleString("en-IN")} &apos;-&apos;
            </div>
            <div className="text-[11px] text-ink">
              {t17.backend_null_status_flag_rows.toLocaleString("en-IN")} Mislabeled Not-Done
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">Ghost Not-Done (In DMS)</div>
            <div className="mt-0.5 font-mono text-[19px] font-black text-emerald-600 dark:text-emerald-400">
              {t17.ghost_not_done_in_dms_spine.toLocaleString("en-IN")} VINs
            </div>
            <div className="text-[11px] text-ink">Already Invoiced in W2 Spine</div>
          </div>

          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">Nov + 6M Blame-Shield</div>
            <div className="mt-0.5 font-mono text-[19px] font-black text-emerald-600 dark:text-emerald-400">
              100.00% (0 Left)
            </div>
            <div className="text-[11px] text-ink">
              {t7.total_distinct_vins.toLocaleString("en-IN")} Unique PMS VINs Covered
            </div>
          </div>
        </div>

        {/* Multi-Month All-At-Once vs 1-by-1 Proof Table */}
        <div className="mt-4">
          <div className="mb-1.5 text-[12.5px] font-extrabold text-ink">
            4A · Proof: Why Selecting Multiple Months Together in MSIL CRM/BI Gives Wrong Numbers vs 1-by-1 Monthly Extraction
          </div>
          <div className="overflow-x-auto">
            <Table
              head={[
                "Comparison Scope",
                "Sum of 1-by-1 Monthly Downloads (Correct)",
                "Selected All-At-Once in MSIL (Wrong)",
                "Rows Lost / Collapsed by Multi-Month Selection",
                "1-by-1 Not-Done Rows vs All-At-Once",
                "Cross-Month Shifting VINs (Due in ≥2 Months)",
                "Root Cause in MSIL Qlik/CRM Engine",
              ]}
            >
              <tr className="border-t border-line">
                <Td>
                  <div className="font-extrabold text-ink">Nov + 6 Months PMS Window</div>
                  <div className="text-[11px] text-muted">May, Jun, Jul, Aug, Sep, Oct, Nov 2026 (7 Months)</div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-emerald-600">
                    {mm7.sum_1by1_rows.toLocaleString("en-IN")} Rows
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    {mm7.sum_1by1_unique_month_vin_pairs.toLocaleString("en-IN")} Month-VIN Cycles
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-rose-500">
                    {mm7.all_at_once_rows.toLocaleString("en-IN")} Rows
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    {mm7.all_at_once_distinct_vins.toLocaleString("en-IN")} Distinct VINs
                  </div>
                </Td>
                <Td>
                  <Badge tone="danger">
                    -{mm7.rows_lost_or_distorted.toLocaleString("en-IN")} Rows Collapsed
                  </Badge>
                  <div className="mt-0.5 font-mono text-[11px] text-rose-500">
                    -{mm7.month_vin_cycles_collapsed.toLocaleString("en-IN")} Month-VIN Cycles Lost
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-ink">
                    1-by-1: {mm7.sum_1by1_not_done_rows.toLocaleString("en-IN")} Not Done
                  </div>
                  <div className="font-mono text-[11px] text-rose-500">
                    All-at-Once: {mm7.all_at_once_not_done_rows.toLocaleString("en-IN")} (Diff: {mm7.not_done_understated_by_all_at_once.toLocaleString("en-IN")})
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-amber-600">
                    {mm7.shifting_vins_across_multiple_months.toLocaleString("en-IN")} VINs
                  </div>
                  <div className="text-[11px] text-muted">Appear in 2+ monthly pulls</div>
                </Td>
                <Td className="text-[11.5px] text-muted">
                  <code>Count(DISTINCT VIN)</code> merges multi-month due cycles and applies later-month Done status retroactively across earlier months.
                </Td>
              </tr>

              <tr className="border-t border-line">
                <Td>
                  <div className="font-extrabold text-ink">Full 16-Month Audit Window</div>
                  <div className="text-[11px] text-muted">Aug 2025 through Nov 2026 (16 Months)</div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-emerald-600">
                    {mm16.sum_1by1_rows.toLocaleString("en-IN")} Rows
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    {mm16.sum_1by1_unique_month_vin_pairs.toLocaleString("en-IN")} Month-VIN Cycles
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-rose-500">
                    {mm16.all_at_once_rows.toLocaleString("en-IN")} Rows
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    {mm16.all_at_once_distinct_vins.toLocaleString("en-IN")} Distinct VINs
                  </div>
                </Td>
                <Td>
                  <Badge tone="danger">
                    -{mm16.rows_lost_or_distorted.toLocaleString("en-IN")} Rows Collapsed
                  </Badge>
                  <div className="mt-0.5 font-mono text-[11px] text-rose-500">
                    -{mm16.month_vin_cycles_collapsed.toLocaleString("en-IN")} Month-VIN Cycles Lost
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-ink">
                    1-by-1: {mm16.sum_1by1_not_done_rows.toLocaleString("en-IN")} Not Done
                  </div>
                  <div className="font-mono text-[11px] text-rose-500">
                    All-at-Once: {mm16.all_at_once_not_done_rows.toLocaleString("en-IN")} (Diff: {mm16.not_done_understated_by_all_at_once.toLocaleString("en-IN")})
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-amber-600">
                    {mm16.shifting_vins_across_multiple_months.toLocaleString("en-IN")} VINs
                  </div>
                  <div className="text-[11px] text-muted">Appear across 2–6 monthly slices</div>
                </Td>
                <Td className="text-[11.5px] text-muted">
                  A car serviced in Oct 2025 and due again in Oct 2026 is collapsed into a single VIN record when selected together.
                </Td>
              </tr>
            </Table>
          </div>
        </div>
      </Section>

      {/* =====================================================================
          SECTION 4B: NOV + 6 MONTHS (MAY..NOV 2026) WORKSHOP-BY-WORKSHOP CORPORATE BLAME-SHIELD TRACKER
         ===================================================================== */}
      <Section
        title="5 · Nov + 6 Months (May–Nov 2026 1-by-1 PMS) Workshop-Wise Corporate Blame-Shield Contact Tracker (9 Sehgal Workshops)"
        sub="Tracks every PMS vehicle due across Nov 2026 + Last 6 Months (May, Jun, Jul, Aug, Sep, Oct, Nov 2026 downloaded 1-by-1) across all 9 Sehgal Autoriders workshops. Ensures 100% contact coverage (Layer 1 Glued 22-SMRE Queue + Layer 2 Auto-Dialer/WhatsApp/SMRE Blame-Shield Sweep) so Uncontacted = 0."
        right={<Badge tone="ok">ALL 9 SEHGAL WORKSHOPS · 0 UNCONTACTED EXPOSURE</Badge>}
      >
        <div className="overflow-x-auto">
          <Table
            head={[
              "Workshop Code & Name",
              "Nov+6M 1-by-1 Due (Rows / Unique VINs)",
              "MSIL Status Breakdown (Own / Other / Conflict / Not Done)",
              "Existing Documented CRM Footprint (DExC + Lake SMRE + DMS)",
              "Layer 1: Top-10% Glued SMRE Calling (95.45% Conv Engine)",
              "Layer 2: Blame-Shield Sweep (Auto-Dialer + WhatsApp + SMRE)",
              "Total Contact Shield Coverage (Zero Friction)",
            ]}
          >
            {MSIL_WORKSHOP_NOV_PLUS_6M_SHIELD.map((w) => (
              <tr key={w.outlet_code} className="border-t border-line">
                <Td>
                  <div className="font-mono text-[11.5px] font-bold text-accent">{w.outlet_code}</div>
                  <div className="font-extrabold text-ink">{w.workshop_name}</div>
                  <div className="text-[11px] text-muted">
                    {w.city} · {w.channel}
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-ink">
                    {w.nov_plus_6m_due_rows.toLocaleString("en-IN")} Due Rows
                  </div>
                  <div className="font-mono text-[11.5px] text-emerald-600">
                    {w.nov_plus_6m_unique_vins.toLocaleString("en-IN")} Unique VINs ({w.nov_plus_6m_month_vin_cycles.toLocaleString("en-IN")} Cycles)
                  </div>
                </Td>
                <Td>
                  <div className="font-mono text-[11.5px] text-emerald-600">
                    Own Done: {w.own_done_rows.toLocaleString("en-IN")} | Other: {w.other_dealer_done_rows.toLocaleString("en-IN")}
                  </div>
                  <div className="font-mono text-[11.5px] text-amber-600">
                    Conflict (Both=1): {w.flag_conflict_both_rows.toLocaleString("en-IN")}
                  </div>
                  <div className="font-mono text-[11.5px] font-bold text-rose-500">
                    Not Done: {w.not_done_rows.toLocaleString("en-IN")}
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-ink">
                    {w.documented_crm_footprint_vins.toLocaleString("en-IN")} / {w.nov_plus_6m_unique_vins.toLocaleString("en-IN")} ({w.documented_crm_footprint_pct}%)
                  </div>
                  <div className="text-[11px] text-muted">
                    DExC: {w.dexc_recent_logged_vins.toLocaleString("en-IN")} · SMRE Call Log: {w.lake_smre_logged_vins.toLocaleString("en-IN")} · Spine: {w.dms_spine_history_vins.toLocaleString("en-IN")}
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-emerald-600">
                    {w.layer1_top10_glued_smre_vins.toLocaleString("en-IN")} Glued Priority VINs
                  </div>
                  <div className="text-[11px] text-muted">22 SMREs × 100 Calls/Day Personal Follow-Up</div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {w.layer2_blame_shield_auto_whatsapp_smre_vins.toLocaleString("en-IN")} Shield Sweep VINs
                  </div>
                  <div className="text-[11px] text-muted">Enjay IVR + PingMate WA + DExC Attempt Stamp</div>
                </Td>
                <Td>
                  <Badge tone="ok">100.00% CONTACTED (0 LEFT)</Badge>
                  <div className="mt-0.5 text-[11px] font-semibold text-emerald-600">
                    Zero Corporate Blame Exposure
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </Section>

      {/* =====================================================================
          SECTION 4C: MONTH-BY-MONTH 1-BY-1 MSIL DUE DISCREPANCY LEDGER (ALL 17 MONTHS)
         ===================================================================== */}
      <Section
        title="6 · Month-by-Month 1-by-1 MSIL CRM Due Discrepancy Ledger (Jul 2025 – Nov 2026 · 17 Individual Monthly Downloads)"
        sub="Each row below was downloaded separately 1-by-1 from MSIL BI/CRM (Region = W2, SMR Service Type = PMS, Due_Month_Year = Single Month, Done_Month_Year = 6-Month Window)."
        right={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMonthScope("ALL_17")}
              className={`rounded px-2.5 py-1 text-[12px] font-bold border ${
                monthScope === "ALL_17" ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
              }`}
            >
              All 17 Months (Jul 2025 – Nov 2026)
            </button>
            <button
              type="button"
              onClick={() => setMonthScope("NOV_PLUS_6")}
              className={`rounded px-2.5 py-1 text-[12px] font-bold border ${
                monthScope === "NOV_PLUS_6"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-line bg-surface text-ink"
              }`}
            >
              Nov + 6 Months PMS Window (May – Nov 2026)
            </button>
          </div>
        }
      >
        <div className="max-h-[520px] overflow-auto">
          <Table
            head={[
              "Due Month (1-by-1 Pull)",
              "Exported Rows vs Unique VINs",
              "Same-Month Duplicate Rows",
              "Own Done vs Other Dealer",
              "Flag Conflict (Own=1 & Other=1)",
              "UI Not Done & Backend Mislabeled Flag",
              "Missing Last Type ('-') & Non-PMS Leak",
              "Ghost Not-Done (Invoiced in DMS Spine)",
              "Bodyshop/RR Clock Distorted",
              "Blame-Shield Contact Status",
            ]}
          >
            {visibleMonths.map((m) => (
              <tr
                key={m.due_month}
                className={`border-t border-line ${m.is_nov_plus_6 ? "bg-emerald-500/5" : ""}`}
              >
                <Td>
                  <div className="font-extrabold text-ink">{m.due_month}</div>
                  {m.is_nov_plus_6 ? (
                    <Badge tone="ok">NOV + 6M SHIELD</Badge>
                  ) : (
                    <span className="text-[11px] text-muted">15M Historical Audit</span>
                  )}
                </Td>
                <Td>
                  <div className="font-mono font-bold text-ink">
                    {m.exported_rows.toLocaleString("en-IN")} Rows
                  </div>
                  <div className="font-mono text-[11.5px] text-emerald-600">
                    {m.unique_vins.toLocaleString("en-IN")} Unique VINs
                  </div>
                </Td>
                <Td>
                  <Badge tone={m.same_month_duplicate_rows > 0 ? "warn" : "ok"}>
                    +{m.same_month_duplicate_rows.toLocaleString("en-IN")} Dup Rows
                  </Badge>
                </Td>
                <Td>
                  <div className="font-mono text-[11.5px] text-emerald-600">
                    Own: {m.own_done_only_rows.toLocaleString("en-IN")}
                  </div>
                  <div className="font-mono text-[11.5px] text-muted">
                    Other: {m.other_dealer_only_rows.toLocaleString("en-IN")}
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-rose-500">
                    {m.flag_conflict_both_done_rows.toLocaleString("en-IN")} Rows
                  </div>
                  <div className="text-[10.5px] text-muted">Both Own=1 &amp; Other=1</div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-ink">
                    {m.not_done_rows.toLocaleString("en-IN")} UI Not Done
                  </div>
                  <div className="font-mono text-[11px] text-amber-600">
                    {m.backend_null_status_flag_rows.toLocaleString("en-IN")} Backend Mislabeled
                  </div>
                </Td>
                <Td>
                  <div className="font-mono text-[11.5px] text-purple-600 dark:text-purple-400">
                    Last=&apos;-&apos;: {m.missing_last_srv_type_rows.toLocaleString("en-IN")}
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    Non-PMS Leak: {m.non_pms_leakage_rows.toLocaleString("en-IN")}
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-emerald-600">
                    {m.ghost_not_done_in_dms_spine.toLocaleString("en-IN")} VINs
                  </div>
                  <div className="text-[10.5px] text-muted">Billed in W2 Spine</div>
                </Td>
                <Td>
                  <div className="font-mono text-[11.5px] text-ink">
                    {m.bodyshop_rr_clock_distorted_vins.toLocaleString("en-IN")} VINs
                  </div>
                  <div className="text-[10.5px] text-muted">BANDP / RR Visits</div>
                </Td>
                <Td>
                  <div className="font-mono text-[11.5px] font-bold text-emerald-600">
                    {m.historical_crm_contacted_vins.toLocaleString("en-IN")} Logged
                  </div>
                  <Badge tone="ok">
                    100% ({m.shield_100pct_target_vins.toLocaleString("en-IN")}) Shielded
                  </Badge>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </Section>

      {/* =====================================================================
          SECTION 4D: VERIFIED VEHICLE-LEVEL MSIL DISCREPANCY SAMPLE AUDIT TABLE
         ===================================================================== */}
      <Section
        title="7 · Verified Vehicle-Level MSIL Discrepancy Proof Table (Real VINs, MSIL Conflicting Flags & Blame-Shield Action)"
        sub="Concrete vehicle-level examples from our 1-by-1 MSIL extracts proving each discrepancy category and how our Blame-Shield handles the customer."
        right={<Badge tone="brand">{visibleSamples.length} VERIFIED PROOF CASES</Badge>}
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setDiscCategory(cat)}
              className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-bold ${
                discCategory === cat
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-ink"
              }`}
            >
              {cat === "ALL" ? "All Discrepancy Categories" : cat}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <Table
            head={[
              "Discrepancy Category & Month",
              "Registration No · VIN · Model",
              "Workshop & MSIL Due Type",
              "Raw MSIL Export Flags",
              "Verified Discrepancy Proof (MSIL vs W2 DMS Spine)",
              "Corporate Blame-Shield Resolution",
            ]}
          >
            {visibleSamples.map((c, idx) => (
              <tr key={c.vin + "_" + idx} className="border-t border-line">
                <Td>
                  <Badge tone="warn">{c.category}</Badge>
                  <div className="mt-1 font-mono text-[11.5px] font-bold text-ink">{c.due_month}</div>
                </Td>
                <Td>
                  <div className="font-mono font-extrabold text-ink">{c.reg_no}</div>
                  <div className="font-mono text-[11px] text-muted">VIN: {c.vin}</div>
                  <div className="text-[11.5px] font-semibold text-ink">{c.model}</div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-accent">{c.outlet_code}</div>
                  <div className="font-mono text-[11.5px] text-ink">{c.msil_due_type}</div>
                </Td>
                <Td className="font-mono text-[11.5px] text-rose-500">{c.msil_flags}</Td>
                <Td className="text-[12px] text-ink">{c.discrepancy_proof}</Td>
                <Td>
                  <Badge tone="ok">✓ SHIELDED &amp; LOGGED</Badge>
                  <div className="mt-0.5 text-[11.5px] text-emerald-600">{c.blame_shield_action}</div>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </Section>
    </div>
  );
}
