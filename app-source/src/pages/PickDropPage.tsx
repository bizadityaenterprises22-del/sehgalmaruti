import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router";
import { useUi } from "@/app/store";
import { Note, Segmented, Spinner } from "@/components/ui";
import TripForm from "./pickdrop/TripForm";
import TripTable from "./pickdrop/TripTable";
import DriversPanel from "./pickdrop/DriversPanel";
import { todayIst } from "@/lib/dates";

const TripMap = lazy(() => import("./pickdrop/TripMap"));
type Tab = "trips" | "drivers" | "map";

export default function PickDropPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "trips";
  const locationId = useUi((s) => s.locationId);
  const me = useUi((s) => s.me)!;

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-4">
      <Segmented
        value={tab}
        onChange={(t) => setParams(t === "trips" ? {} : { tab: t })}
        options={[
          { value: "trips", label: "🧭 Trips" },
          { value: "drivers", label: "👨‍✈️ Drivers" },
          { value: "map", label: "🗺️ Map" },
        ]}
      />
      {!locationId && tab !== "map" ? (
        <Note tone="warn">Choose a workshop in the header - drivers and rates are per workshop (they differ across Sehgal).</Note>
      ) : null}
      {tab === "trips" ? (
        <>
          <TripForm locationId={locationId} />
          <TripTable locationId={locationId} day={todayIst()} canManageDrivers={me.can_manage_drivers} />
        </>
      ) : tab === "drivers" ? (
        <DriversPanel locationId={locationId} canManage={me.can_manage_drivers} />
      ) : (
        <Suspense
          fallback={
            <div className="grid h-64 place-items-center">
              <Spinner />
            </div>
          }
        >
          <TripMap locationId={locationId} />
        </Suspense>
      )}
    </div>
  );
}
