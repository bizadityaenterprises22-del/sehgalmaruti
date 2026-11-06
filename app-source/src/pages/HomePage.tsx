import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useUi } from "@/app/store";
import { GROUPS, MODULES, countBy } from "@/app/modules";
import { GroupCard } from "@/pages/GroupPage";
import { ROLE_LABEL } from "@/app/types";
import { useDayStats, useLocations } from "@/hooks/useQueries";
import { Badge, Section, Stat } from "@/components/ui";
import { inr } from "@/lib/money";
import { fmtDateDMY, todayIst } from "@/lib/dates";
import { Sehgal1TGivenVsConvertedReport } from "@/pages/Sehgal1TGivenVsConvertedPage";

export default function HomePage() {
  const navigate = useNavigate();
  const me = useUi((s) => s.me);
  const locationId = useUi((s) => s.locationId);
  const { data: stats } = useDayStats(locationId);
  const { data: locations = [] } = useLocations();
  const loc = locations.find((l) => l.id === locationId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = `${window.location.search}&${window.location.hash}`;
    const gotoMatch = /[?&]goto=([^&#]+)/i.exec(raw);
    const gotoVal = gotoMatch ? decodeURIComponent(gotoMatch[1]).toLowerCase() : "";
    if (gotoVal === "insurance") {
      navigate("/g/insurance/ins-workbench?tab=workbench", { replace: true });
    } else if (gotoVal === "ceo") {
      navigate("/g/insurance/ins-workbench?tab=ceo&ceo=1", { replace: true });
    } else if (gotoVal === "pms") {
      navigate("/crm-pms?mode=smr&tab=workbench", { replace: true });
    } else if (gotoVal === "pms-ceo") {
      navigate("/crm-pms?mode=smr&tab=ceo-fuzzy&ceo=1", { replace: true });
    } else if (gotoVal === "1t" || gotoVal === "given-vs-converted" || gotoVal === "sehgal-1t") {
      navigate("/1t-given-vs-converted", { replace: true });
    }
  }, [navigate]);

  // the first buttons a person sees are the ones of their own job
  const ALL = {
    hrCrm: {
      to: "/hr",
      icon: "👥",
      label: "Sehgal HR & Manpower",
      sub: "All-India 63.6K · 9,417 W2 · Calling",
    },
    pmsCrm: {
      to: "/crm-pms",
      icon: "📞",
      label: "CRM: SMR vs PSF",
      sub: "91.6% Top-10% · 5-Tier Fuzzy · PSF",
    },
    insCrm: {
      to: "/g/insurance/ins-workbench",
      icon: "🛡️",
      label: "Maruti Insurance Calling",
      sub: "14,847 MIBL · 5-Tier Fuzzy · 13-Portal",
    },
    vehHist: {
      to: "/vehicle-history",
      icon: "🚘",
      label: "Vehicle History",
      sub: "Every JC, parts, labour & DMS PDF",
    },
    gateIn: { to: "/gate", icon: "🚗", label: "Gate In", sub: "Vehicle arriving (OCR Tree)" },
    gateOut: { to: "/gate?mode=out", icon: "🏁", label: "Gate Out", sub: "Gate pass + receipt" },
    pickdrop: { to: "/pickdrop", icon: "🧭", label: "New pick / drop", sub: "Distance and money" },
    ledger: { to: "/ledger", icon: "📒", label: "Ledger", sub: "Today's money" },
    visits: { to: "/visits", icon: "🛎️", label: "Visits", sub: "Who is here, who has them" },
    customers: { to: "/customers", icon: "👥", label: "My customers", sub: "Follow-ups due" },
    sense: { to: "/sense", icon: "🎙️", label: "Sense notes", sub: "With consent" },
    trips: { to: "/trips", icon: "🚙", label: "My trips", sub: "Next step + navigation" },
    attendance: { to: "/attendance", icon: "🕘", label: "Attendance", sub: "Check in / out" },
  };
  const byRole: Record<string, (keyof typeof ALL)[]> = {
    guard: ["gateIn", "gateOut", "attendance"],
    reception: ["pmsCrm", "insCrm", "visits", "gateIn", "pickdrop", "attendance"],
    sales: ["pmsCrm", "insCrm", "customers", "visits", "attendance"],
    sa: ["pmsCrm", "vehHist", "visits", "pickdrop", "attendance"],
    technician: ["vehHist", "visits", "attendance"],
    driver: ["trips", "attendance"],
  };
  const actions = (
    byRole[me?.role ?? ""] ?? ["hrCrm", "pmsCrm", "insCrm", "vehHist", "gateIn", "gateOut", "pickdrop", "ledger"]
  ).map((k) => ALL[k]);

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-extrabold">Namaste, {me?.display_name?.split(" ")[0] ?? "there"}</h1>
          <p className="text-[13px] text-muted">
            {me?.designation ?? (me?.role ? ROLE_LABEL[me.role] : "")} · {loc ? loc.name : "All 9 Maruti workshops"} ·{" "}
            {fmtDateDMY(todayIst())}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">SEHGAL MARUTI · MARUTI SUZUKI ARENA &amp; NEXA</Badge>
          <Badge tone="ok">CRM 91.6% TOP-10% · INSURANCE 96.4% WALL</Badge>
        </div>
      </div>

      {/* Embedded 1T Top-10% Given vs Converted & 22-SMRE Login-and-Glue Report inside Sehgal Autoriders Matrix */}
      <Sehgal1TGivenVsConvertedReport embedded={true} />

      {/* Sehgal Autoriders Group — Division × Department Matrix Selector */}
      <div className="rounded-xl border border-line bg-raised p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo.svg`}
              alt="Sehgal Autoriders"
              className="h-9 w-auto object-contain dark:hidden"
            />
            <img
              src={`${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo-on-dark.svg`}
              alt="Sehgal Autoriders"
              className="hidden h-9 w-auto object-contain dark:block"
            />
            <div>
              <div className="text-[15px] font-extrabold text-[#1d3b8b] dark:text-accent">
                Sehgal Autoriders Group — Division × Department Matrix
              </div>
              <div className="text-[11.5px] text-muted">
                Divisions: <b>Maruti Suzuki · Hero MotoCorp · Tata · TVS · Electric Bikes · Kia</b> × Departments: <b>Service &amp; Bodyshop · Insurance · HR &amp; Payroll · Finance · Parts · Accessories</b>
              </div>
            </div>
          </div>
          <Link
            to="/hr?tab=chooser"
            className="rounded-lg border border-accent bg-accent/10 px-3 py-1.5 text-[12px] font-extrabold text-accent hover:bg-accent hover:text-white"
          >
            🏛️ Open 5-Dimension Matrix &amp; 7/7 Acceptance Tests →
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link
            to="/holdup"
            className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1d3b8b]"
          >
            <span className="text-2xl">🔧</span>
            <span className="mt-1 text-[12px] font-black uppercase text-[#1d3b8b] dark:text-accent">SERVICE &amp; BODYSHOP</span>
            <span className="text-[10.5px] text-muted">Maruti · Hero · Tata · TVS</span>
          </Link>
          <Link
            to="/g/insurance/ins-workbench"
            className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1d3b8b]"
          >
            <span className="text-2xl">🛡️</span>
            <span className="mt-1 text-[12px] font-black uppercase text-[#1d3b8b] dark:text-accent">INSURANCE</span>
            <span className="text-[10.5px] text-muted">Maruti &amp; Hero · 86% Slab</span>
          </Link>
          <Link
            to="/hr?tab=bubble"
            className="flex flex-col items-center justify-center rounded-xl border-2 border-[#1d3b8b] bg-surface p-3 text-center shadow-sm transition-all hover:-translate-y-0.5"
          >
            <span className="text-2xl">👥</span>
            <span className="mt-1 text-[12px] font-black uppercase text-[#1d3b8b] dark:text-accent">HR &amp; PAYROLL</span>
            <span className="text-[10.5px] text-muted">Maruti + Hero in 1 Session</span>
          </Link>
          <Link
            to="/ledger"
            className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1d3b8b]"
          >
            <span className="text-2xl">₹</span>
            <span className="mt-1 text-[12px] font-black uppercase text-[#1d3b8b] dark:text-accent">FINANCE</span>
            <span className="text-[10.5px] text-muted">Separate Legal Books &amp; P&amp;L</span>
          </Link>
          <Link
            to="/vehicle-history"
            className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1d3b8b]"
          >
            <span className="text-2xl">⚙️</span>
            <span className="mt-1 text-[12px] font-black uppercase text-[#1d3b8b] dark:text-accent">PARTS &amp; INVENTORY</span>
            <span className="text-[10.5px] text-muted">Stock · Requisitions · Finder</span>
          </Link>
          <Link
            to="/crm-pms"
            className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1d3b8b]"
          >
            <span className="text-2xl">📞</span>
            <span className="mt-1 text-[12px] font-black uppercase text-[#1d3b8b] dark:text-accent">SALES &amp; CRM</span>
            <span className="text-[10.5px] text-muted">SMR · PSF · Contact Loop</span>
          </Link>
        </div>
      </div>

      {/* CRM (SMR vs PSF) + Maruti Insurance Calling + Sehgal HR Launch Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-raised p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Badge tone="brand">SEHGAL HR · ALL-INDIA &amp; CALLING</Badge>
            <Badge tone="ok">63.6K REG · 9,417 W2</Badge>
          </div>
          <div className="mt-2 text-[16px] font-extrabold text-ink">
            👥 All-India Manpower &amp; HR Calling Engine
          </div>
          <p className="mt-1 text-[12px] text-muted">
            `6,637` All-India Outlets · `63,618` Active Register · `76,259` Joinings · `62,504` Leavings · `2,428` Sehgal 5Y Bubble + 6-Stream HR Calling (`1,119` queue):
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/hr?tab=all-india"
              className="rounded-lg border border-accent bg-accent/10 px-3 py-2 text-center text-[12.5px] font-extrabold text-accent hover:bg-accent hover:text-white"
            >
              🇮🇳 All-India Manpower →
            </Link>
            <Link
              to="/hr?tab=calling"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-center text-[12.5px] font-extrabold text-ink hover:border-accent"
            >
              📞 HR Calling Queue →
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-raised p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Badge tone="brand">MARUTI CRM · CHOOSE SMR OR PSF</Badge>
            <Badge tone="ok">91.6% IN TOP 10% (MOTTO ≥90%)</Badge>
          </div>
          <div className="mt-2 text-[16px] font-extrabold text-ink">
            📞 CRM Optimization &amp; Calling Engine (SMR · PSF)
          </div>
          <p className="mt-1 text-[12px] text-muted">
            5-Tier Cross-Book Fuzzy Matching + 10-Parameter Weights (`100` pts) + 5-Day Daily Wall (`22-10-2026` to `26-10-2026`). Choose where to go:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/crm-pms?mode=smr"
              className="rounded-lg border border-accent bg-accent/10 px-3 py-2 text-center text-[12.5px] font-extrabold text-accent hover:bg-accent hover:text-white"
            >
              📞 Open SMR (Periodic Maintenance) →
            </Link>
            <Link
              to="/crm-pms?mode=psf"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-center text-[12.5px] font-extrabold text-ink hover:border-accent"
            >
              ⭐ Open PSF (Post-Service Follow-up) →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-raised p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Badge tone="brand">MARUTI INSURANCE · 14,847 MIBL POLICIES</Badge>
            <Badge tone="ok">96.4% CAUGHT VS 100% WALL</Badge>
          </div>
          <div className="mt-2 text-[16px] font-extrabold text-ink">
            🛡️ Maruti Insurance Calling &amp; 13-Portal Live 4W Car Rates
          </div>
          <p className="mt-1 text-[12px] text-muted">
            `9,799` Arena + `5,048` Nexa policies · 5-Tier Fuzzy Matching + 9-Parameter Weights (`100` pts) + Live 4W Car Quotes across MIBL &amp; 12 online portals.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/g/insurance/ins-workbench"
              className="rounded-lg border border-accent bg-accent/10 px-3 py-2 text-center text-[12.5px] font-extrabold text-accent hover:bg-accent hover:text-white"
            >
              🛡️ Open Insurance Workbench →
            </Link>
            <Link
              to="/g/insurance/ins-portal"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-center text-[12.5px] font-extrabold text-ink hover:border-accent"
            >
              💰 13-Portal Live Car Rates →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Gate in today" value={stats?.gateIn ?? "—"} />
        <Stat label="Gate out today" value={stats?.gateOut ?? "—"} />
        <Stat label="Trips running" value={stats?.tripsRunning ?? "—"} tone="warn" />
        <Stat label="Trips done" value={stats?.tripsDone ?? "—"} tone="ok" />
        <Stat label="KM today" value={stats ? `${stats.kmToday.toFixed(1)}` : "—"} />
        <Stat label="Payable today" value={stats ? inr(stats.payableToday) : "—"} tone="ok" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className={`rounded-xl border p-4 shadow-sm transition-all hover:-translate-y-px hover:shadow-md ${
              a.to === "/crm-pms" || a.to === "/g/insurance/ins-workbench"
                ? "border-accent bg-accent/5"
                : "border-line bg-raised"
            }`}
          >
            <div className="text-2xl">{a.icon}</div>
            <div className="mt-1 text-[15px] font-extrabold text-brand dark:text-accent">{a.label}</div>
            <div className="text-[12px] text-muted">{a.sub}</div>
          </Link>
        ))}
      </div>

      <Section
        title="The Sehgal Maruti Operating App · 11 Groups"
        sub={`${MODULES.length - 1} modules: ${countBy("WORKING")} working on real data, ${countBy("BUILT")} built and waiting for their first rows, ${countBy("PLACEHOLDER") - 1} planned and not wired yet.`}
        right={
          <Link to="/wiring" className="text-[13px] font-bold text-accent">
            Wiring board →
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {GROUPS.map((g) => (
            <GroupCard key={g.id} id={g.id} />
          ))}
        </div>
      </Section>
    </div>
  );
}
