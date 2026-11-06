import { useState } from "react";
import { googleMapsDirections, tripStep } from "@/app/api";
import { DRIVER_STEPS, type DriverStep, type Trip } from "@/app/types";
import { useInvalidate, useMyDriverTrips } from "@/hooks/useQueries";
import { Badge, Button, Empty, Note, Section, flash } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { prettyReg } from "@/lib/plate";

/*
  MY TRIPS (driver). assigned -> accepted -> en route -> arrived -> custody received ->
  delivered -> completed. The order is enforced by the server (mar_trip_step); every press
  is logged with time and, when the phone gives it, the location AT THAT PRESS only - we do
  not track the driver between presses. Opening Google Maps does not prove a trip and sends
  nothing back to us.
*/

const STEP_LABEL: Record<DriverStep, string> = {
  assigned: "Assigned",
  accepted: "Accept trip",
  en_route: "Start - on the way",
  arrived: "Reached",
  custody: "Vehicle / keys received",
  delivered: "Handed over",
  completed: "Complete trip",
};

function stepOf(t: Trip): DriverStep {
  if (t.status === "planned") return "assigned";
  if (t.status === "running") return "en_route";
  return (DRIVER_STEPS as readonly string[]).includes(t.status) ? (t.status as DriverStep) : "assigned";
}

function TripCard({ t }: { t: Trip }) {
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const cur = stepOf(t);
  const idx = DRIVER_STEPS.indexOf(cur);
  const next = DRIVER_STEPS[idx + 1] as DriverStep | undefined;
  // before custody the driver heads to the pick point; after it, to the drop point
  const toDrop = idx >= DRIVER_STEPS.indexOf("custody");
  const dest = toDrop
    ? t.drop_lat && t.drop_lng ? { lat: t.drop_lat, lng: t.drop_lng } : t.drop_address
    : t.pick_lat && t.pick_lng ? { lat: t.pick_lat, lng: t.pick_lng } : t.pick_address;

  async function go(to: DriverStep) {
    setBusy(true);
    try {
      const r = await tripStep(t.id, to);
      flash(r.replayed ? "Already recorded" : `${STEP_LABEL[to]} · recorded`);
      invalidate("trips");
    } catch (e) {
      flash((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title={`${t.kind === "drop" ? "Drop" : t.kind === "round" ? "Round trip" : "Pick up"} · ${t.reg_no ? prettyReg(t.reg_no) : "vehicle"}`}
      sub={`${t.customer_name ?? "Customer"}${t.jc_no ? ` · JC ${t.jc_no}` : ""} · planned ${fmtDateTime(t.planned_at)}`}
      right={<Badge tone="brand">{cur.replace("_", " ")}</Badge>}
    >
      <div className="space-y-1 text-[13px]">
        <div>
          <b>From:</b> {t.pick_address ?? "—"}
        </div>
        <div>
          <b>To:</b> {t.drop_address ?? "—"}
        </div>
        {t.customer_mobile ? (
          <div>
            <b>Customer:</b>{" "}
            <a className="font-bold text-accent" href={`tel:${t.customer_mobile}`}>
              {t.customer_mobile}
            </a>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {DRIVER_STEPS.map((s, i) => (
          <span key={s} className={`rounded px-2 py-0.5 text-[11px] font-bold ${i <= idx ? "bg-ok/20 text-ok" : "bg-line/60 text-muted"}`}>
            {i + 1}. {s.replace("_", " ")}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {next ? (
          <Button size="lg" tone="ok" busy={busy} onClick={() => void go(next)}>
            {STEP_LABEL[next]}
          </Button>
        ) : null}
        {dest ? (
          <a
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-4 py-3 text-sm font-bold text-ink hover:bg-surface"
            href={googleMapsDirections(dest)}
            target="_blank"
            rel="noreferrer"
          >
            🧭 Navigate with Google Maps ({toDrop ? "drop" : "pick-up"})
          </a>
        ) : null}
      </div>
    </Section>
  );
}

export default function DriverPage() {
  const { data = [], isLoading } = useMyDriverTrips();
  return (
    <div className="mx-auto max-w-[900px] space-y-4 p-4">
      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : data.length === 0 ? (
        <Empty>No open trip for you. Reception or the workshop assigns trips in Pick & Drop.</Empty>
      ) : (
        data.map((t) => <TripCard key={t.id} t={t} />)
      )}
      <Note>
        Your location is read only at the moment you press a step button. Google Maps opens in your own Maps app; we see nothing from it. A trip counts only
        by these steps.
      </Note>
    </div>
  );
}
