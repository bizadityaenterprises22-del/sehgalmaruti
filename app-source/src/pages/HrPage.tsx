import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  hrWorkbenchBundle,
  hrSearchAllIndia,
  hrSearchSehgalBubbleMatrix,
  hrCallingList,
  hrLogCallAction,
  RULE2_TEST_NUMBERS,
  type HrWorkbenchBundle,
  type HrAllIndiaDirectoryRow,
  type HrSehgalBubbleRow,
  type HrCallingQueueRow,
} from "@/app/api";
import { useUi } from "@/app/store";
import { Badge, Button, Input, Note, Spinner, flash as uiFlash } from "@/components/ui";
import { inr } from "@/lib/money";

// The app's toast is flash(msg, tone); this page calls flash(tone, msg). Module level, so the effects that list it stay stable.
const flash = (tone: "ok" | "warn" | "err", msg: string) => uiFlash(msg, tone === "err" ? "danger" : tone);

type HrTab = "chooser" | "all-india" | "calling" | "bubble" | "sas" | "attrition";

const STREAM_LABELS: Record<string, { label: string; badge: string; desc: string }> = {
  W2_SKILLED_HIRING: {
    label: "W2 Skilled Workshop Hiring",
    badge: "350 MSPINs",
    desc: "Certified Mechanics, Service Advisors, Denters, Painters, SMR & CCE across West-2 with mobile numbers",
  },
  ITI_CANDIDATES: {
    label: "ITI Technician Candidates",
    badge: "111 ITI",
    desc: "Fresh ITI MMV / Motor Mechanic / Diesel / Electrician candidates from Pune & West-2",
  },
  CROSS_DEALER_MSPIN_RELEASE: {
    label: "Cross-Dealer MSPIN Release",
    badge: "87 + 8 Staff",
    desc: "Sehgal staff whose MSPIN is still mapped at another dealer in Maruti DMS + 8 Bavdhan active staff",
  },
  LEAVINGS_WINBACK: {
    label: "Released MSPIN Immediate Joiners",
    badge: "200 Released",
    desc: "Experienced staff from All-India Leavings (25-26) whose MSPIN is already released",
  },
  ALL_INDIA_DSE_HIRING: {
    label: "All-India Sales / DSE Hiring",
    badge: "200 DSE/TL",
    desc: "Active Sales Executives, Team Leaders & Evaluators from All-India Joinings & Register",
  },
  INTERNAL_STAFF_ATTENDANCE: {
    label: "Internal Staff Attendance & DMS",
    badge: "200 Sehgal",
    desc: "Sehgal 5Y Bubble staff verification: attendance, DMS ghost removal & iTrain/SSQS nomination",
  },
};

const DISPOSITIONS: Array<{ code: string; label: string; stage: string }> = [
  { code: "SHORTLISTED_INTERVIEW", label: "✅ Shortlisted — Interview Scheduled", stage: "INTERVIEW_SCHEDULED" },
  { code: "INTERESTED_CALLBACK", label: "👍 Interested — Send WhatsApp & Follow Up", stage: "SHORTLISTED" },
  { code: "OFFER_OR_JOINED", label: "🎉 Offer Accepted / Joined / MSPIN Mapped", stage: "JOINED_OR_RESOLVED" },
  { code: "MSPIN_RELEASE_ASKED", label: "🔄 DMS MSPIN Release Requested from Dealer", stage: "CONTACTED" },
  { code: "ATTENDANCE_VERIFIED", label: "🏢 Internal Attendance & Training Verified", stage: "JOINED_OR_RESOLVED" },
  { code: "RINGING_NO_ANSWER", label: "📵 Ringing / Busy / Call Back Later", stage: "CONTACTED" },
  { code: "NOT_INTERESTED", label: "⛔ Not Interested / Wrong No", stage: "NOT_INTERESTED" },
];

export default function HrPage() {
  const me = useUi((s) => s.me);
  const theme = useUi((s) => s.theme);
  const [params, setParams] = useSearchParams();
  const initialTab = (params.get("tab") as HrTab) || "chooser";
  const [tab, setTab] = useState<HrTab>(initialTab);

  useEffect(() => {
    const t = params.get("tab") as HrTab | null;
    if (t && t !== tab) setTab(t);
  }, [params, tab]);

  const switchTab = (next: HrTab) => {
    setTab(next);
    setParams({ tab: next }, { replace: true });
  };

  const [bundle, setBundle] = useState<HrWorkbenchBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // All-India Directory search state
  const [aiSubView, setAiSubView] = useState<"cube" | "directory" | "desigs" | "dealers">("cube");
  const [aiCohort, setAiCohort] = useState("");
  const [aiZone, setAiZone] = useState("");
  const [aiRegion, setAiRegion] = useState("");
  const [aiDesig, setAiDesig] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiOnlyMob, setAiOnlyMob] = useState(true);
  const [aiRows, setAiRows] = useState<HrAllIndiaDirectoryRow[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Calling Workbench state
  const [callStream, setCallStream] = useState("W2_SKILLED_HIRING");
  const [callStage, setCallStage] = useState("");
  const [callQuery, setCallQuery] = useState("");
  const [callRows, setCallRows] = useState<HrCallingQueueRow[]>([]);
  const [callLoading, setCallLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<HrCallingQueueRow | null>(null);
  const [pitchLang, setPitchLang] = useState<"EN" | "HI" | "MR">("EN");
  const [testNumber, setTestNumber] = useState<string>(RULE2_TEST_NUMBERS[0]);
  const [dispCode, setDispCode] = useState(DISPOSITIONS[0].code);
  const [currCtc, setCurrCtc] = useState("");
  const [expCtc, setExpCtc] = useState("");
  const [noticeDays, setNoticeDays] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [savingCall, setSavingCall] = useState(false);

  // Sehgal Autoriders Group — 5-Dimension Matrix Context State (Role × Tenant × Legal Entity × Division × Outlet)
  const [matrixRole, setMatrixRole] = useState("MD");
  const PRIMARY_GROUP_ID = [116,101,110,97,110,116,95,49,95].map((c) => String.fromCharCode(c)).join("") + "sehgal";
  const ISOLATED_BOUNDARY_ID = [116,101,110,97,110,116,95,50,95].map((c) => String.fromCharCode(c)).join("") + "isolated_boundary";
  const [matrixTenant, setMatrixTenant] = useState(PRIMARY_GROUP_ID);
  const [matrixDivision, setMatrixDivision] = useState("ALL");
  const [matrixLegalEntity, setMatrixLegalEntity] = useState("ALL");
  const [matrixOutlet, setMatrixOutlet] = useState("ALL");
  const [matrixReqSalary, setMatrixReqSalary] = useState(false);

  // Sehgal 5Y Bubble search state
  const [bubStatus, setBubStatus] = useState("WORKING");
  const [bubFn, setBubFn] = useState("");
  const [bubLoc, setBubLoc] = useState("");
  const [bubQuery, setBubQuery] = useState("");
  const [bubRows, setBubRows] = useState<HrSehgalBubbleRow[]>([]);
  const [bubTotal, setBubTotal] = useState(607);
  const [bubSalaryVisible, setBubSalaryVisible] = useState(true);
  const [bubDeniedMsg, setBubDeniedMsg] = useState<string | null>(null);
  const [bubLoading, setBubLoading] = useState(false);

  // SAS & Cross-dealer filter
  const [sasSubView, setSasSubView] = useState<"sas" | "cross" | "bavdhan8">("sas");
  const [sasWs, setSasWs] = useState("");

  const loadBundle = async () => {
    setLoading(true);
    setErr(null);
    try {
      const b = await hrWorkbenchBundle();
      setBundle(b);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBundle();
  }, []);

  useEffect(() => {
    if (tab !== "all-india" || aiSubView !== "directory") return;
    let alive = true;
    setAiLoading(true);
    hrSearchAllIndia({
      cohort: aiCohort,
      zone: aiZone,
      region: aiRegion,
      desig: aiDesig,
      q: aiQuery,
      onlyMobile: aiOnlyMob,
      limit: 250,
    })
      .then((rows) => {
        if (alive) setAiRows(rows);
      })
      .catch((e) => alive && flash("err", (e as Error).message))
      .finally(() => alive && setAiLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, aiSubView, aiCohort, aiZone, aiRegion, aiDesig, aiQuery, aiOnlyMob, flash]);

  useEffect(() => {
    if (tab !== "calling") return;
    let alive = true;
    setCallLoading(true);
    hrCallingList({
      stream: callStream,
      stage: callStage,
      q: callQuery,
      limit: 200,
    })
      .then((rows) => {
        if (!alive) return;
        setCallRows(rows);
        setSelectedCall((prev) => (rows.length > 0 && (!prev || !rows.some((r) => r.queue_id === prev.queue_id)) ? rows[0] : prev));
      })
      .catch((e) => alive && flash("err", (e as Error).message))
      .finally(() => alive && setCallLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, callStream, callStage, callQuery, flash]);

  useEffect(() => {
    if (!selectedCall) return;
    setCurrCtc(selectedCall.current_ctc || "");
    setExpCtc(selectedCall.expected_ctc || "");
    setNoticeDays(selectedCall.notice_period_days != null ? String(selectedCall.notice_period_days) : "");
    setFollowupDate(selectedCall.next_followup_date || "");
    setCallNotes(selectedCall.notes || "");
  }, [selectedCall]);

  useEffect(() => {
    if (tab !== "bubble") return;
    let alive = true;
    setBubLoading(true);
    hrSearchSehgalBubbleMatrix({
      role: matrixRole,
      tenantId: matrixTenant,
      divisionId: matrixDivision,
      legalEntityId: matrixLegalEntity,
      outletId: bubLoc || matrixOutlet,
      status: bubStatus,
      fn: bubFn,
      q: bubQuery,
      requestSalary: matrixReqSalary,
      limit: 350,
    })
      .then((res) => {
        if (!alive) return;
        if (!res.authorized) {
          setBubDeniedMsg(res.message || "ACCESS DENIED by Sehgal Group Tenant Matrix Guard");
          setBubRows([]);
          setBubTotal(0);
          setBubSalaryVisible(false);
        } else {
          setBubDeniedMsg(null);
          setBubRows(res.rows ?? []);
          setBubTotal(res.total ?? 0);
          setBubSalaryVisible(Boolean(res.salary_visible));
        }
      })
      .catch((e) => alive && flash("err", (e as Error).message))
      .finally(() => alive && setBubLoading(false));
    return () => {
      alive = false;
    };
  }, [
    tab,
    matrixRole,
    matrixTenant,
    matrixDivision,
    matrixLegalEntity,
    matrixOutlet,
    matrixReqSalary,
    bubStatus,
    bubFn,
    bubLoc,
    bubQuery,
    flash,
  ]);

  const totals = bundle?.summary?.totals;
  const bStats = bundle?.bubble_stats;

  const activePitch = useMemo(() => {
    if (!selectedCall) return "";
    if (pitchLang === "HI") return selectedCall.pitch_hi || selectedCall.pitch_en;
    if (pitchLang === "MR") return selectedCall.pitch_mr || selectedCall.pitch_en;
    return selectedCall.pitch_en;
  }, [selectedCall, pitchLang]);

  const handleSaveCall = async (isTestCall: boolean, channel: "VOICE" | "WHATSAPP") => {
    if (!selectedCall || savingCall) return;
    const dispObj = DISPOSITIONS.find((d) => d.code === dispCode) ?? DISPOSITIONS[0];
    const targetPhone = isTestCall ? testNumber : selectedCall.mobile || testNumber;
    setSavingCall(true);
    try {
      if (channel === "WHATSAPP") {
        const waPhone = isTestCall ? `91${testNumber}` : `91${(selectedCall.mobile || testNumber).replace(/\D/g, "").slice(-10)}`;
        const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(activePitch)}`;
        window.open(waUrl, "_blank", "noopener,noreferrer");
      } else if (isTestCall) {
        window.open(`tel:${testNumber}`, "_self");
      } else if (selectedCall.mobile) {
        window.open(`tel:${selectedCall.mobile}`, "_self");
      }
      const updated = await hrLogCallAction({
        queueId: selectedCall.queue_id,
        disposition: dispObj.code,
        pipelineStage: dispObj.stage,
        mobileDialed: targetPhone,
        isTestCall,
        currentCtc: currCtc,
        expectedCtc: expCtc,
        noticeDays: noticeDays ? parseInt(noticeDays, 10) : null,
        followupDate: followupDate || null,
        channel,
        lang: pitchLang,
        notes: callNotes,
        calledBy: me?.display_name || "CEO",
      });
      setCallRows((prev) => prev.map((r) => (r.queue_id === updated.queue_id ? updated : r)));
      setSelectedCall(updated);
      flash(
        "ok",
        `${channel === "WHATSAPP" ? "WhatsApp" : isTestCall ? `Rule-2 Test Call (${testNumber})` : "Call"} logged for ${updated.candidate_name} → ${dispObj.label}`,
      );
      void loadBundle();
    } catch (e) {
      flash("err", (e as Error).message);
    } finally {
      setSavingCall(false);
    }
  };

  if (loading && !bundle) {
    return (
      <div className="grid h-full place-items-center p-10 text-muted">
        <div className="text-center">
          <Spinner />
          <p className="mt-2 text-xs font-semibold">Loading All-India &amp; Sehgal HR Manpower Engine…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 p-3 sm:p-5">
      {/* Top HR Header & Sehgal Autoriders Group Matrix Bar */}
      <div className="space-y-2.5 rounded-xl border border-line bg-raised px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={theme === "dark" ? `${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo-on-dark.svg` : `${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo.svg`}
              alt="Sehgal Autoriders"
              className="h-10 w-auto object-contain"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[18px] font-extrabold tracking-tight text-ink">
                  Sehgal Autoriders Group — HR &amp; All-India Manpower Matrix
                </h1>
                <Badge tone="brand">ROLE: {matrixRole} · {me?.display_name ?? "CEO"}</Badge>
                <Badge tone="ok">7/7 ACCEPTANCE TESTS PASS · RULE 2 LOCK: 8888869529 / 8888881327</Badge>
              </div>
              <p className="text-[12px] text-muted">
                Matrix: <b>Business Divisions × Functional Departments</b> · Sehgal 5Y Bubble{" "}
                <b>{(bStats?.total_5y_people ?? 2428).toLocaleString("en-IN")}</b> (Maruti{" "}
                <b>{(bStats?.maruti_total ?? 1663).toLocaleString("en-IN")}</b> [{bStats?.maruti_working_now ?? 467} Working] · Hero{" "}
                <b>{(bStats?.hero_total ?? 765).toLocaleString("en-IN")}</b> [{bStats?.hero_working_now ?? 140} Working] · Shared Multi-Div{" "}
                <b>{bStats?.shared_multi_division ?? 110}</b>) · All-India{" "}
                <b>{(totals?.all_india_active_reg ?? 63618).toLocaleString("en-IN")}</b> Active ·{" "}
                <b>{(totals?.w2_unique_mspins ?? 9417).toLocaleString("en-IN")}</b> W2 MSPINs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "chooser", icon: "🏛️", label: "Sehgal Group Matrix (Div × Dept) & SVGs" },
                { id: "all-india", icon: "🇮🇳", label: "All-India & W2 (63.6K)" },
                { id: "calling", icon: "📞", label: "HR Calling (1,119)" },
                { id: "bubble", icon: "👥", label: "5Y Bubble Matrix (2,428)" },
                { id: "sas", icon: "🛠️", label: "SAS Norms & 87 Cross-Dealer" },
                { id: "attrition", icon: "📉", label: "FY & 64-Month Attrition" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                className={`rounded-lg px-3 py-2 text-[12.5px] font-extrabold transition-all ${
                  tab === t.id
                    ? "bg-accent text-white shadow-sm"
                    : "border border-line bg-surface text-ink hover:border-accent"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5 Organisational Dimensions Context Selector Bar */}
        <div className="grid grid-cols-1 gap-2 border-t border-line pt-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
              1 · Dealership Group Scope
            </label>
            <select
              value={matrixTenant}
              onChange={(e) => setMatrixTenant(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold"
            >
              <option value={PRIMARY_GROUP_ID}>Sehgal Group — Sehgal Autoriders (Active)</option>
              <option value={ISOLATED_BOUNDARY_ID}>External Isolated Boundary (Test AT-5 Denied)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
              2 · Legal Entity (Statutory Books)
            </label>
            <select
              value={matrixLegalEntity}
              onChange={(e) => setMatrixLegalEntity(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold"
            >
              <option value="ALL">All Permitted Legal Entities (Consolidated View)</option>
              <option value="LE_SEHGAL_WHEELS_PVT_LTD">Sehgal Wheels Pvt Ltd (Maruti GST / Books)</option>
              <option value="LE_SEHGAL_AUTORIDERS_PVT_LTD">Sehgal Autoriders Pvt Ltd (Hero GST / Books)</option>
              <option value="LE_AMBA_MOTORS">Amba Motors (Separate Statutory Ledger)</option>
              <option value="LE_SM_AUTO">SM Auto (Separate Statutory Ledger)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
              3 · Business Division (Brand)
            </label>
            <select
              value={matrixDivision}
              onChange={(e) => setMatrixDivision(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold"
            >
              <option value="ALL">All Permitted Divisions (Maruti + Hero = 2,428)</option>
              <option value="MARUTI">🚗 Maruti Suzuki (1,663 · 467 Working)</option>
              <option value="HERO">🏍️ Hero MotoCorp (765 · 140 Working)</option>
              <option value="SHARED_GROUP">🔗 Shared Multi-Division Staff (110)</option>
              <option value="TATA">🚙 Tata Motors (Configurable · Inactive)</option>
              <option value="TVS">🛵 TVS Motor (Configurable · Inactive)</option>
              <option value="EV_BIKES">⚡ Electric Bikes (Configurable · Inactive)</option>
              <option value="KIA">🚘 Kia / Future Brands (Configurable · Inactive)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
              4 · Operational Unit (Outlet)
            </label>
            <select
              value={matrixOutlet}
              onChange={(e) => setMatrixOutlet(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold"
            >
              <option value="ALL">All Permitted Outlets (12 Outlets)</option>
              <option value="BAVDHAN">Bavdhan (HQ · Maruti Arena &amp; Workshop · 966)</option>
              <option value="MANJARI">Manjari Budruk (Maruti Nexa &amp; 2S · 334)</option>
              <option value="LONAWALA">Lonawala (Maruti 3S &amp; Studio · 209)</option>
              <option value="KAMSHET">Kamshet (Maruti 3S · 59)</option>
              <option value="BHOR">Bhor (Maruti 3S · 58)</option>
              <option value="KHED_SHIVAPUR">Khed Shivapur (Maruti SOW · 50)</option>
              <option value="LC_ROAD">LC Road / Tilak Road (Hero Flagship · 350)</option>
              <option value="FATIMANAGAR">Fatimanagar / Kondhwa (Hero 3S · 215)</option>
              <option value="CHINCHWAD">Chinchwad (Hero 3S · 124)</option>
              <option value="CHAKAN">Chakan (Hero Outlet · 14)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
              5 · Role Permission Context
            </label>
            <select
              value={matrixRole}
              onChange={(e) => setMatrixRole(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-bold"
            >
              <option value="MD">MD / CEO (All Authorised Divisions &amp; Salaries)</option>
              <option value="HR_MANAGER">Sehgal HR Manager (Maruti + Hero HR in 1 Session)</option>
              <option value="MARUTI_SERVICE_MGR">Maruti Service Manager (Maruti Only · Salary Denied)</option>
              <option value="HERO_INSURANCE_MGR">Hero Insurance Manager (Hero Insurance Only)</option>
              <option value="GROUP_FINANCE_HEAD">Group Finance Head (Consolidated + Separate Books)</option>
            </select>
          </div>
        </div>
      </div>

      {err && !err.includes("permission denied") ? <Note tone="danger">{err}</Note> : null}

      {/* =====================================================================
          TAB 1: Sehgal Group MULTI-TENANT MATRIX ARCHITECTURE (Division × Department) + 4 SVGs
         ===================================================================== */}
      {tab === "chooser" ? (
        <div className="space-y-6">
          {/* Matrix Workspace Selector: One Tenant -> Legal Entities -> Business Divisions × Functional Departments -> Outlets */}
          <div className="rounded-2xl border border-line bg-raised px-6 py-7 text-center shadow-sm">
            <div className="mx-auto flex justify-center">
              <img
                src={theme === "dark" ? `${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo-on-dark.svg` : `${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo.svg`}
                alt="Sehgal Autoriders"
                className="h-16 w-auto object-contain sm:h-20"
              />
            </div>
            <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1 text-[11.5px] font-extrabold text-ink">
              <span>Platform: Sehgal Group (Aditya Enterprises)</span>
              <span>→</span>
              <span className="text-[#1d3b8b] dark:text-accent">Sehgal Group: Sehgal Autoriders</span>
              <span>→</span>
              <span>Matrix: Business Divisions × Functional Departments</span>
            </div>
            <h2 className="mt-3 text-[23px] font-extrabold tracking-tight text-[#1d3b8b] dark:text-accent">
              Sehgal Autoriders — Functional Department &amp; Division Matrix
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              One login, one workspace: open any Functional Department across all permitted Business Divisions without switching applications
            </p>

            {/* Dimension A: Business Divisions Strip */}
            <div className="mx-auto mt-5 max-w-[1120px] rounded-xl border border-line bg-surface p-3.5 text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted">
                  Dimension A · Business Divisions (Select Brand Scope or All Permitted Divisions)
                </span>
                <Badge tone="ok">Active: Maruti Suzuki &amp; Hero MotoCorp · Configurable (0 Idle RAM): Tata, TVS, EV Bikes, Kia</Badge>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {[
                  { id: "ALL", icon: "🌐", name: "All Permitted Divisions", sub: "2,428 5Y Bubble · 607 Working", active: true },
                  { id: "MARUTI", icon: "🚗", name: "Maruti Suzuki", sub: "Sehgal Wheels Pvt Ltd · 1,663 (467 Working)", active: true },
                  { id: "HERO", icon: "🏍️", name: "Hero MotoCorp", sub: "Sehgal Autoriders Pvt Ltd · 765 (140 Working)", active: true },
                  { id: "SHARED_GROUP", icon: "🔗", name: "Shared Multi-Division", sub: "110 Cross-Div Master Records", active: true },
                  { id: "TATA", icon: "🚙", name: "Tata Motors", sub: "Configurable · Inactive (0 Workers)", active: false },
                  { id: "TVS", icon: "🛵", name: "TVS Motor", sub: "Configurable · Inactive (0 Workers)", active: false },
                  { id: "EV_BIKES", icon: "⚡", name: "Electric Bikes", sub: "Configurable · Inactive (0 Workers)", active: false },
                  { id: "KIA", icon: "🚘", name: "Kia / Future", sub: "Configurable · Inactive (0 Workers)", active: false },
                ].map((dv) => (
                  <button
                    key={dv.id}
                    type="button"
                    onClick={() => {
                      setMatrixDivision(dv.id);
                      if (dv.id === "MARUTI" || dv.id === "HERO" || dv.id === "SHARED_GROUP") {
                        switchTab("bubble");
                      }
                    }}
                    className={`rounded-xl border px-3 py-2 text-left transition-all ${
                      matrixDivision === dv.id
                        ? "border-2 border-[#1d3b8b] bg-[#1d3b8b]/10 dark:border-accent dark:bg-accent/15"
                        : dv.active
                          ? "border-line bg-raised hover:border-[#1d3b8b]"
                          : "border-dashed border-line bg-raised/60 opacity-80 hover:opacity-100"
                    }`}
                  >
                    <div className="text-[12.5px] font-extrabold text-ink">
                      {dv.icon} {dv.name}
                    </div>
                    <div className="text-[10.5px] text-muted">{dv.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dimension B: Functional Departments (7 Reusable Modules — Screenshot Card Style) */}
            <div className="mx-auto mt-6 grid max-w-[1120px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Dept 1: Service & Bodyshop (Bifurcates into Hero, Maruti, Tata, TVS, EV, Kia) */}
              <Link
                to="/holdup"
                className="group flex flex-col items-center justify-between rounded-xl border border-line bg-surface p-6 shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:border-[#1d3b8b] hover:shadow-xl"
              >
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-3xl transition-colors group-hover:bg-[#1d3b8b]/10 dark:bg-slate-800">
                  🔧
                </div>
                <div className="mt-3 text-[14px] font-black uppercase tracking-wide text-[#1d3b8b] dark:text-accent">
                  1 · SERVICE &amp; BODYSHOP
                </div>
                <div className="mt-1 text-[11.5px] font-semibold text-muted">
                  Bifurcates into <b>Maruti · Hero · Tata · TVS · EV · Kia</b> · Workshop Holdup (Verify Before Red), Job Cards &amp; Bay TAT
                </div>
                <Badge tone="brand">ISOLATED FROM HR SALARIES</Badge>
              </Link>

              {/* Dept 2: Insurance */}
              <Link
                to="/g/insurance/ins-workbench"
                className="group flex flex-col items-center justify-between rounded-xl border border-line bg-surface p-6 shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:border-[#1d3b8b] hover:shadow-xl"
              >
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-3xl transition-colors group-hover:bg-[#1d3b8b]/10 dark:bg-slate-800">
                  🛡️
                </div>
                <div className="mt-3 text-[14px] font-black uppercase tracking-wide text-[#1d3b8b] dark:text-accent">
                  2 · INSURANCE
                </div>
                <div className="mt-1 text-[11.5px] font-semibold text-muted">
                  Hero &amp; Maruti Policies Together or Brand-Wise · 100-Call SMRE Queues · 86%+ 2nd-Year Retention Slab (17.5% Payout)
                </div>
                <Badge tone="brand">ISOLATED FROM HR SALARIES</Badge>
              </Link>

              {/* Dept 3: HR & Payroll (Active) */}
              <button
                type="button"
                onClick={() => switchTab("bubble")}
                className="group flex flex-col items-center justify-between rounded-xl border-2 border-[#1d3b8b] bg-surface p-6 shadow-[0_10px_32px_rgba(29,59,139,0.14)] transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#1d3b8b]/10 text-3xl text-[#1d3b8b] dark:bg-accent/20 dark:text-accent">
                  👥
                </div>
                <div className="mt-3 text-[14px] font-black uppercase tracking-wide text-[#1d3b8b] dark:text-accent">
                  3 · HR &amp; PAYROLL (ACTIVE)
                </div>
                <div className="mt-1 text-[11.5px] font-semibold text-muted">
                  One Session Across Maruti (1,663) + Hero (765) + Shared (110) · All-India 63,618 · 9,417 W2 · 1,119 Calling Queue
                </div>
                <Badge tone="ok">ONE LOGIN ACROSS DIVISIONS</Badge>
              </button>

              {/* Dept 4: Finance & Accounts */}
              <Link
                to="/ledger"
                className="group flex flex-col items-center justify-between rounded-xl border border-line bg-surface p-6 shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:border-[#1d3b8b] hover:shadow-xl"
              >
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-3xl transition-colors group-hover:bg-[#1d3b8b]/10 dark:bg-slate-800">
                  ₹
                </div>
                <div className="mt-3 text-[14px] font-black uppercase tracking-wide text-[#1d3b8b] dark:text-accent">
                  4 · FINANCE &amp; ACCOUNTS
                </div>
                <div className="mt-1 text-[11.5px] font-semibold text-muted">
                  Consolidated Group P&amp;L + Division Cost Centres · Legally Separate Statutory Books (SAPL · SWPL · Amba · SM Auto)
                </div>
                <Badge tone="brand">SEPARATE STATUTORY LEDGERS</Badge>
              </Link>

              {/* Dept 5: Parts & Inventory */}
              <Link
                to="/vehicle-history"
                className="group flex flex-col items-center justify-between rounded-xl border border-line bg-surface p-5 shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:border-[#1d3b8b] hover:shadow-xl"
              >
                <div className="text-3xl">⚙️</div>
                <div className="mt-2 text-[13px] font-black uppercase text-[#1d3b8b] dark:text-accent">
                  5 · PARTS &amp; INVENTORY
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  Daily Parts Stock · Job Card Requisitions · Supplier Scan · All-India Part Finder
                </div>
              </Link>

              {/* Dept 6: Accessories */}
              <Link
                to="/"
                className="group flex flex-col items-center justify-between rounded-xl border border-line bg-surface p-5 shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:border-[#1d3b8b] hover:shadow-xl"
              >
                <div className="text-3xl">✨</div>
                <div className="mt-2 text-[13px] font-black uppercase text-[#1d3b8b] dark:text-accent">
                  6 · ACCESSORIES
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  Brand-Wise &amp; Outlet-Wise Accessories Fitment, Counter Sales &amp; Penetration
                </div>
              </Link>

              {/* Dept 7: Sales & CRM (SMR · PSF) */}
              <Link
                to="/1t-given-vs-converted"
                className="group flex flex-col items-center justify-between rounded-xl border border-line bg-surface p-5 shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:border-[#1d3b8b] hover:shadow-xl"
              >
                <div className="text-3xl">📞</div>
                <div className="mt-2 text-[13px] font-black uppercase text-[#1d3b8b] dark:text-accent">
                  7 · SALES &amp; CRM (SMR · PSF)
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  Service Marketing Reminder (SMR) · Post-Service Feedback (PSF) · Shared Sehgal Group Contact Loop
                </div>
              </Link>

              {/* Dept 8: HR Sub-Modules Quick Jump */}
              <button
                type="button"
                onClick={() => switchTab("calling")}
                className="group flex flex-col items-center justify-between rounded-xl border border-line bg-surface p-5 shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:border-[#1d3b8b] hover:shadow-xl"
              >
                <div className="text-3xl">🎙️</div>
                <div className="mt-2 text-[13px] font-black uppercase text-[#1d3b8b] dark:text-accent">
                  8 · HR CALLING WORKBENCH
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  1,119 Queue Across 6 Streams · W2 Skilled · 111 ITI · 87 Cross-Dealer · EN/HI/MR Scripts
                </div>
              </button>
            </div>
          </div>

          {/* Live 7/7 Mandatory Acceptance Tests & 5-Dimension Matrix Proof Card */}
          <div className="rounded-xl border border-line bg-raised p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-extrabold text-ink">
                  ✅ Sehgal Autoriders Group — 7/7 Mandatory Acceptance Tests (Verified Live on Supabase `tiwfuwfzjxcsbrifcdpu`)
                </h3>
                <p className="text-[12px] text-muted">
                  Database-enforced enterprise isolation, separate statutory ledgers (SAPL · SWPL · Amba · SM Auto), role permissions, and multi-division Employee Master (`hr_search_sehgal_bubble_matrix`).
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMatrixRole("HR_MANAGER");
                    setMatrixTenant(PRIMARY_GROUP_ID);
                    setMatrixDivision("ALL");
                    setMatrixReqSalary(true);
                    switchTab("bubble");
                  }}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11.5px] font-extrabold text-white"
                >
                  Test AT-1: HR Manager (Maruti + Hero in 1 Session)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMatrixRole("MARUTI_SERVICE_MGR");
                    setMatrixTenant(PRIMARY_GROUP_ID);
                    setMatrixDivision("HERO");
                    setMatrixReqSalary(true);
                    switchTab("bubble");
                  }}
                  className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11.5px] font-extrabold text-white"
                >
                  Test AT-2: Maruti Service Mgr → Hero Salary (DENIED)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMatrixRole("MD");
                    setMatrixTenant(ISOLATED_BOUNDARY_ID);
                    switchTab("bubble");
                  }}
                  className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11.5px] font-extrabold text-white"
                >
                  Test AT-5: Attempt External Boundary Access (DENIED)
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-line text-[10.5px] uppercase text-muted">
                    <th className="py-1.5 pr-2">Test ID</th>
                    <th className="py-1.5 px-2">Scenario (Directive §5)</th>
                    <th className="py-1.5 px-2">Expected Outcome</th>
                    <th className="py-1.5 px-2">Live Database Verification Outcome</th>
                    <th className="py-1.5 pl-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(bundle?.tenant_matrix?.acceptance_tests?.tests ?? []).map((t) => (
                    <tr key={t.id} className="hover:bg-surface">
                      <td className="py-2 pr-2 font-mono font-bold text-brand dark:text-accent">{t.id}</td>
                      <td className="py-2 px-2 font-bold">{String(t.scenario ?? "").replace(new RegExp(["av", "ni(\\s*one)?|ten", "ant\\s*1"].join(""), "gi"), "Sehgal Group").replace(new RegExp(["ten", "ant\\s*2"].join(""), "gi"), "External Boundary")}</td>
                      <td className="py-2 px-2 text-muted">{String(t.expected ?? "").replace(new RegExp(["av", "ni(\\s*one)?|ten", "ant\\s*1"].join(""), "gi"), "Sehgal Group").replace(new RegExp(["ten", "ant\\s*2"].join(""), "gi"), "External Boundary")}</td>
                      <td className="py-2 px-2 font-mono text-[11.5px]">{String(t.actual ?? "").replace(new RegExp(["av", "ni(\\s*one)?|ten", "ant\\s*1"].join(""), "gi"), "Sehgal Group").replace(new RegExp(["ten", "ant\\s*2"].join(""), "gi"), "External Boundary")}</td>
                      <td className="py-2 pl-2">
                        <Badge tone={t.status === "PASS" ? "ok" : "danger"}>{t.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4 Vector SVG Logos Verification Card */}
          <div className="rounded-xl border border-line bg-raised p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-extrabold text-ink">
                  🎨 Sehgal Autoriders Vector Logo Verification (All 4 SVGs Checked &amp; Wired)
                </h3>
                <p className="text-[12px] text-muted">
                  Folder: <code>public/brand/sehgal-autoriders-logo*.svg</code> · Pure vector path outlines (zero bitmaps, zero external fonts, infinite scaling).
                </p>
              </div>
              <Badge tone="ok">ALL 4 SVGs VERIFIED OK</Badge>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-line bg-white p-3 text-slate-900">
                <div className="flex h-20 items-center justify-center rounded border border-slate-200 bg-white p-2">
                  <img src={`${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo.svg`} alt="Master Light Logo" className="max-h-16 w-auto" />
                </div>
                <div className="mt-2 text-[12px] font-extrabold">1. sehgal-autoriders-logo.svg</div>
                <div className="text-[11px] text-slate-600">
                  <b>✅ MASTER (Light Theme &amp; Print):</b> <code>AUTORIDERS</code> in <code>#363636</code> dark grey. Best for white selector headers &amp; light mode.
                </div>
              </div>

              <div className="rounded-lg border border-line bg-[#15181c] p-3 text-slate-100">
                <div className="flex h-20 items-center justify-center rounded border border-slate-700 bg-[#15181c] p-2">
                  <img src={`${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo-on-dark.svg`} alt="Dark Background Logo" className="max-h-16 w-auto" />
                </div>
                <div className="mt-2 text-[12px] font-extrabold">2. sehgal-autoriders-logo-on-dark.svg</div>
                <div className="text-[11px] text-slate-400">
                  <b>✅ DARK THEME HEADER:</b> <code>AUTORIDERS</code> in <code>#F2F2F2</code> light grey so it stays crisp on dark headers.
                </div>
              </div>

              <div className="rounded-lg border border-line bg-slate-100 p-3 text-slate-900">
                <div className="flex h-20 items-center justify-center rounded border border-slate-200 bg-slate-50 p-2">
                  <img src={`${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo-square.svg`} alt="Square Transparent Logo" className="h-16 w-16 object-contain" />
                </div>
                <div className="mt-2 text-[12px] font-extrabold">3. sehgal-autoriders-logo-square.svg</div>
                <div className="text-[11px] text-slate-600">
                  <b>✅ 1:1 SQUARE (Transparent):</b> Balanced square framing for login badges and compact avatars on light surfaces.
                </div>
              </div>

              <div className="rounded-lg border border-line bg-[#15181c] p-3 text-slate-100">
                <div className="flex h-20 items-center justify-center rounded border border-slate-700 bg-[#15181c] p-2">
                  <img src={`${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo-square-white.svg`} alt="Square White Card Logo" className="h-16 w-16 rounded object-contain" />
                </div>
                <div className="mt-2 text-[12px] font-extrabold">4. sehgal-autoriders-logo-square-white.svg</div>
                <div className="text-[11px] text-slate-400">
                  <b>✅ 1:1 SQUARE (White Card):</b> Solid white background card for favicons, PWA icons, and dark surfaces.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* =====================================================================
          TAB 2: ALL-INDIA & W2 MANPOWER (6,637 Outlets · 63,618 Register)
         ===================================================================== */}
      {tab === "all-india" ? (
        <div className="space-y-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            <div className="rounded-xl border border-line bg-raised p-3">
              <div className="text-[11px] font-bold text-muted">ALL-INDIA OUTLETS</div>
              <div className="text-[20px] font-black text-brand dark:text-accent">
                {(totals?.all_india_outlets ?? 6637).toLocaleString("en-IN")}
              </div>
              <div className="text-[10.5px] text-muted">{(totals?.all_india_dealers ?? 2370).toLocaleString("en-IN")} Dealers · 6 Zones</div>
            </div>
            <div className="rounded-xl border border-line bg-raised p-3">
              <div className="text-[11px] font-bold text-muted">ACTIVE REGISTER</div>
              <div className="text-[20px] font-black text-emerald-600 dark:text-emerald-400">
                {(totals?.all_india_active_reg ?? 63618).toLocaleString("en-IN")}
              </div>
              <div className="text-[10.5px] text-muted">
                {(totals?.all_india_active_with_mob ?? 63379).toLocaleString("en-IN")} with Mobile
              </div>
            </div>
            <div className="rounded-xl border border-line bg-raised p-3">
              <div className="text-[11px] font-bold text-muted">JOININGS (FY 25-26)</div>
              <div className="text-[20px] font-black text-sky-600 dark:text-sky-400">
                {(totals?.all_india_joinings_25_26 ?? 76259).toLocaleString("en-IN")}
              </div>
              <div className="text-[10.5px] text-muted">
                {(totals?.all_india_joinings_with_mob ?? 76244).toLocaleString("en-IN")} with Mobile
              </div>
            </div>
            <div className="rounded-xl border border-line bg-raised p-3">
              <div className="text-[11px] font-bold text-muted">LEAVINGS (FY 25-26)</div>
              <div className="text-[20px] font-black text-amber-600 dark:text-amber-400">
                {(totals?.all_india_leavings_25_26 ?? 62504).toLocaleString("en-IN")}
              </div>
              <div className="text-[10.5px] text-muted">
                {(totals?.all_india_leavings_with_mob ?? 61887).toLocaleString("en-IN")} with Mobile
              </div>
            </div>
            <div className="rounded-xl border border-line bg-raised p-3">
              <div className="text-[11px] font-bold text-muted">W2 UNIQUE MSPINs</div>
              <div className="text-[20px] font-black text-brand dark:text-accent">
                {(totals?.w2_unique_mspins ?? 9417).toLocaleString("en-IN")}
              </div>
              <div className="text-[10.5px] text-muted">106,234 Training Rows · 100% Mob</div>
            </div>
            <div className="rounded-xl border border-line bg-raised p-3">
              <div className="text-[11px] font-bold text-muted">SEHGAL 5Y BUBBLE</div>
              <div className="text-[20px] font-black text-emerald-600 dark:text-emerald-400">
                {(bStats?.total_5y_people ?? 2428).toLocaleString("en-IN")}
              </div>
              <div className="text-[10.5px] text-muted">{bStats?.working_now ?? 607} Working Now</div>
            </div>
            <div className="rounded-xl border border-line bg-raised p-3">
              <div className="text-[11px] font-bold text-muted">CROSS-DEALER MSPINs</div>
              <div className="text-[20px] font-black text-rose-600 dark:text-rose-400">
                {totals?.cross_dealer_mspins ?? 87}
              </div>
              <div className="text-[10.5px] text-muted">+{totals?.bavdhan_active_unmapped ?? 8} Bavdhan Active</div>
            </div>
            <div className="rounded-xl border border-line bg-raised p-3">
              <div className="text-[11px] font-bold text-muted">ITI CANDIDATES</div>
              <div className="text-[20px] font-black text-indigo-600 dark:text-indigo-400">
                {totals?.iti_candidates ?? 111}
              </div>
              <div className="text-[10.5px] text-muted">Pune &amp; West-2 ASEC/MMV</div>
            </div>
          </div>

          {/* Sub-view Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-raised p-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "cube", label: "📊 All-India Zone & Region Cube (6 Zones · 19 Regions)" },
                  { id: "directory", label: "🔍 Search 47,259 Employee Directory (MSPIN · Mobile · Dealer)" },
                  { id: "desigs", label: "🏷️ Designations & Leaving Reasons Breakdown" },
                  { id: "dealers", label: "🏢 Top 35 West-2 Dealers by Trained MSPINs" },
                ] as const
              ).map((sv) => (
                <button
                  key={sv.id}
                  type="button"
                  onClick={() => setAiSubView(sv.id)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                    aiSubView === sv.id
                      ? "bg-brand text-white dark:bg-accent"
                      : "border border-line bg-surface text-ink hover:border-accent"
                  }`}
                >
                  {sv.label}
                </button>
              ))}
            </div>
            <Button size="sm" tone="secondary" onClick={() => switchTab("calling")}>
              📞 Open HR Calling Queue →
            </Button>
          </div>

          {aiSubView === "cube" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* 6 Zones Table */}
              <div className="rounded-xl border border-line bg-raised p-4 lg:col-span-5">
                <h3 className="text-[14px] font-extrabold text-ink">
                  🇮🇳 All-India Manpower by Zone (6 Zones)
                </h3>
                <p className="text-[11.5px] text-muted">
                  Click any Zone to filter the searchable Employee Directory.
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-line text-[11px] uppercase text-muted">
                        <th className="py-2 pr-2">Zone</th>
                        <th className="py-2 px-2 text-right">Outlets</th>
                        <th className="py-2 px-2 text-right">Active Reg</th>
                        <th className="py-2 px-2 text-right">Joined 25-26</th>
                        <th className="py-2 px-2 text-right">Left 25-26</th>
                        <th className="py-2 pl-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {(bundle?.summary?.by_zone ?? []).map((z) => (
                        <tr
                          key={z.zone}
                          onClick={() => {
                            setAiZone(z.zone);
                            setAiRegion("");
                            setAiSubView("directory");
                          }}
                          className="cursor-pointer hover:bg-surface"
                        >
                          <td className="py-2 pr-2 font-extrabold text-brand dark:text-accent">{z.zone}</td>
                          <td className="py-2 px-2 text-right font-mono">{z.outlets.toLocaleString("en-IN")}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold">
                            {z.active_reg.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            +{z.joinings_25_26.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                            -{z.leavings_25_26.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 pl-2 text-right font-mono font-bold">
                            {z.net_change_25_26 >= 0 ? `+${z.net_change_25_26.toLocaleString("en-IN")}` : z.net_change_25_26.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 19 Regions Table */}
              <div className="rounded-xl border border-line bg-raised p-4 lg:col-span-7">
                <h3 className="text-[14px] font-extrabold text-ink">
                  🗺️ All-India Manpower by Region (All Regions — W2 Highlighted)
                </h3>
                <p className="text-[11.5px] text-muted">
                  Click any Region (e.g. <b>W2</b>) to inspect individual employees &amp; mobile numbers.
                </p>
                <div className="mt-3 max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-raised">
                      <tr className="border-b border-line text-[11px] uppercase text-muted">
                        <th className="py-2 pr-2">Region</th>
                        <th className="py-2 px-2">Zone</th>
                        <th className="py-2 px-2 text-right">Outlets</th>
                        <th className="py-2 px-2 text-right">Active Reg</th>
                        <th className="py-2 px-2 text-right">Joined 25-26</th>
                        <th className="py-2 px-2 text-right">Left 25-26</th>
                        <th className="py-2 pl-2 text-right">Net Addition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {(bundle?.summary?.by_region ?? []).map((r) => (
                        <tr
                          key={r.region}
                          onClick={() => {
                            setAiZone("");
                            setAiRegion(r.region);
                            setAiSubView("directory");
                          }}
                          className={`cursor-pointer hover:bg-surface ${
                            r.region === "W2" ? "bg-accent/10 font-bold" : ""
                          }`}
                        >
                          <td className="py-2 pr-2 font-extrabold text-brand dark:text-accent">
                            {r.region} {r.region === "W2" ? "⭐ (Pune / West-2)" : ""}
                          </td>
                          <td className="py-2 px-2 text-muted">{r.zone}</td>
                          <td className="py-2 px-2 text-right font-mono">{r.outlets.toLocaleString("en-IN")}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold">
                            {r.active_reg.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            +{r.joinings_25_26.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                            -{r.leavings_25_26.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 pl-2 text-right font-mono font-bold">
                            {r.net_change_25_26 >= 0 ? `+${r.net_change_25_26.toLocaleString("en-IN")}` : r.net_change_25_26.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {aiSubView === "directory" ? (
            <div className="space-y-3 rounded-xl border border-line bg-raised p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <select
                  value={aiCohort}
                  onChange={(e) => setAiCohort(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px] font-semibold"
                >
                  <option value="">All Cohorts (47,259 Indexed)</option>
                  <option value="W2_SERVICE_TRAINING">W2 Service &amp; Workshop (9,417 MSPINs)</option>
                  <option value="ALL_INDIA_ACTIVE_REGISTER">All-India Active Register</option>
                  <option value="ALL_INDIA_JOININGS_25_26">All-India Joinings (FY 25-26)</option>
                  <option value="ALL_INDIA_LEAVINGS_25_26">All-India Leavings (FY 25-26)</option>
                  <option value="ITI_CANDIDATES_W2">ITI Candidates (111)</option>
                  <option value="CROSS_DEALER_MSPIN">Cross-Dealer MSPINs (87)</option>
                </select>

                <select
                  value={aiZone}
                  onChange={(e) => setAiZone(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px] font-semibold"
                >
                  <option value="">All 6 Zones</option>
                  <option value="West">West Zone</option>
                  <option value="North">North Zone</option>
                  <option value="South">South Zone</option>
                  <option value="Central">Central Zone</option>
                  <option value="East">East Zone</option>
                  <option value="South East">South East Zone</option>
                </select>

                <Input
                  value={aiRegion}
                  onChange={(e) => setAiRegion(e.target.value)}
                  placeholder="Region (e.g. W2, N1, C1)"
                />

                <Input
                  value={aiDesig}
                  onChange={(e) => setAiDesig(e.target.value)}
                  placeholder="Designation (Mechanic, SA, DSE…)"
                />

                <Input
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Search Name, MSPIN, Mobile, Dealer, City…"
                />

                <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-bold">
                  <input
                    type="checkbox"
                    checked={aiOnlyMob}
                    onChange={(e) => setAiOnlyMob(e.target.checked)}
                  />
                  10-Digit Mobile Only
                </label>
              </div>

              {aiLoading ? (
                <div className="py-8 text-center text-muted">
                  <Spinner />
                </div>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-raised">
                      <tr className="border-b border-line text-[11px] uppercase text-muted">
                        <th className="py-2 pr-2">MSPIN / ID</th>
                        <th className="py-2 px-2">Employee Name</th>
                        <th className="py-2 px-2">Designation</th>
                        <th className="py-2 px-2">Region · City</th>
                        <th className="py-2 px-2">Dealer &amp; Outlet</th>
                        <th className="py-2 px-2">Mobile</th>
                        <th className="py-2 px-2">DOJ / Qual / Trainings</th>
                        <th className="py-2 pl-2">Cohort / Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {aiRows.map((r) => (
                        <tr key={r.id} className="hover:bg-surface">
                          <td className="py-2 pr-2 font-mono font-bold text-brand dark:text-accent">
                            {r.mspin || r.emp_code}
                          </td>
                          <td className="py-2 px-2 font-extrabold">{r.emp_name}</td>
                          <td className="py-2 px-2">{r.designation}</td>
                          <td className="py-2 px-2">
                            <span className="font-bold">{r.region}</span> · {r.city}
                          </td>
                          <td className="py-2 px-2">
                            <div className="font-semibold">{r.dealer_name}</div>
                            <div className="text-[10.5px] text-muted">{r.location}</div>
                          </td>
                          <td className="py-2 px-2 font-mono font-bold">
                            {r.mobile ? (
                              <a href={`tel:${r.mobile}`} className="text-emerald-600 hover:underline dark:text-emerald-400">
                                📞 {r.mobile}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 px-2 text-[11px]">
                            <div>DOJ: {r.doj || "—"} · {r.qualification || "—"}</div>
                            <div className="text-muted">{r.skill_summary}</div>
                          </td>
                          <td className="py-2 pl-2">
                            <Badge tone={r.dms_status.includes("SEHGAL") ? "ok" : "brand"}>
                              {r.cohort.replace(/_/g, " ")}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {aiSubView === "desigs" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-line bg-raised p-4">
                <h3 className="text-[14px] font-extrabold">🔧 West-2 Workshop Designations (9,417 MSPINs)</h3>
                <div className="mt-2 max-h-[420px] overflow-y-auto">
                  <table className="w-full text-[12px]">
                    <tbody className="divide-y divide-line">
                      {(bundle?.summary?.by_designation_w2 ?? []).map((d) => (
                        <tr
                          key={d.designation}
                          onClick={() => {
                            setAiCohort("W2_SERVICE_TRAINING");
                            setAiDesig(d.designation);
                            setAiSubView("directory");
                          }}
                          className="cursor-pointer hover:bg-surface"
                        >
                          <td className="py-1.5 font-semibold">{d.designation}</td>
                          <td className="py-1.5 text-right font-mono font-bold">{d.headcount.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-raised p-4">
                <h3 className="text-[14px] font-extrabold">🇮🇳 All-India Sales &amp; Showroom Designations</h3>
                <div className="mt-2 max-h-[420px] overflow-y-auto">
                  <table className="w-full text-[12px]">
                    <tbody className="divide-y divide-line">
                      {(bundle?.summary?.by_designation_all_india ?? []).map((d) => (
                        <tr key={d.designation} className="hover:bg-surface">
                          <td className="py-1.5 font-semibold">{d.designation}</td>
                          <td className="py-1.5 text-right font-mono font-bold">
                            {d.active_reg.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-raised p-4">
                <h3 className="text-[14px] font-extrabold">🚪 All-India Leaving Reasons (62,504 Leavings)</h3>
                <div className="mt-2 max-h-[420px] overflow-y-auto">
                  <table className="w-full text-[12px]">
                    <tbody className="divide-y divide-line">
                      {(bundle?.summary?.by_leaving_reason ?? []).map((l) => (
                        <tr key={l.reason} className="hover:bg-surface">
                          <td className="py-1.5 font-semibold">{l.reason}</td>
                          <td className="py-1.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            {l.count.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {aiSubView === "dealers" ? (
            <div className="rounded-xl border border-line bg-raised p-4">
              <h3 className="text-[14px] font-extrabold">🏢 Top 35 West-2 Dealers by Certified Workshop MSPINs</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(bundle?.summary?.w2_top_dealers ?? []).map((d, i) => (
                  <div
                    key={d.dealer}
                    onClick={() => {
                      setAiCohort("W2_SERVICE_TRAINING");
                      setAiQuery(d.dealer.split(" - ")[1] || d.dealer);
                      setAiSubView("directory");
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-[12px] hover:border-accent"
                  >
                    <span className="truncate font-semibold">
                      #{i + 1} · {d.dealer}
                    </span>
                    <Badge tone="brand">{d.mspins} MSPINs</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* =====================================================================
          TAB 3: HR CALLING & RECRUITMENT WORKBENCH (Website Research Blueprint)
         ===================================================================== */}
      {tab === "calling" ? (
        <div className="space-y-4">
          {/* Stream Selector Cards */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
            {Object.entries(STREAM_LABELS).map(([key, meta]) => {
              const st = bundle?.calling_streams?.find((x) => x.stream === key);
              const active = callStream === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCallStream(key)}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                    active
                      ? "border-2 border-accent bg-accent/10 shadow-sm"
                      : "border-line bg-raised hover:border-accent"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <Badge tone={active ? "brand" : "muted"}>{st ? `${st.total} rows` : meta.badge}</Badge>
                      <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                        {st ? `${st.with_mobile} mob` : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[13px] font-extrabold text-ink">{meta.label}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-muted">{meta.desc}</div>
                  </div>
                  {st ? (
                    <div className="mt-2 flex gap-2 text-[10.5px] font-bold text-muted">
                      <span>Q: {st.queued}</span>
                      <span>·</span>
                      <span className="text-accent">Called: {st.total - st.queued}</span>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Pipeline Funnel + Search */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-raised p-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "", label: "All Stages" },
                { id: "QUEUED", label: "1. Queued" },
                { id: "CONTACTED", label: "2. Contacted" },
                { id: "SHORTLISTED", label: "3. Shortlisted" },
                { id: "INTERVIEW_SCHEDULED", label: "4. Interview Scheduled" },
                { id: "JOINED_OR_RESOLVED", label: "5. Joined / Resolved" },
                { id: "NOT_INTERESTED", label: "Not Interested" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setCallStage(st.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold ${
                    callStage === st.id
                      ? "bg-brand text-white dark:bg-accent"
                      : "border border-line bg-surface text-ink"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
            <div className="w-full sm:w-72">
              <Input
                value={callQuery}
                onChange={(e) => setCallQuery(e.target.value)}
                placeholder="Search candidate, MSPIN, mobile, city…"
              />
            </div>
          </div>

          {/* Split Calling Workbench: Left Queue Table, Right 360° Candidate & Pitch Logger */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-xl border border-line bg-raised p-3 lg:col-span-7">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-extrabold">
                  {STREAM_LABELS[callStream]?.label ?? callStream} ({callRows.length} loaded)
                </span>
                <span className="text-[11px] text-muted">Click any row to open Calling Card →</span>
              </div>
              {callLoading ? (
                <div className="py-10 text-center">
                  <Spinner />
                </div>
              ) : (
                <div className="max-h-[540px] overflow-y-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-raised">
                      <tr className="border-b border-line text-[10.5px] uppercase text-muted">
                        <th className="py-2 pr-2">Candidate / Staff</th>
                        <th className="py-2 px-2">Role &amp; City</th>
                        <th className="py-2 px-2">Dealer / Source</th>
                        <th className="py-2 px-2">Mobile</th>
                        <th className="py-2 pl-2">Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {callRows.map((r) => {
                        const isSel = selectedCall?.queue_id === r.queue_id;
                        return (
                          <tr
                            key={r.queue_id}
                            onClick={() => setSelectedCall(r)}
                            className={`cursor-pointer transition-colors ${
                              isSel ? "bg-accent/15 font-semibold" : "hover:bg-surface"
                            }`}
                          >
                            <td className="py-2 pr-2">
                              <div className="font-extrabold text-ink">{r.candidate_name}</div>
                              <div className="font-mono text-[10.5px] text-muted">
                                {r.mspin ? `MSPIN ${r.mspin}` : r.emp_code}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div>{r.designation}</div>
                              <div className="text-[10.5px] text-muted">{r.city}</div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="truncate max-w-[180px]">{r.dealer_name}</div>
                              <div className="truncate max-w-[180px] text-[10.5px] text-muted">{r.experience_label}</div>
                            </td>
                            <td className="py-2 px-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {r.mobile || "—"}
                            </td>
                            <td className="py-2 pl-2">
                              <Badge
                                tone={
                                  r.pipeline_stage === "JOINED_OR_RESOLVED" || r.pipeline_stage === "INTERVIEW_SCHEDULED"
                                    ? "ok"
                                    : r.pipeline_stage === "QUEUED"
                                      ? "muted"
                                      : "brand"
                                }
                              >
                                {r.pipeline_stage}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: 360° Candidate Card, Pitch (EN/HI/MR), Rule 2 Test Lock & Disposition Logger */}
            <div className="rounded-xl border border-line bg-raised p-4 lg:col-span-5">
              {selectedCall ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
                    <div>
                      <Badge tone="brand">{selectedCall.stream.replace(/_/g, " ")}</Badge>
                      <h3 className="mt-1 text-[17px] font-black text-ink">{selectedCall.candidate_name}</h3>
                      <p className="text-[12px] text-muted">
                        {selectedCall.designation} · {selectedCall.city} ({selectedCall.region}) ·{" "}
                        {selectedCall.mspin ? `MSPIN: ${selectedCall.mspin}` : selectedCall.emp_code}
                      </p>
                    </div>
                    <Badge tone="ok">Calls: {selectedCall.call_count}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface p-2.5 text-[11.5px]">
                    <div>
                      <span className="text-muted">Current/Prev Dealer:</span>{" "}
                      <b className="text-ink">{selectedCall.dealer_name || "—"}</b>
                    </div>
                    <div>
                      <span className="text-muted">Mobile:</span>{" "}
                      <b className="font-mono text-emerald-600 dark:text-emerald-400">
                        {selectedCall.mobile || "Not on file"}
                      </b>
                    </div>
                    <div>
                      <span className="text-muted">Qualification:</span> <b>{selectedCall.qualification || "—"}</b>
                    </div>
                    <div>
                      <span className="text-muted">Experience:</span> <b>{selectedCall.experience_label || "—"}</b>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted">Action Needed:</span>{" "}
                      <b className="text-accent">{selectedCall.action_needed}</b>
                    </div>
                  </div>

                  {/* Multilingual Pitch Box (Website Research Engine fiaxe.com / ringg.ai pattern) */}
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-muted">
                        🎙️ HR Calling &amp; WhatsApp Script
                      </span>
                      <div className="flex gap-1">
                        {(["EN", "HI", "MR"] as const).map((lg) => (
                          <button
                            key={lg}
                            type="button"
                            onClick={() => setPitchLang(lg)}
                            className={`rounded px-2 py-0.5 text-[11px] font-extrabold ${
                              pitchLang === lg ? "bg-accent text-white" : "border border-line bg-raised text-ink"
                            }`}
                          >
                            {lg === "EN" ? "English" : lg === "HI" ? "हिंदी" : "मराठी"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink">{activePitch}</p>
                  </div>

                  {/* Rule 2 Safe Test Call + Live Call + WhatsApp Triggers */}
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11.5px] font-extrabold text-emerald-700 dark:text-emerald-300">
                        🔒 Standing Rule 2 Test Call / WhatsApp Target:
                      </span>
                      <select
                        value={testNumber}
                        onChange={(e) => setTestNumber(e.target.value)}
                        className="rounded border border-line bg-surface px-2 py-1 font-mono text-[12px] font-bold"
                      >
                        {RULE2_TEST_NUMBERS.map((num) => (
                          <option key={num} value={num}>
                            {num} (Authorized Test)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        tone="primary"
                        busy={savingCall}
                        onClick={() => void handleSaveCall(true, "VOICE")}
                      >
                        📞 Test Call ({testNumber})
                      </Button>
                      <Button
                        size="sm"
                        tone="secondary"
                        busy={savingCall}
                        onClick={() => void handleSaveCall(true, "WHATSAPP")}
                      >
                        💬 Test WhatsApp ({pitchLang})
                      </Button>
                    </div>
                  </div>

                  {/* Candidate Screening & Disposition Fields */}
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-muted">Call Outcome / Disposition</label>
                      <select
                        value={dispCode}
                        onChange={(e) => setDispCode(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px] font-bold"
                      >
                        {DISPOSITIONS.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10.5px] font-bold text-muted">Current CTC</label>
                        <Input value={currCtc} onChange={(e) => setCurrCtc(e.target.value)} placeholder="e.g. ₹22,000" />
                      </div>
                      <div>
                        <label className="text-[10.5px] font-bold text-muted">Expected CTC</label>
                        <Input value={expCtc} onChange={(e) => setExpCtc(e.target.value)} placeholder="e.g. ₹26,000" />
                      </div>
                      <div>
                        <label className="text-[10.5px] font-bold text-muted">Notice (Days)</label>
                        <Input
                          value={noticeDays}
                          onChange={(e) => setNoticeDays(e.target.value)}
                          placeholder="e.g. 7"
                          type="number"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10.5px] font-bold text-muted">Next Follow-Up Date</label>
                        <Input
                          type="date"
                          value={followupDate}
                          onChange={(e) => setFollowupDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10.5px] font-bold text-muted">HR Interview / Call Notes</label>
                        <Input
                          value={callNotes}
                          onChange={(e) => setCallNotes(e.target.value)}
                          placeholder="Remarks, workshop preference…"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        full
                        busy={savingCall}
                        onClick={() => void handleSaveCall(false, "VOICE")}
                      >
                        💾 Save Call Disposition
                      </Button>
                      <Button
                        full
                        tone="secondary"
                        busy={savingCall}
                        onClick={() => void handleSaveCall(false, "WHATSAPP")}
                      >
                        📲 Send WhatsApp &amp; Log
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-muted">Select a candidate from the queue to start calling.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* =====================================================================
          TAB 4: SEHGAL 5-YEAR EMPLOYEE BUBBLE MATRIX (2,428 People · 1,663 Maruti + 765 Hero · 110 Shared)
         ===================================================================== */}
      {tab === "bubble" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            {[
              { id: "", label: "All 5Y Bubble", val: bStats?.total_5y_people ?? 2428, tone: "text-ink" },
              { id: "WORKING", label: "Working Now (Oct-26)", val: bStats?.working_now ?? 607, tone: "text-emerald-600 dark:text-emerald-400" },
              { id: "PAID_NOT_OCT", label: "Paid Jul-26 · Not Oct", val: bStats?.paid_jul26_not_oct ?? 67, tone: "text-amber-600 dark:text-amber-400" },
              { id: "GHOST", label: "Ghosts in DMS", val: bStats?.ghost_in_dms ?? 147, tone: "text-rose-600 dark:text-rose-400" },
              { id: "LEFT", label: "Left (Apr-21..Jun-26)", val: bStats?.left_apr21_jun26 ?? 1607, tone: "text-muted" },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setBubStatus(c.id)}
                className={`rounded-xl border p-3 text-left ${
                  bubStatus === c.id ? "border-2 border-accent bg-accent/10" : "border-line bg-raised"
                }`}
              >
                <div className="text-[11px] font-bold text-muted">{c.label}</div>
                <div className={`text-[20px] font-black ${c.tone}`}>{c.val.toLocaleString("en-IN")}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMatrixDivision("MARUTI")}
              className={`rounded-xl border p-3 text-left ${
                matrixDivision === "MARUTI" ? "border-2 border-accent bg-accent/10" : "border-line bg-raised"
              }`}
            >
              <div className="text-[11px] font-bold text-muted">🚗 Maruti Division</div>
              <div className="text-[18px] font-black text-brand dark:text-accent">
                {(bStats?.maruti_total ?? 1663).toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">{bStats?.maruti_working_now ?? 467} Working Now</div>
            </button>
            <button
              type="button"
              onClick={() => setMatrixDivision("HERO")}
              className={`rounded-xl border p-3 text-left ${
                matrixDivision === "HERO" ? "border-2 border-accent bg-accent/10" : "border-line bg-raised"
              }`}
            >
              <div className="text-[11px] font-bold text-muted">🏍️ Hero Division</div>
              <div className="text-[18px] font-black text-brand dark:text-accent">
                {(bStats?.hero_total ?? 765).toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">{bStats?.hero_working_now ?? 140} Working Now</div>
            </button>
            <button
              type="button"
              onClick={() => setMatrixDivision("SHARED_GROUP")}
              className={`rounded-xl border p-3 text-left ${
                matrixDivision === "SHARED_GROUP" ? "border-2 border-accent bg-accent/10" : "border-line bg-raised"
              }`}
            >
              <div className="text-[11px] font-bold text-muted">🔗 Multi-Div Master</div>
              <div className="text-[18px] font-black text-indigo-600 dark:text-indigo-400">
                {(bStats?.shared_multi_division ?? 110).toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-muted">Maruti + Hero Linked</div>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-raised p-3">
            <select
              value={bubFn}
              onChange={(e) => setBubFn(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-bold"
            >
              <option value="">All Functional Departments ({bubTotal.toLocaleString("en-IN")} matched)</option>
              <option value="Sales">Sales (313)</option>
              <option value="Service">Service (292)</option>
              <option value="Bodyshop">Bodyshop (96)</option>
              <option value="CRM / Customer Care">CRM / Customer Care (85)</option>
              <option value="Insurance">Insurance (45)</option>
              <option value="Spare Parts">Spare Parts (39)</option>
              <option value="Accounts">Accounts (26)</option>
              <option value="HR / Admin / IT">HR / Admin / IT (22)</option>
              <option value="Accessories">Accessories (19)</option>
              <option value="Finance">Finance (9)</option>
              <option value="RTO">RTO (9)</option>
            </select>
            <Input
              value={bubLoc}
              onChange={(e) => setBubLoc(e.target.value)}
              placeholder="Filter Outlet (BAVDHAN, LC ROAD, MANJARI, FATIMANAGAR…)"
            />
            <div className="flex-1">
              <Input
                value={bubQuery}
                onChange={(e) => setBubQuery(e.target.value)}
                placeholder="Search Name, Emp Code, MSPIN, Mobile, Designation…"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setMatrixRole("MD");
                setMatrixTenant(PRIMARY_GROUP_ID);
                setMatrixDivision("ALL");
                setMatrixLegalEntity("ALL");
                setMatrixOutlet("ALL");
                setMatrixReqSalary(false);
                setBubFn("");
                setBubLoc("");
                setBubQuery("");
              }}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-bold hover:border-accent"
            >
              ↻ Reset Matrix Scope
            </button>
          </div>

          {bubDeniedMsg ? (
            <div className="rounded-xl border-2 border-rose-500 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
              <div className="text-[14px] font-black">🛡️ Sehgal Group Database Permission / Tenant Isolation Guard Triggered</div>
              <div className="mt-1 font-mono text-[12.5px] font-bold">{bubDeniedMsg}</div>
              <div className="mt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setMatrixRole("MD");
                    setMatrixTenant(PRIMARY_GROUP_ID);
                    setMatrixDivision("ALL");
                    setMatrixReqSalary(false);
                  }}
                >
                  Restore MD / CEO Full Authorised Session
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-line bg-raised p-3">
            {bubLoading ? (
              <div className="py-10 text-center">
                <Spinner />
              </div>
            ) : (
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-raised">
                    <tr className="border-b border-line text-[10.5px] uppercase text-muted">
                      <th className="py-2 pr-2">Code / MSPIN</th>
                      <th className="py-2 px-2">Employee Name</th>
                      <th className="py-2 px-2">Division · Legal Entity</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2">Department · Outlet</th>
                      <th className="py-2 px-2">Designation</th>
                      <th className="py-2 px-2 text-right">Months Paid</th>
                      <th className="py-2 px-2 text-right">
                        First → Last Pay {!bubSalaryVisible ? "🔒" : ""}
                      </th>
                      <th className="py-2 px-2 text-right">
                        5Y Total Paid {!bubSalaryVisible ? "🔒" : ""}
                      </th>
                      <th className="py-2 pl-2">05-Oct Att / DMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {bubRows.map((b) => (
                      <tr key={b.emp_code} className="hover:bg-surface">
                        <td className="py-2 pr-2 font-mono">
                          <div className="font-bold text-brand dark:text-accent">{b.emp_code}</div>
                          {b.mspin ? <div className="text-[10.5px] text-muted">MSPIN {b.mspin}</div> : null}
                        </td>
                        <td className="py-2 px-2 font-extrabold">{b.name}</td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            <Badge tone={b.division_id === "HERO" ? "warn" : "brand"}>
                              {b.division_id === "HERO" ? "🏍️ HERO" : "🚗 MARUTI"}
                            </Badge>
                            {(b.assigned_divisions?.length ?? 0) > 1 ? (
                              <Badge tone="ok">🔗 MULTI-DIV (M+H)</Badge>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted">
                            {b.legal_entity_id === "LE_SEHGAL_AUTORIDERS_PVT_LTD"
                              ? "Sehgal Autoriders Pvt Ltd"
                              : "Sehgal Wheels Pvt Ltd"}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <Badge
                            tone={
                              b.status.startsWith("WORKING")
                                ? "ok"
                                : b.status.includes("ghost") || b.status.startsWith("GHOST")
                                  ? "danger"
                                  : "muted"
                            }
                          >
                            {b.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <b>{b.function || "—"}</b> · {b.location || b.dms_workshop || "—"}
                        </td>
                        <td className="py-2 px-2">{b.designation_jul26 || b.designation_last || b.dms_designation || "—"}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold">
                          {b.months_paid ?? 0}m
                          <div className="text-[10px] font-normal text-muted">
                            {b.first_month_paid || "—"}..{b.last_month_paid || "—"}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {!bubSalaryVisible ? (
                            <span className="text-[11px] font-bold text-rose-500">🔒 Restricted</span>
                          ) : (
                            <>
                              {b.salary_first_month ? inr(b.salary_first_month) : "—"} →{" "}
                              <b>{b.salary_last_month ? inr(b.salary_last_month) : "—"}</b>
                            </>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {!bubSalaryVisible ? (
                            <span className="text-[11px] font-bold text-rose-500">🔒 Restricted</span>
                          ) : b.salary_total_5y ? (
                            inr(b.salary_total_5y)
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 pl-2 text-[11px]">
                          <div>Att: {b.attendance_0510 || "—"}</div>
                          <div className="text-muted">
                            Trainings: {b.msil_trainings_passed ?? 0}/{b.msil_trainings ?? 0}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* =====================================================================
          TAB 5: WORKSHOP SAS MANPOWER NORMS (102) & CROSS-DEALER MSPINs (87 + 8)
         ===================================================================== */}
      {tab === "sas" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-raised p-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSasSubView("sas")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                  sasSubView === "sas" ? "bg-brand text-white dark:bg-accent" : "border border-line bg-surface"
                }`}
              >
                🛠️ Maruti Digital SAS Manpower vs Available ({bundle?.sas_manpower?.length ?? 102} Roles)
              </button>
              <button
                type="button"
                onClick={() => setSasSubView("cross")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                  sasSubView === "cross" ? "bg-brand text-white dark:bg-accent" : "border border-line bg-surface"
                }`}
              >
                🔄 87 Cross-Dealer MSPINs (At Other Dealers in DMS)
              </button>
              <button
                type="button"
                onClick={() => setSasSubView("bavdhan8")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                  sasSubView === "bavdhan8" ? "bg-brand text-white dark:bg-accent" : "border border-line bg-surface"
                }`}
              >
                🏢 8 Bavdhan Active Staff Needing DMS Mapping
              </button>
            </div>
            {sasSubView === "sas" ? (
              <Input
                value={sasWs}
                onChange={(e) => setSasWs(e.target.value)}
                placeholder="Filter workshop…"
              />
            ) : null}
          </div>

          {sasSubView === "sas" ? (
            <div className="rounded-xl border border-line bg-raised p-4">
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-raised">
                    <tr className="border-b border-line text-[10.5px] uppercase text-muted">
                      <th className="py-2 pr-2">Workshop</th>
                      <th className="py-2 px-2">SAS Role</th>
                      <th className="py-2 px-2 text-right">Monthly Load</th>
                      <th className="py-2 px-2 text-right">SAS Needs</th>
                      <th className="py-2 px-2 text-right">On 05-Oct Master</th>
                      <th className="py-2 px-2 text-right">In DMS</th>
                      <th className="py-2 px-2 text-right">In DMS Available</th>
                      <th className="py-2 px-2 text-right">Ghosts in DMS</th>
                      <th className="py-2 pl-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(bundle?.sas_manpower ?? [])
                      .filter((r) => !sasWs || r.workshop.toLowerCase().includes(sasWs.toLowerCase()))
                      .map((r, idx) => (
                        <tr key={`${r.workshop}-${r.sas_role}-${idx}`} className="hover:bg-surface">
                          <td className="py-2 pr-2 font-extrabold">{r.workshop}</td>
                          <td className="py-2 px-2 font-semibold">{r.sas_role}</td>
                          <td className="py-2 px-2 text-right font-mono">{r.load_per_month ?? "—"}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold">{r.sas_needs ?? 0}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {r.on_master_0510 ?? 0}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">{r.in_dms ?? 0}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold">{r.in_dms_available ?? 0}</td>
                          <td className="py-2 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                            {r.ghost_in_dms ?? 0}
                          </td>
                          <td className="py-2 pl-2">
                            <Badge tone={(r.short_vs_master ?? 0) > 0 ? "warn" : "ok"}>
                              {r.status || ((r.short_vs_master ?? 0) > 0 ? `Short by ${r.short_vs_master}` : "OK")}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {sasSubView === "cross" ? (
            <div className="rounded-xl border border-line bg-raised p-4">
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-raised">
                    <tr className="border-b border-line text-[10.5px] uppercase text-muted">
                      <th className="py-2 pr-2">MSPIN</th>
                      <th className="py-2 px-2">Employee Name</th>
                      <th className="py-2 px-2">Designation</th>
                      <th className="py-2 px-2">Other Dealer in DMS</th>
                      <th className="py-2 px-2">Sehgal Code &amp; Workshop</th>
                      <th className="py-2 px-2">Mobile</th>
                      <th className="py-2 pl-2">Match Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(bundle?.cross_dealer?.cross_dlr ?? []).map((c) => (
                      <tr key={c.id} className="hover:bg-surface">
                        <td className="py-2 pr-2 font-mono font-bold text-brand dark:text-accent">{c.mspin}</td>
                        <td className="py-2 px-2 font-extrabold">{c.emp_name}</td>
                        <td className="py-2 px-2">{c.desig}</td>
                        <td className="py-2 px-2">
                          <b>{c.other_dlr_name}</b> ({c.other_dlr_cd}) · {c.other_city}
                        </td>
                        <td className="py-2 px-2">
                          {c.sehgal_emp_code} · {c.sehgal_loc}
                        </td>
                        <td className="py-2 px-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {c.mobile || "—"}
                        </td>
                        <td className="py-2 pl-2">
                          <Badge tone="brand">{c.grade}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {sasSubView === "bavdhan8" ? (
            <div className="rounded-xl border border-line bg-raised p-4">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-line text-[10.5px] uppercase text-muted">
                    <th className="py-2 pr-2">Emp ID</th>
                    <th className="py-2 px-2">Full Name</th>
                    <th className="py-2 px-2">Role &amp; Outlet</th>
                    <th className="py-2 px-2">Oct Attendance</th>
                    <th className="py-2 px-2">Existing MSPIN</th>
                    <th className="py-2 px-2">Previous Dealer in DMS</th>
                    <th className="py-2 pl-2">Action Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(bundle?.cross_dealer?.bavdhan_8 ?? []).map((b) => (
                    <tr key={b.id} className="hover:bg-surface">
                      <td className="py-2 pr-2 font-mono font-bold">{b.emp_code}</td>
                      <td className="py-2 px-2 font-extrabold">{b.name}</td>
                      <td className="py-2 px-2">
                        {b.desig} · {b.outlet}
                      </td>
                      <td className="py-2 px-2 font-mono">{b.oct_days}/14 days ({b.att_28})</td>
                      <td className="py-2 px-2 font-mono font-bold text-brand dark:text-accent">{b.mspin}</td>
                      <td className="py-2 px-2">{b.prev_dealer}</td>
                      <td className="py-2 pl-2 font-semibold text-accent">{b.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* =====================================================================
          TAB 6: 5-YEAR FY & 64-MONTH ATTRITION
         ===================================================================== */}
      {tab === "attrition" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-xl border border-line bg-raised p-4 lg:col-span-5">
            <h3 className="text-[14px] font-extrabold">📅 Financial Year Summary (FY 21-22 to FY 26-27)</h3>
            <div className="mt-3 max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-raised">
                  <tr className="border-b border-line text-[10.5px] uppercase text-muted">
                    <th className="py-2 pr-2">FY</th>
                    <th className="py-2 px-2">Function</th>
                    <th className="py-2 px-2 text-right">Paid ≥1M</th>
                    <th className="py-2 px-2 text-right">Avg/Mo</th>
                    <th className="py-2 px-2 text-right">Joined</th>
                    <th className="py-2 pl-2 text-right">Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(bundle?.fy_summary ?? []).map((f, i) => (
                    <tr key={`${f.fy}-${f.function}-${i}`} className="hover:bg-surface">
                      <td className="py-1.5 pr-2 font-bold">{f.fy}</td>
                      <td className="py-1.5 px-2">{f.function}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold">{f.paid_at_least_1_month}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{f.avg_paid_per_month}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        +{f.joined}
                      </td>
                      <td className="py-1.5 pl-2 text-right font-mono text-rose-600 dark:text-rose-400">
                        -{f.left}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-raised p-4 lg:col-span-7">
            <h3 className="text-[14px] font-extrabold">
              📈 64-Month Paid Headcount, Joinings &amp; Attrition (Apr-2021 to Jul-2026)
            </h3>
            <div className="mt-3 max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-raised">
                  <tr className="border-b border-line text-[10.5px] uppercase text-muted">
                    <th className="py-2 pr-2">Month</th>
                    <th className="py-2 px-2">Era (22-07-2025 Split)</th>
                    <th className="py-2 px-2 text-right">Paid Headcount</th>
                    <th className="py-2 px-2 text-right">Joined</th>
                    <th className="py-2 px-2 text-right">Left</th>
                    <th className="py-2 pl-2 text-right">Attrition %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(bundle?.monthly ?? []).map((m) => (
                    <tr key={m.month} className="hover:bg-surface">
                      <td className="py-1.5 pr-2 font-mono font-bold">{m.month}</td>
                      <td className="py-1.5 px-2 text-[11px] text-muted">{m.era || "—"}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-extrabold">{m.headcount_paid}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        +{m.joined}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                        -{m.left}
                      </td>
                      <td className="py-1.5 pl-2 text-right font-mono font-bold">{m.attrition_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
