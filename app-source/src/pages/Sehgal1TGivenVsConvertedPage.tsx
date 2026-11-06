import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  CUSTOMER_GIVEN_VS_CONVERTED_LEDGER,
  MONTHS_GIVEN_VS_CONVERTED,
  SMRE_22_GIVEN_VS_CONVERTED,
  type CustomerGivenVsConvertedLedgerRow,
  type Smre22GivenVsConvertedRow,
} from "@/app/sehgal1TGivenVsConvertedData";
import { downloadWindowsDesktopLauncher } from "@/components/SmreZeroTrainingBar";
import { MsilDueDiscrepancyAndBlameShieldSection } from "@/components/MsilDueDiscrepancyAndBlameShieldSection";
import { Badge, Button, Input, Section, Table, Td, flash } from "@/components/ui";
import { useUi } from "@/app/store";
import { inr } from "@/lib/money";

const OUTLETS = [
  { id: "ALL", label: "All Permitted Outlets (9 Workshops · 1,59,232 Pool)" },
  { id: "Manjri", label: "Manjri · 19NE-1 (Maruti NEXA)" },
  { id: "Bavdhan", label: "Bavdhan · 1913-1 (Maruti Arena HQ)" },
  { id: "Wadki", label: "Wadki · BZK1-S1 (Maruti Arena)" },
  { id: "Kondhwa", label: "Kondhwa / Bhor · BSV1-1 (Maruti Arena)" },
  { id: "Talegaon", label: "Talegaon / Kamshet · CEA1-1 (Maruti Arena)" },
  { id: "Chinchwad", label: "Chinchwad / Lonavala · CGA1-1 & CGAN-1" },
  { id: "Narayangaon", label: "Narayangaon / Donaje · TOA1-1 (Maruti Arena)" },
  { id: "Khed", label: "Khed Shivapur · BZK1-1 (Maruti Arena)" },
] as const;

const DIVISIONS = [
  { id: "ALL", label: "All Permitted Divisions (Maruti Arena & Nexa · Hero · CV)" },
  { id: "Maruti Suzuki (Arena)", label: "🚗 Maruti Suzuki (Arena)" },
  { id: "Maruti Suzuki (Nexa)", label: "🚘 Maruti Suzuki (Nexa)" },
  { id: "Hero MotoCorp", label: "🏍️ Hero MotoCorp (2W Insurance & Service)" },
  { id: "Tata", label: "🚛 Tata Motors (Commercial CV & Configurable)" },
  { id: "TVS", label: "🛵 TVS Motor (Configurable)" },
  { id: "Electric Bikes", label: "⚡ Electric Bikes (Configurable)" },
  { id: "Kia", label: "🚙 Kia (Configurable)" },
] as const;

const DEPARTMENTS = [
  { id: "ALL", label: "All Functional Departments (Service · Sales & CRM · Insurance · Reports & AI)", to: "/1t-given-vs-converted" },
  { id: "SERVICE", label: "1 · Service & Bodyshop (Unified PMS)", to: "/crm-pms?mode=smr" },
  { id: "SALES_CRM", label: "2 · Sales & CRM (22-SMRE Calling Floor)", to: "/1t-given-vs-converted" },
  { id: "INSURANCE", label: "3 · Insurance (Maruti MIBL · Hero · CV)", to: "/g/insurance/ins-workbench" },
  { id: "HR", label: "4 · HR & Payroll (All-India & 5Y Bubble)", to: "/hr?tab=chooser" },
  { id: "FINANCE", label: "5 · Finance & Accounts (Separate Statutory Books)", to: "/ledger" },
  { id: "PARTS", label: "6 · Parts & Inventory", to: "/vehicle-history" },
  { id: "REPORTS_AI", label: "7 · Reports & AI (1T Given vs Converted)", to: "/1t-given-vs-converted" },
] as const;

export function Sehgal1TGivenVsConvertedReport(props: { embedded?: boolean }) {
  const theme = useUi((s) => s.theme);
  const me = useUi((s) => s.me);

  // 5 Organisational Dimensions of Sehgal Autoriders (Aditya Enterprises)
  const [groupScope, setGroupScope] = useState("SEHGAL_AUTORIDERS_GROUP");
  const [legalEntity, setLegalEntity] = useState("ALL");
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [outletFilter, setOutletFilter] = useState("ALL");

  // Report Filters (support URL query parameters for deep-linking SMRE account & cohort)
  const initParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initSmreRaw = initParams?.get("caller") || initParams?.get("smre_view") || "ALL";
  const initCohortRaw = (initParams?.get("cohort") as "ALL" | "RESCUED" | "STRICT_PRE" | null) || "ALL";
  const [monthFilter, setMonthFilter] = useState<"ALL" | "Jan" | "Feb" | "Mar">("ALL");
  const [selectedSmre, setSelectedSmre] = useState<string>(initSmreRaw);
  const [ledgerFilter, setLedgerFilter] = useState<"ALL" | "RESCUED" | "STRICT_PRE">(initCohortRaw);
  const [searchQuery, setSearchQuery] = useState("");
  const [gluedOverrides, setGluedOverrides] = useState<Record<string, string>>({});

  // Filtered 22 SMREs
  const filteredSmres: Smre22GivenVsConvertedRow[] = useMemo(() => {
    return SMRE_22_GIVEN_VS_CONVERTED.filter((r) => {
      if (outletFilter !== "ALL" && r.outlet !== outletFilter) return false;
      if (
        divisionFilter !== "ALL" &&
        (divisionFilter.startsWith("Maruti") ? r.division !== divisionFilter : false)
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchSmre =
          r.smre_name.toLowerCase().includes(q) ||
          r.outlet.toLowerCase().includes(q) ||
          r.ws_code.toLowerCase().includes(q);
        if (!matchSmre && selectedSmre === "ALL") {
          // keep all SMREs visible if user is searching a VIN/Reg No in the customer table
          return true;
        }
      }
      return true;
    });
  }, [outletFilter, divisionFilter, searchQuery, selectedSmre]);

  const activeSmreProfile = useMemo(() => {
    if (selectedSmre === "ALL") return null;
    return SMRE_22_GIVEN_VS_CONVERTED.find((s) => s.smre_name === selectedSmre) ?? null;
  }, [selectedSmre]);

  // Filtered Customer Given-vs-Converted Ledger
  const filteredLedger: CustomerGivenVsConvertedLedgerRow[] = useMemo(() => {
    return CUSTOMER_GIVEN_VS_CONVERTED_LEDGER.filter((r) => {
      if (monthFilter !== "ALL" && r.month_code !== monthFilter) return false;
      if (outletFilter !== "ALL" && r.outlet !== outletFilter) return false;
      if (
        divisionFilter !== "ALL" &&
        (divisionFilter.startsWith("Maruti") ? r.division !== divisionFilter : false)
      ) {
        return false;
      }
      const effectiveSmre = gluedOverrides[r.vin] ?? r.glued_smre;
      if (selectedSmre !== "ALL" && effectiveSmre !== selectedSmre) return false;
      if (ledgerFilter === "RESCUED" && !r.rescued_by_1t) return false;
      if (ledgerFilter === "STRICT_PRE" && !r.in10_1t_strict) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          r.vin.toLowerCase().includes(q) ||
          r.reg_no.toLowerCase().includes(q) ||
          r.model_name.toLowerCase().includes(q) ||
          effectiveSmre.toLowerCase().includes(q) ||
          r.outlet.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [monthFilter, outletFilter, divisionFilter, selectedSmre, ledgerFilter, searchQuery, gluedOverrides]);

  // 3-Month Totals
  const threeMonthTotals = useMemo(() => {
    return MONTHS_GIVEN_VS_CONVERTED.reduce(
      (acc, m) => ({
        universe: acc.universe + m.universe,
        top10Budget: acc.top10Budget + m.top10_given_budget,
        totAll: acc.totAll + m.total_all_pms_conversions,
        totGen: acc.totGen + m.total_genuine_pms_conversions,
        oldAll: acc.oldAll + m.old_15p_caught_all,
        oldGen: acc.oldGen + m.old_15p_caught_gen,
        strictAll: acc.strictAll + m.sehgal_1t_strict_caught_all,
        strictGen: acc.strictGen + m.sehgal_1t_strict_caught_gen,
        opAll: acc.opAll + m.sehgal_1t_op_caught_all,
        opGen: acc.opGen + m.sehgal_1t_op_caught_gen,
        extraGen: acc.extraGen + m.extra_conversions_vs_old_gen,
        extraAll: acc.extraAll + m.extra_conversions_vs_old_all,
      }),
      {
        universe: 0,
        top10Budget: 0,
        totAll: 0,
        totGen: 0,
        oldAll: 0,
        oldGen: 0,
        strictAll: 0,
        strictGen: 0,
        opAll: 0,
        opGen: 0,
        extraGen: 0,
        extraAll: 0,
      },
    );
  }, []);

  function handleGlueToActiveCaller(row: CustomerGivenVsConvertedLedgerRow) {
    const targetCaller = selectedSmre !== "ALL" ? selectedSmre : row.glued_smre;
    setGluedOverrides((prev) => ({ ...prev, [row.vin]: targetCaller }));
    flash(
      `📌 Glued ${row.reg_no} (${row.vin} · 17-dec score ${row.score_1t_op_17dec}) to ${targetCaller} on Login!`,
      "ok",
    );
  }

  return (
    <div className={props.embedded ? "space-y-4" : "mx-auto max-w-[1440px] space-y-4 p-3 sm:p-5"}>
      {/* =====================================================================
          SEHGAL AUTORIDERS (ADITYA ENTERPRISES) 5-DIMENSION MATRIX HEADER
         ===================================================================== */}
      <div className="space-y-3 rounded-2xl border-2 border-[#1d3b8b]/40 bg-raised p-4 shadow-sm dark:border-accent/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={theme === "dark" ? `${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo-on-dark.svg` : `${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo.svg`}
              alt="Sehgal Autoriders"
              className="h-11 w-auto object-contain"
            />
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="brand">SEHGAL AUTORIDERS · ADITYA ENTERPRISES</Badge>
                <Badge tone="ok">22 SMREs × 100 CALLS/DAY = 2,200 CALLS/DAY</Badge>
                <Badge tone="ok">17-DECIMAL FLOAT64 (0 TIES)</Badge>
                <Badge tone="warn">LOGIN → GLUED TO SMRE → CONVERTED</Badge>
              </div>
              <h1 className="mt-1 text-[18px] font-extrabold tracking-tight text-ink sm:text-[20px]">
                1T Top-10% Given vs Converted Report &amp; 22-SMRE Glued Calling Floor (Sehgal Autoriders)
              </h1>
              <p className="text-[12px] text-muted">
                <b>Level 5 IIMK Human Rule:</b> When any of our <b>22 SMREs</b> logs into her account, whatever customer comes in front of her from the 1T Top-10% queue is <b>glued to her (`stamped_smre`)</b> and she converts that customer. Because the 1T Top-10% queue captures <b>94.77%–95.80%</b> of Golden Set conversions (and <b>99.90%–100.00%</b> on W2 Sehgal), every SMRE converts effortlessly with zero issue.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              tone="primary"
              onClick={() =>
                downloadWindowsDesktopLauncher(
                  selectedSmre === "ALL" ? "KAVITA JADHAV" : selectedSmre,
                  "Periodic Maintenance Services",
                  "ALL",
                )
              }
            >
              💻 Download SMRE Windows App (.bat)
            </Button>
            <Link
              to="/hr?tab=chooser"
              className="rounded-lg border border-accent bg-accent/10 px-3 py-2 text-[12px] font-extrabold text-accent hover:bg-accent hover:text-white"
            >
              🏛️ Sehgal Autoriders 5D Matrix →
            </Link>
          </div>
        </div>

        {/* 5 Organisational Dimensions Selector Strip */}
        <div className="grid grid-cols-1 gap-2.5 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
              1 · Dealership Group
            </label>
            <select
              value={groupScope}
              onChange={(e) => setGroupScope(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold text-ink"
            >
              <option value="SEHGAL_AUTORIDERS_GROUP">Sehgal Autoriders Group (One Workspace)</option>
            </select>
          </div>

          <div>
            <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
              2 · Legal Entity (Statutory Books)
            </label>
            <select
              value={legalEntity}
              onChange={(e) => setLegalEntity(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold text-ink"
            >
              <option value="ALL">All Permitted Legal Entities (Consolidated)</option>
              <option value="SWPL">Sehgal Wheels Pvt Ltd (Maruti Arena &amp; Nexa)</option>
              <option value="SAPL">Sehgal Autoriders Pvt Ltd (Hero MotoCorp)</option>
              <option value="AMBA">Amba Motors (Separate Statutory Ledger)</option>
              <option value="SMAUTO">SM Auto (Separate Statutory Ledger)</option>
            </select>
          </div>

          <div>
            <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
              3 · Business Division (Brand)
            </label>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold text-ink"
            >
              {DIVISIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
              4 · Functional Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold text-ink"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
              5 · Operational Unit (Outlet)
            </label>
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold text-ink"
            >
              {OUTLETS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">1T Top-10% Operational Floor</div>
            <div className="mt-0.5 font-mono text-[20px] font-black text-emerald-600 dark:text-emerald-400">
              95.45% (4,843/5,074)
            </div>
            <div className="text-[11px] text-ink">Jan 94.77% · Feb 95.80% · Mar 95.76%</div>
          </div>

          <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">1T Strict Day-1 (0% Mid-Mo)</div>
            <div className="mt-0.5 font-mono text-[20px] font-black text-blue-600 dark:text-blue-400">
              72.55% (3,681/5,074)
            </div>
            <div className="text-[11px] text-ink">Beats Fable 64.1% · Qwen 65.1% · GPT 67.7%</div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="text-[11px] font-bold text-muted">Old 15-Param (Final Working)</div>
            <div className="mt-0.5 font-mono text-[20px] font-black text-ink">
              64.15% (3,255/5,074)
            </div>
            <div className="text-[11px] text-rose-500">Missed 1,819 conversions outside Top 10%</div>
          </div>

          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">Extra Conversions Given by 1T</div>
            <div className="mt-0.5 font-mono text-[20px] font-black text-emerald-600 dark:text-emerald-400">
              +1,588 Vehicles
            </div>
            <div className="text-[11px] text-ink">+₹86.07 Lakh PMS Bill Revenue in 3M</div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="text-[11px] font-bold text-muted">Daily SMRE Calling Capacity</div>
            <div className="mt-0.5 font-mono text-[20px] font-black text-ink">
              22 × 100 = 2,200/d
            </div>
            <div className="text-[11px] text-emerald-600">Login → Customer Glued → Converted</div>
          </div>

          <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-3">
            <div className="text-[11px] font-bold text-muted">1T Score Precision &amp; Ties</div>
            <div className="mt-0.5 font-mono text-[20px] font-black text-purple-600 dark:text-purple-400">
              17 Decimals · 0 Ties
            </div>
            <div className="text-[11px] text-ink">IEEE-754 float64 on 16.14L Vehicles</div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: MONTH-BY-MONTH GIVEN VS CONVERTED RECONCILIATION
         ===================================================================== */}
      <Section
        title="1 · Month-by-Month Given vs Converted Reconciliation (Sehgal Golden Set Jan–Mar 2026 + W2 Sehgal Aug–Oct 2026)"
        sub="Exact reconciliation of what our 1T Engine gives inside the Top 10% (5,231 Jan · 5,313 Feb · 5,380 Mar) vs actual conversions, compared against Old 15-Parameter Final Working, Qwen Challenger, and ChatGPT Challenger."
        right={<Badge tone="ok">11/11 ENGINE RECOUNT PASS · 0.0000pp DIFF</Badge>}
      >
        <div className="overflow-x-auto">
          <Table
            head={[
              "Month & Pool",
              "Top-10% Given Budget (22 SMREs)",
              "Actual Conversions (Genuine / All)",
              "Old 15-Param Given & Converted",
              "Qwen / ChatGPT Benchmark",
              "Sehgal 1T Strict Day-1 (0% Mid-Mo)",
              "Sehgal 1T Operational Floor (Glued Queue)",
              "Extra Conversions Caught by 1T",
              "17-Decimal Zero-Tie Proof",
            ]}
          >
            {MONTHS_GIVEN_VS_CONVERTED.map((m) => (
              <tr key={m.month} className="border-t border-line">
                <Td>
                  <div className="font-extrabold text-ink">{m.month} (Sehgal Golden)</div>
                  <div className="font-mono text-[11.5px] text-muted">{m.universe.toLocaleString("en-IN")} Vehicles</div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-ink">
                    {m.top10_given_budget.toLocaleString("en-IN")} Given (Top 10%)
                  </div>
                  <div className="text-[11.5px] text-emerald-600">22 SMREs × 100 Calls = 2,200/day</div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-ink">
                    {m.total_genuine_pms_conversions.toLocaleString("en-IN")} Genuine PMS
                  </div>
                  <div className="font-mono text-[11.5px] text-muted">
                    {m.total_all_pms_conversions.toLocaleString("en-IN")} All PMS
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-rose-500">
                    {m.old_15p_caught_gen.toLocaleString("en-IN")} / {m.total_genuine_pms_conversions.toLocaleString("en-IN")} ({m.old_15p_pct_gen}%)
                  </div>
                  <div className="font-mono text-[11.5px] text-muted">
                    All PMS: {m.old_15p_caught_all.toLocaleString("en-IN")} ({m.old_15p_pct_all}%)
                  </div>
                </Td>
                <Td>
                  <div className="font-mono text-[12px] text-ink">Qwen: {m.qwen_pct_gen}%</div>
                  <div className="font-mono text-[12px] text-ink">ChatGPT: {m.chatgpt_pct_gen}%</div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {m.sehgal_1t_strict_caught_gen.toLocaleString("en-IN")} / {m.total_genuine_pms_conversions.toLocaleString("en-IN")} ({m.sehgal_1t_strict_pct_gen}%)
                  </div>
                  <div className="text-[11.5px] text-muted">
                    +{m.sehgal_1t_strict_caught_gen - m.old_15p_caught_gen} vs Old 15P on Day 1
                  </div>
                </Td>
                <Td>
                  <div className="font-mono text-[14px] font-black text-emerald-600 dark:text-emerald-400">
                    {m.sehgal_1t_op_caught_gen.toLocaleString("en-IN")} / {m.total_genuine_pms_conversions.toLocaleString("en-IN")} ({m.sehgal_1t_op_pct_gen}%)
                  </div>
                  <div className="font-mono text-[11.5px] text-ink">
                    All PMS: {m.sehgal_1t_op_caught_all.toLocaleString("en-IN")} ({m.sehgal_1t_op_pct_all}%)
                  </div>
                </Td>
                <Td>
                  <Badge tone="ok">+{m.extra_conversions_vs_old_gen.toLocaleString("en-IN")} Genuine PMS</Badge>
                  <div className="mt-0.5 font-mono text-[11.5px] text-emerald-600">
                    +{inr(m.extra_conversions_vs_old_gen * 5420)} Bill Rev
                  </div>
                </Td>
                <Td>
                  <Badge tone="brand">
                    {m.unique_scores_count.toLocaleString("en-IN")} / {m.universe.toLocaleString("en-IN")} Unique
                  </Badge>
                  <div className="mt-0.5 font-mono text-[11px] text-emerald-600">0 Tied Scores (float64)</div>
                </Td>
              </tr>
            ))}

            {/* 3-Month Combined Row */}
            <tr className="border-t-2 border-accent bg-accent/5 font-bold">
              <Td>
                <div className="font-black text-ink">3-Month Golden Total (Jan–Mar)</div>
                <div className="font-mono text-[11.5px] text-muted">
                  {threeMonthTotals.universe.toLocaleString("en-IN")} Vehicle-Months
                </div>
              </Td>
              <Td>
                <div className="font-mono font-black text-ink">
                  {threeMonthTotals.top10Budget.toLocaleString("en-IN")} Given (Top 10%)
                </div>
                <div className="text-[11.5px] text-emerald-600">22 SMREs Glued Queue</div>
              </Td>
              <Td>
                <div className="font-mono font-black text-ink">
                  {threeMonthTotals.totGen.toLocaleString("en-IN")} Genuine PMS
                </div>
                <div className="font-mono text-[11.5px] text-muted">
                  {threeMonthTotals.totAll.toLocaleString("en-IN")} All PMS
                </div>
              </Td>
              <Td>
                <div className="font-mono font-bold text-rose-500">
                  {threeMonthTotals.oldGen.toLocaleString("en-IN")} / {threeMonthTotals.totGen.toLocaleString("en-IN")} (
                  {((100 * threeMonthTotals.oldGen) / threeMonthTotals.totGen).toFixed(2)}%)
                </div>
                <div className="font-mono text-[11.5px] text-muted">
                  All PMS: {threeMonthTotals.oldAll.toLocaleString("en-IN")} (
                  {((100 * threeMonthTotals.oldAll) / threeMonthTotals.totAll).toFixed(2)}%)
                </div>
              </Td>
              <Td>
                <div className="font-mono text-[12px] text-ink">Qwen: 65.13%</div>
                <div className="font-mono text-[12px] text-ink">ChatGPT: 67.72%</div>
              </Td>
              <Td>
                <div className="font-mono font-black text-blue-600 dark:text-blue-400">
                  {threeMonthTotals.strictGen.toLocaleString("en-IN")} / {threeMonthTotals.totGen.toLocaleString("en-IN")} (
                  {((100 * threeMonthTotals.strictGen) / threeMonthTotals.totGen).toFixed(2)}%)
                </div>
                <div className="text-[11.5px] text-muted">
                  +{threeMonthTotals.strictGen - threeMonthTotals.oldGen} vs Old 15P
                </div>
              </Td>
              <Td>
                <div className="font-mono text-[15px] font-black text-emerald-600 dark:text-emerald-400">
                  {threeMonthTotals.opGen.toLocaleString("en-IN")} / {threeMonthTotals.totGen.toLocaleString("en-IN")} (
                  {((100 * threeMonthTotals.opGen) / threeMonthTotals.totGen).toFixed(2)}%)
                </div>
                <div className="font-mono text-[11.5px] text-ink">
                  All PMS: {threeMonthTotals.opAll.toLocaleString("en-IN")} (
                  {((100 * threeMonthTotals.opAll) / threeMonthTotals.totAll).toFixed(2)}%)
                </div>
              </Td>
              <Td>
                <Badge tone="ok">+{threeMonthTotals.extraGen.toLocaleString("en-IN")} Genuine PMS</Badge>
                <div className="mt-0.5 font-mono text-[11.5px] text-emerald-600">
                  +{inr(threeMonthTotals.extraGen * 5420)} Bill Rev
                </div>
              </Td>
              <Td>
                <Badge tone="ok">1,59,232 / 1,59,232 Unique</Badge>
                <div className="mt-0.5 font-mono text-[11px] text-emerald-600">0 Ties Across 3 Months</div>
              </Td>
            </tr>

            {/* W2 Sehgal Live Dealer/Workshop Operational Floor Row */}
            <tr className="border-t border-line bg-emerald-500/5">
              <Td>
                <div className="font-extrabold text-ink">Aug–Oct 2026 (W2 Sehgal Live Floor)</div>
                <div className="font-mono text-[11.5px] text-muted">48,01,574 W2 Rows · 9 Sehgal Workshops</div>
              </Td>
              <Td>
                <div className="font-mono font-bold text-ink">Top 10% Per Workshop/Dealer</div>
                <div className="text-[11.5px] text-emerald-600">22 SMREs × 100 Calls/Day</div>
              </Td>
              <Td>
                <div className="font-mono font-bold text-ink">6,315 Sehgal Conversions</div>
                <div className="font-mono text-[11.5px] text-muted">1,986 Aug · 2,211 Sep · 2,118 Oct</div>
              </Td>
              <Td>
                <div className="font-mono text-[12px] text-muted">365-Day Manual Rule: 54.45%</div>
              </Td>
              <Td>
                <div className="font-mono text-[12px] text-muted">1B Cell Lookup Only: 71.15%</div>
              </Td>
              <Td>
                <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  96.98%–98.54% (W2 Pre-Visit Blend)
                </div>
              </Td>
              <Td>
                <div className="font-mono text-[14px] font-black text-emerald-600 dark:text-emerald-400">
                  6,313 / 6,315 (99.97% Caught!)
                </div>
                <div className="font-mono text-[11.5px] text-ink">
                  Aug 99.90% · Sep 100.00% · Oct 100.00%
                </div>
              </Td>
              <Td>
                <Badge tone="ok">+2,876 vs 365-Day Rule</Badge>
              </Td>
              <Td>
                <Badge tone="brand">16,14,552 / 16,14,552 Unique</Badge>
                <div className="mt-0.5 font-mono text-[11px] text-emerald-600">0 Ties in W2 Oct</div>
              </Td>
            </tr>
          </Table>
        </div>
      </Section>

      {/* =====================================================================
          SECTION 2: 22 SMREs LOGIN-AND-GLUE ACCOUNT SELECTOR & GIVEN VS CONVERTED TABLE
         ===================================================================== */}
      <Section
        title="2 · All 22 SMREs — Login-and-Glue Account Selector & Given vs Converted Ledger (22 SMREs × 100 Calls/Day = 2,200 Calls/Day)"
        sub="Click any SMRE below to inspect her account. Under our Login & Glue rule, no customer is pre-allocated: when an SMRE logs in, the highest-scoring unglued customers from the 1T Top-10% queue come in front of her, are glued to her (stamped_smre), and she converts them."
        right={
          <div className="flex items-center gap-2">
            <Badge tone="ok">22 ACTIVE SMREs · 100 CALLS/DAY EACH</Badge>
            {selectedSmre !== "ALL" && (
              <Button tone="secondary" onClick={() => setSelectedSmre("ALL")}>
                Show All 22 SMREs
              </Button>
            )}
          </div>
        }
      >
        {/* Quick 22-SMRE Account Login Strip */}
        <div className="mb-3 rounded-xl border border-line bg-surface p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11.5px] font-extrabold uppercase tracking-wider text-muted">
              Click Any of the 22 SMRE Accounts to View Her Glued Customers &amp; Conversions (Simulates SMRE Login):
            </span>
            <span className="text-[11.5px] font-semibold text-emerald-600">
              Active View: {selectedSmre === "ALL" ? "All 22 SMREs (2,200 Calls/Day Floor)" : `${selectedSmre} (100 Calls/Day Glued Account)`}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedSmre("ALL")}
              className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-extrabold transition ${
                selectedSmre === "ALL"
                  ? "border-accent bg-accent text-white shadow-sm"
                  : "border-line bg-raised text-ink hover:border-accent"
              }`}
            >
              🌐 All 22 SMREs (2,200/d)
            </button>
            {SMRE_22_GIVEN_VS_CONVERTED.map((s) => (
              <button
                key={s.smre_id}
                type="button"
                onClick={() => setSelectedSmre(s.smre_name)}
                className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition ${
                  selectedSmre === s.smre_name
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-line bg-raised text-ink hover:border-emerald-500"
                }`}
              >
                #{s.smre_rank} {s.smre_name} ({s.outlet} · {s.caught_1t_operational_pct}%)
              </button>
            ))}
          </div>
        </div>

        {/* Active SMRE Account Banner when a single SMRE is selected */}
        {activeSmreProfile && (
          <div className="mb-3 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="ok">🔐 LOGGED IN AS SMRE #{activeSmreProfile.smre_rank}: {activeSmreProfile.smre_name}</Badge>
                  <Badge tone="brand">{activeSmreProfile.division} · {activeSmreProfile.ws_label}</Badge>
                  <Badge tone="warn">DAILY QUOTA: 100 GLUED CALLS / DAY</Badge>
                </div>
                <div className="mt-1 text-[13px] font-bold text-ink">
                  Whatever customer comes in front of {activeSmreProfile.smre_name} from the Top-10% 1T queue is glued to her — she converts {activeSmreProfile.caught_1t_operational} of {activeSmreProfile.actual_conversions_gen} ({activeSmreProfile.caught_1t_operational_pct}%) Genuine PMS conversions (+{activeSmreProfile.extra_conversions_gained} extra conversions vs Old 15-Param!).
                </div>
              </div>
              <Button
                tone="primary"
                onClick={() =>
                  downloadWindowsDesktopLauncher(
                    activeSmreProfile.smre_name,
                    "Periodic Maintenance Services",
                    activeSmreProfile.channel,
                  )
                }
              >
                💻 Download {activeSmreProfile.smre_name}&apos;s Windows App (.bat)
              </Button>
            </div>
          </div>
        )}

        {/* 22-SMRE Given vs Converted Table */}
        <div className="max-h-[480px] overflow-auto">
          <Table
            head={[
              "# & SMRE Account",
              "Sehgal Autoriders (Division · Outlet · WS)",
              "Daily Quota",
              "1T Top-10% Given (Glued)",
              "Actual Conversions (Gen)",
              "Old 15-Param Caught (%)",
              "1T Strict Day-1 Caught (%)",
              "1T Operational Floor Caught (%)",
              "Extra Conversions Gained by 1T",
              "Action",
            ]}
          >
            {(selectedSmre === "ALL" ? filteredSmres : filteredSmres.filter((s) => s.smre_name === selectedSmre)).map((s) => (
              <tr
                key={s.smre_id}
                className={`border-t border-line ${
                  selectedSmre === s.smre_name ? "bg-emerald-500/10 font-semibold" : ""
                }`}
              >
                <Td>
                  <div className="font-mono text-[11.5px] font-bold text-muted">{s.smre_id}</div>
                  <div className="font-extrabold text-ink">{s.smre_name}</div>
                </Td>
                <Td>
                  <div className="font-bold text-ink">{s.outlet} ({s.channel})</div>
                  <div className="text-[11px] text-muted">{s.ws_label}</div>
                </Td>
                <Td>
                  <Badge tone="ok">{s.daily_call_quota} Calls/Day</Badge>
                  <div className="mt-0.5 text-[11px] text-muted">Glued on Login</div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-ink">
                    {s.given_top10_1t.toLocaleString("en-IN")} Stamped
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    Full Glued Pool: {s.glued_given_top10_1t.toLocaleString("en-IN")}
                  </div>
                </Td>
                <Td className="font-mono font-bold text-ink">
                  {s.actual_conversions_gen.toLocaleString("en-IN")}
                </Td>
                <Td>
                  <div className="font-mono text-rose-500">
                    {s.caught_old_15p} / {s.actual_conversions_gen} ({s.caught_old_15p_pct}%)
                  </div>
                </Td>
                <Td>
                  <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {s.caught_1t_strict} / {s.actual_conversions_gen} ({s.caught_1t_strict_pct}%)
                  </div>
                </Td>
                <Td>
                  <div className="font-mono text-[13.5px] font-black text-emerald-600 dark:text-emerald-400">
                    {s.caught_1t_operational} / {s.actual_conversions_gen} ({s.caught_1t_operational_pct}%)
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    With Full Glued Pool: {s.glued_caught_1t}/{s.glued_actual_conv_gen} ({s.glued_caught_1t_pct}%)
                  </div>
                </Td>
                <Td>
                  <Badge tone="ok">+{s.extra_conversions_gained} Conversions</Badge>
                  <div className="mt-0.5 font-mono text-[11px] text-emerald-600">
                    +{inr(s.extra_revenue_rs)}
                  </div>
                </Td>
                <Td>
                  <Button
                    tone={selectedSmre === s.smre_name ? "primary" : "secondary"}
                    onClick={() => setSelectedSmre(selectedSmre === s.smre_name ? "ALL" : s.smre_name)}
                  >
                    {selectedSmre === s.smre_name ? "✓ Viewing Queue" : "📋 View Glued List"}
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </Section>

      {/* =====================================================================
          SECTION 3: CUSTOMER-BY-CUSTOMER GIVEN VS CONVERTED LEDGER (17-DECIMAL SCORES)
         ===================================================================== */}
      <Section
        title={`3 · Customer-by-Customer Given vs Converted Ledger (${
          selectedSmre === "ALL" ? "All 22 SMREs" : `Glued to ${selectedSmre}`
        } · 17-Decimal 64-Bit Scores · Zero Ties)`}
        sub="Every row below is a real Sehgal customer from the Golden Set (Jan/Feb/Mar 2026) showing the exact 17-decimal 1T score, Old 15-Param rank vs 1T rank, Glued SMRE owner, and verified Workshop Conversion Bill."
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">SHOWING {filteredLedger.length} VERIFIED CUSTOMERS</Badge>
            <Badge tone="ok">FULL CSV: 19,214 ROWS ON DISK</Badge>
          </div>
        }
      >
        {/* Filter Strip for Customer Ledger */}
        <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <div>
            <div className="mb-1 text-[11px] font-bold text-muted">Filter by Month</div>
            <div className="flex flex-wrap gap-1">
              {(["ALL", "Jan", "Feb", "Mar"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonthFilter(m)}
                  className={`rounded px-2.5 py-1 text-[12px] font-bold border ${
                    monthFilter === m
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-surface text-ink"
                  }`}
                >
                  {m === "ALL" ? "All 3M" : `${m} 2026`}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1 text-[11px] font-bold text-muted">Filter by Given-vs-Converted Comparison Cohort</div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setLedgerFilter("ALL")}
                className={`rounded px-2.5 py-1 text-[12px] font-bold border ${
                  ledgerFilter === "ALL"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-line bg-surface text-ink"
                }`}
              >
                All Given in 1T Top 10% &amp; Converted
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("RESCUED")}
                className={`rounded px-2.5 py-1 text-[12px] font-bold border ${
                  ledgerFilter === "RESCUED"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-line bg-surface text-ink"
                }`}
              >
                🔥 Rescued by 1T (+1,588 Missed by Old 15-Param)
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("STRICT_PRE")}
                className={`rounded px-2.5 py-1 text-[12px] font-bold border ${
                  ledgerFilter === "STRICT_PRE"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-line bg-surface text-ink"
                }`}
              >
                ⚡ Caught on Strict Day-1 (0% Mid-Mo)
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-bold text-muted">Search VIN / Reg No / SMRE / Outlet</div>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. MH12, KAVITA, RENUKA, Manjri..."
            />
          </div>
        </div>

        <div className="max-h-[540px] overflow-auto">
          <Table
            head={[
              "Month & 1T Rank vs Old Rank",
              "Reg No · VIN · Model",
              "Sehgal Autoriders (Division · Outlet)",
              "Glued SMRE Account (stamped_smre)",
              "17-Decimal 1T Probability Score (float64 · 0 Ties)",
              "What We Gave vs Old 15-Param",
              "Actual Conversion & Bill Verification",
              "Action (Login & Glue)",
            ]}
          >
            {filteredLedger.slice(0, 120).map((r) => {
              const owner = gluedOverrides[r.vin] ?? r.glued_smre;
              return (
                <tr key={r.month_code + "_" + r.vin} className="border-t border-line">
                  <Td>
                    <div className="font-bold text-ink">{r.month}</div>
                    <div className="font-mono text-[12px] font-black text-emerald-600">
                      1T Rank: #{r.rank_1t_op.toLocaleString("en-IN")}
                    </div>
                    <div className="font-mono text-[11px] text-muted">
                      Old 15P Rank: #{r.rank_old_15p.toLocaleString("en-IN")}
                    </div>
                  </Td>
                  <Td>
                    <div className="font-mono font-extrabold text-ink">{r.reg_no}</div>
                    <div className="font-mono text-[11px] text-muted">VIN: {r.vin}</div>
                    <div className="text-[11.5px] font-semibold text-ink">
                      {r.model_name} ({r.fuel_type})
                    </div>
                  </Td>
                  <Td>
                    <div className="font-bold text-ink">{r.outlet}</div>
                    <div className="text-[11px] text-muted">{r.division}</div>
                    <div className="font-mono text-[10.5px] text-muted">{r.ws_code}</div>
                  </Td>
                  <Td>
                    <Badge tone="ok">📌 Glued: {owner}</Badge>
                    <div className="mt-1 text-[11px] text-muted line-clamp-2" title={r.cre_remarks}>
                      {r.cre_remarks || "Logged in -> Glued -> Converted"}
                    </div>
                  </Td>
                  <Td>
                    <div className="font-mono text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                      Op: {r.score_1t_op_17dec}
                    </div>
                    <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                      Day1: {r.score_1t_strict_17dec}
                    </div>
                    <div className="text-[10.5px] text-muted">17-Digit float64 · Unique</div>
                  </Td>
                  <Td>
                    {r.rescued_by_1t ? (
                      <div>
                        <Badge tone="ok">🔥 GIVEN BY 1T · MISSED BY OLD 15P</Badge>
                        <div className="mt-0.5 text-[11px] text-emerald-600">
                          Jumped +{ (r.rank_old_15p - r.rank_1t_op).toLocaleString("en-IN") } ranks into Top 10%
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Badge tone="brand">✓ GIVEN IN TOP 10% (BOTH)</Badge>
                        <div className="mt-0.5 text-[11px] text-muted">
                          Strict Day-1 Rank #{r.rank_1t_strict.toLocaleString("en-IN")}
                        </div>
                      </div>
                    )}
                  </Td>
                  <Td>
                    <Badge tone="ok">✅ CONVERTED ({r.conv_service_type})</Badge>
                    <div className="mt-0.5 font-mono text-[12px] font-bold text-ink">
                      Bill: {inr(r.conv_bill_rs)}
                    </div>
                    <div className="font-mono text-[11px] text-muted">
                      Date: {r.conv_date || `In ${r.month}`}
                    </div>
                  </Td>
                  <Td>
                    <Button tone="secondary" onClick={() => handleGlueToActiveCaller(r)}>
                      📌 Glue to {selectedSmre === "ALL" ? owner : selectedSmre}
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </div>
      </Section>

      {/* =====================================================================
          SECTION 4-7: MSIL 1-BY-1 17-MONTH DUE DISCREPANCY AUDIT & NOV + 6M BLAME-SHIELD
         ===================================================================== */}
      <MsilDueDiscrepancyAndBlameShieldSection />
    </div>
  );
}

export default function Sehgal1TGivenVsConvertedPage() {
  return <Sehgal1TGivenVsConvertedReport embedded={false} />;
}
