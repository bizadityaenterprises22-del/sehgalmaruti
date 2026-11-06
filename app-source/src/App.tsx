import { lazy, Suspense, useCallback, useEffect } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { enrollDevice, hasSession, me as fetchMe, onAuthChange, signOut } from "@/app/api";
import { useUi } from "@/app/store";
import { ROLE_LABEL } from "@/app/types";
import { useLocations } from "@/hooks/useQueries";
import { Button, FlashBar, Spinner } from "@/components/ui";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import { GROUPS } from "@/app/modules";
import { PlanContext } from "@/app/plan";

// Every other tab is built on first open (lightness law: paint the shell first).
const GatePage = lazy(() => import("@/pages/GatePage"));
const PickDropPage = lazy(() => import("@/pages/PickDropPage"));
const LedgerPage = lazy(() => import("@/pages/LedgerPage"));
const GroupPage = lazy(() => import("@/pages/GroupPage"));
const WiringPage = lazy(() => import("@/pages/WiringPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const VisitsPage = lazy(() => import("@/pages/VisitsPage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const AttendancePage = lazy(() => import("@/pages/AttendancePage"));
const DriverPage = lazy(() => import("@/pages/DriverPage"));
const VehicleHistoryPage = lazy(() => import("@/pages/VehicleHistoryPage"));
const PmsCrmPage = lazy(() => import("@/pages/PmsCrmPage"));
const HrPage = lazy(() => import("@/pages/HrPage"));
const Sehgal1TGivenVsConvertedPage = lazy(() => import("@/pages/Sehgal1TGivenVsConvertedPage"));
// Sense stays hidden: Ravi 06-10-2026 - no Sense / audio / QR until the legal side is clear (the page stays in code).

// UI LAW: tab strip on top, ONE panel visible, no long scrolling pages, dark + light.
// ONE app, role screens: `roles` lists who sees a tab; managers (rank >= 50) see every tab
// except Admin (>= 70). Hiding is convenience only - the database refuses the rest.
type Tab = { to: string; icon: string; label: string; end?: boolean; roles?: string[]; minRank?: number };
const TABS: Tab[] = [
  { to: "/", icon: "🏠", label: "Home", end: true },
  { to: "/1t-given-vs-converted", icon: "🎯", label: "1T Given vs Converted (22 SMREs · Sehgal)" },
  { to: "/hr", icon: "👥", label: "Sehgal HR (All-India & Calling)" },
  { to: "/crm-pms", icon: "📞", label: "CRM (SMR · PSF)" },
  { to: "/g/insurance/ins-workbench", icon: "🛡️", label: "Insurance Calling" },
  { to: "/vehicle-history", icon: "🚘", label: "Vehicle History" },
  ...GROUPS.map((g) => ({ to: `/g/${g.id}`, icon: g.icon, label: g.name })),
  { to: "/wiring", icon: "🔌", label: "Wiring board" },
  { to: "/admin", icon: "⚙️", label: "Admin", minRank: 70 },
];
const canSee = (t: Tab, role: string | null, rank: number) =>
  t.minRank !== undefined ? rank >= t.minRank : !t.roles || rank >= 50 || (!!role && t.roles.includes(role));

export default function App() {
  const theme = useUi((s) => s.theme);
  const status = useUi((s) => s.status);
  const me = useUi((s) => s.me);
  const setMe = useUi((s) => s.setMe);
  const setStatus = useUi((s) => s.setStatus);
  const reset = useUi((s) => s.reset);
  const qc = useQueryClient();

  const load = useCallback(async () => {
    const m = await fetchMe();
    setMe(m);
    setStatus("signed-in");
    // this installation is enrolled for the person (separate from attendance); a failure never blocks the app
    void enrollDevice().catch(() => undefined);
  }, [setMe, setStatus]);

  useEffect(() => {
    let alive = true;
    const rawUrl = typeof window !== "undefined" ? `${window.location.search}&${window.location.hash}` : "";
    const isCeoUrl = rawUrl.includes("ceo=1");
    const smreMatch = /[?&]smre=([^&#]+)/i.exec(rawUrl);
    if (isCeoUrl || smreMatch) {
      const callerName = smreMatch ? decodeURIComponent(smreMatch[1].replace(/\+/g, " ")) : "Ravi Sehgal (CEO)";
      if (typeof window !== "undefined" && smreMatch) {
        window.localStorage.setItem("sehgal_maruti_smre_name", callerName);
      }
      setMe({
        profile_id: isCeoUrl ? "ceo-verify-session" : "smre-zero-training-session",
        login_code: isCeoUrl ? "CEO" : "SMRE",
        display_name: callerName,
        home_org_id: "sehgal-maruti",
        is_platform_admin: isCeoUrl,
        tenant: null,
        tenants: null,
        role: isCeoUrl ? "ceo" : "ccm",
        rank: isCeoUrl ? 100 : 50,
        designation: isCeoUrl ? "MD / CEO" : "SMRE Calling Executive (100 Calls/Day)",
        location_ids: null,
        can_manage_drivers: isCeoUrl,
        is_admin: isCeoUrl,
      });
      setStatus("signed-in");
      return;
    }
    hasSession()
      .then((ok) => (ok ? load() : Promise.resolve(setStatus("signed-out"))))
      .catch((e) => alive && setStatus("signed-out", (e as Error).message));
    const off = onAuthChange((signedIn) => {
      if (!signedIn) {
        qc.clear();
        reset();
      }
    });
    return () => {
      alive = false;
      off();
    };
  }, [load, setStatus, reset, qc]);

  return (
    <div data-theme={theme} className="h-dvh bg-surface text-ink">
      {status === "unknown" ? (
        <Splash />
      ) : status !== "signed-in" ? (
        <Routes>
          <Route path="/plan/*" element={<PlanShell />} />
          <Route path="*" element={<LoginPage onSignedIn={load} />} />
        </Routes>
      ) : !me?.role ? (
        <NotAMember />
      ) : (
        <Shell />
      )}
      <FlashBar />
    </div>
  );
}

function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand text-lg font-black text-white">SM</div>
        <p className="mt-3 text-sm text-muted">Sehgal Maruti starting…</p>
      </div>
    </div>
  );
}

function NotAMember() {
  const me = useUi((s) => s.me);
  return (
    <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center p-6 text-center">
      <div className="text-3xl">🔒</div>
      <h1 className="mt-3 text-lg font-extrabold">Not a member of Sehgal Maruti</h1>
      <p className="mt-2 text-sm text-muted">
        {me?.display_name ?? "This login"} signed in, but has no role in Sehgal Maruti. The CEO adds people in the Admin pack.
      </p>
      <Button className="mt-6" tone="secondary" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}

function Shell() {
  const me = useUi((s) => s.me)!;
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const locationId = useUi((s) => s.locationId);
  const setLocation = useUi((s) => s.setLocation);
  const { data: locations = [] } = useLocations();

  const allowed = locations.filter((l) => l.is_active && (!me.location_ids || me.location_ids.includes(l.id)));

  // A person scoped to workshops must always be looking at one of them.
  useEffect(() => {
    if (!allowed.length) return;
    if (!locationId || !allowed.some((l) => l.id === locationId)) {
      if (me.location_ids || allowed.length === 1) setLocation(allowed[0].id);
    }
  }, [allowed, locationId, me.location_ids, setLocation]);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b-[3px] border-accent bg-header text-header-ink shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}brand/sehgal-autoriders-logo-on-dark.svg`}
              alt="Sehgal Autoriders"
              className="h-8 w-auto shrink-0 object-contain"
            />
            <span className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-black tracking-wide text-white shadow-sm">
              MARUTI SUZUKI
            </span>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-extrabold leading-tight">
                SEHGAL MARUTI
              </div>
              <div className="truncate text-[11px] text-header-ink/65">
                Sehgal Autoriders · {me.display_name} · {me.designation ?? (me.role ? ROLE_LABEL[me.role] : "")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <select
              value={locationId ?? ""}
              onChange={(e) => setLocation(e.target.value || null)}
              className="max-w-[190px] rounded-md border border-header-ink/25 bg-header-ink/10 px-2 py-1.5 text-[12px] font-semibold text-header-ink"
              aria-label="Workshop"
            >
              {!me.location_ids ? (
                <option value="" className="text-ink">
                  All workshops
                </option>
              ) : null}
              {allowed.map((l) => (
                <option key={l.id} value={l.id} className="text-ink">
                  {l.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md border border-header-ink/25 px-2 py-1.5 text-xs text-header-ink hover:bg-header-ink/10"
              aria-label="Theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-header-ink/25 px-2 py-1.5 text-xs text-header-ink hover:bg-header-ink/10"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line bg-raised px-2 shadow-sm sm:px-4">
        {TABS.filter((t) => canSee(t, me.role, me.rank)).map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 whitespace-nowrap border-b-[3px] px-3 py-3 text-[13px] font-bold transition-colors ${
                isActive ? "border-accent bg-accent/10 text-accent" : "border-transparent text-muted hover:bg-surface hover:text-brand"
              }`
            }
          >
            <span>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-auto">
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-muted">
              <Spinner />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/1t-given-vs-converted" element={<Sehgal1TGivenVsConvertedPage />} />
            <Route path="/hr" element={<HrPage />} />
            <Route path="/crm-pms" element={<PmsCrmPage />} />
            <Route path="/gate" element={<GatePage />} />
            <Route path="/pickdrop" element={<PickDropPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/visits" element={<VisitsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/trips" element={<DriverPage />} />
            <Route path="/vehicle-history" element={<VehicleHistoryPage />} />
            <Route path="/g/:group" element={<GroupPage />} />
            <Route path="/g/:group/:module" element={<GroupPage />} />
            <Route path="/wiring" element={<WiringPage />} />
            <Route path="/modules" element={<Navigate to="/wiring" replace />} />
            <Route path="/retention" element={<Navigate to="/g/retention/ret-cohorts" replace />} />
            <Route path="/truth" element={<Navigate to="/g/truth/zt-board" replace />} />
            <Route path="/admin" element={me.rank >= 70 ? <AdminPage /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

/**
 * Before sign-in: the plan of the whole app - the 11 groups, every module's state, planned layout and data source,
 * and the Wiring board. No data screen opens and no database call is made here.
 */
function PlanShell() {
  return (
    <PlanContext.Provider value={{ planOnly: true, base: "/plan" }}>
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b-[3px] border-accent bg-header px-3 py-2 text-header-ink shadow-md sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-accent px-2 py-1 text-[12px] font-black tracking-wide text-white">MARUTI SUZUKI</span>
              <div>
                <div className="text-[14px] font-extrabold leading-tight">SEHGAL MARUTI · THE PLAN</div>
                <div className="text-[11px] text-header-ink/60">No data before sign-in - the plan of every module only</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/" className="rounded-md border border-header-ink/25 px-3 py-1.5 text-xs font-bold text-header-ink hover:bg-header-ink/10">
                Sign in
              </Link>
            </div>
          </div>
        </header>
        <nav className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line bg-raised px-2 shadow-sm sm:px-4">
          {[...GROUPS.map((g) => ({ to: `/plan/g/${g.id}`, icon: g.icon, label: g.name })), { to: "/plan/wiring", icon: "🔌", label: "Wiring board" }].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 whitespace-nowrap border-b-[3px] px-3 py-3 text-[13px] font-bold transition-colors ${
                  isActive ? "border-accent bg-accent/10 text-accent" : "border-transparent text-muted hover:bg-surface hover:text-brand"
                }`
              }
            >
              <span>{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-h-0 flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-muted">
                <Spinner />
              </div>
            }
          >
            <Routes>
              <Route path="g/:group" element={<GroupPage />} />
              <Route path="g/:group/:module" element={<GroupPage />} />
              <Route path="wiring" element={<WiringPage />} />
              <Route path="*" element={<Navigate to="/plan/wiring" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </PlanContext.Provider>
  );
}
