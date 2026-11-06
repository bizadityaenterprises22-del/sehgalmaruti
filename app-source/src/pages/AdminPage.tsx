import { useSearchParams } from "react-router";
import { useUi } from "@/app/store";
import { Note, Segmented } from "@/components/ui";
import DriversPanel from "./pickdrop/DriversPanel";
import RatesPanel from "./admin/RatesPanel";
import LocationsPanel from "./admin/LocationsPanel";
import UsersPanel from "./admin/UsersPanel";

type Tab = "rates" | "drivers" | "locations" | "users";

/**
 * THE ADMIN PACK. Rate inputs entered once per workshop; drivers; workshops with map pins;
 * logins by designation. Rates / locations / users: Admin and CEO. Drivers: Admin, CEO,
 * VP, AVP, GM. The database enforces all of it; this page only decides what to show.
 */
export default function AdminPage() {
  const [params, setParams] = useSearchParams();
  const me = useUi((s) => s.me)!;
  const locationId = useUi((s) => s.locationId);
  const tab = (params.get("tab") as Tab) || (me.is_admin ? "rates" : "drivers");

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-4">
      <Segmented
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        options={[
          { value: "rates", label: "₹ Rates" },
          { value: "drivers", label: "👨‍✈️ Drivers" },
          { value: "locations", label: "🏭 Workshops" },
          { value: "users", label: "👤 Users & logins" },
        ]}
      />
      {tab === "drivers" ? (
        <DriversPanel locationId={locationId} canManage={me.can_manage_drivers} />
      ) : !me.is_admin ? (
        <Note tone="warn">Rates, workshops and logins are set by the CEO or an Administrator. You can manage drivers.</Note>
      ) : tab === "rates" ? (
        <RatesPanel />
      ) : tab === "locations" ? (
        <LocationsPanel />
      ) : (
        <UsersPanel />
      )}
    </div>
  );
}
