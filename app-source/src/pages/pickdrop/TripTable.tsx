import { useState } from "react";
import { cancelTrip, changeTripDriver, currentPosition, endTrip, startTrip } from "@/app/api";
import type { Trip, TripStatus } from "@/app/types";
import { useDrivers, useInvalidate, useTrips } from "@/hooks/useQueries";
import { Badge, Button, Empty, Section, Select, Table, Td, flash } from "@/components/ui";
import { fmtTime } from "@/lib/dates";
import { fmtKm } from "@/lib/geo";
import { inr } from "@/lib/money";
import { prettyReg } from "@/lib/plate";

const STATUS_TONE: Record<TripStatus, "brand" | "warn" | "ok" | "muted"> = {
  planned: "brand",
  assigned: "brand",
  accepted: "brand",
  running: "warn",
  en_route: "warn",
  arrived: "warn",
  custody: "warn",
  delivered: "ok",
  done: "ok",
  completed: "ok",
  cancelled: "muted",
};
const KIND_LABEL = { pickup: "Pick up", drop: "Drop", round: "Round" } as const;
const SOURCE_LABEL: Record<string, string> = { osrm: "road", gps: "GPS", haversine: "estimate", manual: "typed" };

async function tryPosition() {
  try {
    return await currentPosition();
  } catch {
    return null;
  }
}

function ChangeDriver({ trip, locationId }: { trip: Trip; locationId: string | null }) {
  const { data: drivers = [] } = useDrivers(locationId ?? trip.location_id);
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  return (
    <Select
      value={trip.driver_id ?? ""}
      disabled={busy}
      className="!w-auto !py-1 !text-[12px]"
      onChange={async (e) => {
        const d = drivers.find((x) => x.id === e.target.value);
        if (!d) return;
        setBusy(true);
        try {
          await changeTripDriver(trip.id, d);
          flash(`Driver changed to ${d.name} (logged)`);
          invalidate("trips", "driver-changes");
        } catch (err) {
          flash((err as Error).message, "danger");
        } finally {
          setBusy(false);
        }
      }}
    >
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
      {!drivers.some((d) => d.id === trip.driver_id) && trip.driver_id ? <option value={trip.driver_id}>{trip.driver_name}</option> : null}
    </Select>
  );
}

export default function TripTable({
  locationId,
  day,
  canManageDrivers,
}: {
  locationId: string | null;
  day: string;
  canManageDrivers: boolean;
}) {
  const { data = [], isLoading } = useTrips({ locationId, day });
  const invalidate = useInvalidate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const order: Record<TripStatus, number> = {
    running: 0, en_route: 0, arrived: 0, custody: 0, delivered: 0, accepted: 1, planned: 1, assigned: 1, done: 2, completed: 2, cancelled: 3,
  };
  const rows = [...data].sort((a, b) => order[a.status] - order[b.status]);

  async function act(t: Trip, what: "start" | "end" | "cancel") {
    setBusyId(t.id);
    try {
      if (what === "start") {
        const p = await tryPosition();
        await startTrip(t.id, p);
        flash(`Started · ${t.driver_name}${p ? " · GPS start recorded" : " · no GPS fix"}`);
      } else if (what === "end") {
        const w = window.prompt("Waiting time at the customer, in minutes (0 if none):", String(t.waiting_minutes ?? 0));
        if (w === null) return;
        const p = await tryPosition();
        const done = await endTrip(t.id, p, Number(w) || 0);
        flash(`Done · ${fmtKm(done.distance_km)} (${SOURCE_LABEL[done.distance_source ?? ""] ?? "—"}) · ${inr(done.amount)}`);
      } else {
        const r = window.prompt("Cancel this trip? Reason:", "");
        if (r === null) return;
        await cancelTrip(t.id, r || undefined);
        flash("Trip cancelled", "warn");
      }
      invalidate("trips", "stats");
    } catch (e) {
      flash((e as Error).message, "danger");
    } finally {
      setBusyId(null);
    }
  }

  const total = rows.filter((t) => t.status === "done").reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return (
    <Section title={`Trips today · ${rows.length}`} sub={`Running first, then planned, then done. Payable so far ${inr(total)}.`}>
      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty>No trip today at this workshop yet.</Empty>
      ) : (
        <Table head={["Status", "Driver", "Type", "Customer", "Route", "Start → End", "KM", "Amount", "Actions"]}>
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-surface">
              <Td>
                <Badge tone={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</Badge>
              </Td>
              <Td className="font-bold">
                {canManageDrivers && t.status !== "done" && t.status !== "cancelled" ? (
                  <ChangeDriver trip={t} locationId={locationId} />
                ) : (
                  t.driver_name
                )}
              </Td>
              <Td>{KIND_LABEL[t.kind]}</Td>
              <Td>
                {t.customer_name ?? "—"}
                <div className="text-[11px] text-muted">
                  {t.customer_mobile ?? ""}
                  {t.reg_no ? ` · ${prettyReg(t.reg_no)}` : ""}
                </div>
              </Td>
              <Td className="max-w-[260px]">
                <div className="truncate" title={t.pick_address ?? ""}>
                  {t.pick_address ?? "—"}
                </div>
                <div className="truncate text-muted" title={t.drop_address ?? ""}>
                  → {t.drop_address ?? "—"}
                </div>
              </Td>
              <Td>
                {fmtTime(t.started_at)} → {fmtTime(t.ended_at)}
              </Td>
              <Td className="font-bold">
                {fmtKm(t.distance_km)}
                <div className="text-[10px] font-normal text-muted">{SOURCE_LABEL[t.distance_source ?? ""] ?? ""}</div>
              </Td>
              <Td className="font-extrabold text-ok">{inr(t.amount)}</Td>
              <Td className="space-x-1 whitespace-nowrap">
                {t.status === "planned" ? (
                  <Button size="sm" tone="ok" busy={busyId === t.id} onClick={() => void act(t, "start")}>
                    ▶ Start
                  </Button>
                ) : null}
                {t.status === "running" ? (
                  <Button size="sm" tone="danger" busy={busyId === t.id} onClick={() => void act(t, "end")}>
                    ⏹ End
                  </Button>
                ) : null}
                {t.status === "planned" || t.status === "running" ? (
                  <Button size="sm" tone="secondary" busy={busyId === t.id} onClick={() => void act(t, "cancel")}>
                    ✕
                  </Button>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}
