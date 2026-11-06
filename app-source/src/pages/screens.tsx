import { lazy, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { useSearchParams } from "react-router";
import type { ScreenId } from "@/app/modules";

/*
  The screens a module can open inside its group panel. Each is built on first open (lightness law).
  `minRank` is convenience only - the database refuses the rest (RLS / SECURITY DEFINER guards).
*/
const GatePage = lazy(() => import("@/pages/GatePage"));
const PickDropPage = lazy(() => import("@/pages/PickDropPage"));
const LedgerPage = lazy(() => import("@/pages/LedgerPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const VisitsPage = lazy(() => import("@/pages/VisitsPage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const AttendancePage = lazy(() => import("@/pages/AttendancePage"));
const DriverPage = lazy(() => import("@/pages/DriverPage"));
const TruthPage = lazy(() => import("@/pages/TruthPage"));
const RetentionPage = lazy(() => import("@/pages/RetentionPage"));
const HoldupPage = lazy(() => import("@/pages/ops/HoldupPage"));
const TatPage = lazy(() => import("@/pages/ops/TatPage"));
const FeedPage = lazy(() => import("@/pages/ops/FeedPage"));
const VehicleHistoryPage = lazy(() => import("@/pages/VehicleHistoryPage"));
const InsurancePage = lazy(() => import("@/pages/InsurancePage"));
const PmsCrmPage = lazy(() => import("@/pages/PmsCrmPage"));
const HrPage = lazy(() => import("@/pages/HrPage"));

/** Opens the gate screen on its Gate Out side (the gate screen keeps its own In / Out switch). */
function GateOutScreen() {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get("mode") !== "out") setParams({ mode: "out" }, { replace: true });
  }, [params, setParams]);
  return <GatePage />;
}

/** Opens Pick & Drop on its Drivers tab. */
function DriversScreen() {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (!params.get("tab")) setParams({ tab: "drivers" }, { replace: true });
  }, [params, setParams]);
  return <PickDropPage />;
}

export const SCREENS: Record<ScreenId, { C: LazyExoticComponent<ComponentType> | ComponentType; minRank?: number; who?: string }> = {
  gate: { C: GatePage },
  "gate-out": { C: GateOutScreen },
  pickdrop: { C: PickDropPage },
  drivers: { C: DriversScreen },
  trips: { C: DriverPage },
  attendance: { C: AttendancePage },
  ledger: { C: LedgerPage, minRank: 50, who: "WM, GM, CEO" },
  visits: { C: VisitsPage },
  customers: { C: CustomersPage },
  admin: { C: AdminPage, minRank: 70, who: "GM and above, Admin" },
  truth: { C: TruthPage, minRank: 90, who: "CEO and Maruti admin" },
  holdup: { C: HoldupPage, minRank: 50, who: "WM, GM, CEO" },
  tat: { C: TatPage, minRank: 50, who: "WM, GM, CEO" },
  feed: { C: FeedPage, minRank: 50, who: "WM, GM, CEO" },
  "retention-practice": { C: RetentionPage },
  "vehicle-history": { C: VehicleHistoryPage },
  insurance: { C: InsurancePage },
  "crm-pms": { C: PmsCrmPage },
  hr: { C: HrPage },
};
