import { useEffect, useMemo, useState } from "react";
import { createTrip, currentPosition, geocode, rateFor, routeKm } from "@/app/api";
import type { GeoHit, LatLng, TripKind } from "@/app/types";
import { useDrivers, useInvalidate, useLocations, useRateCards } from "@/hooks/useQueries";
import { Button, Field, Input, Note, Section, Segmented, Select, flash } from "@/components/ui";
import { computeAmount, inr } from "@/lib/money";
import { fmtKm, isValidPoint } from "@/lib/geo";
import { clockIst } from "@/lib/dates";
import { cleanReg } from "@/lib/plate";

interface Place {
  address: string;
  point: LatLng | null;
}
const EMPTY: Place = { address: "", point: null };

/** One end of the trip: an address box, GPS, address search, or the workshop itself. */
function PlaceInput({
  label,
  value,
  onChange,
  workshop,
  disabled,
}: {
  label: string;
  value: Place;
  onChange: (p: Place) => void;
  workshop: { name: string; point: LatLng | null } | null;
  disabled?: boolean;
}) {
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [busy, setBusy] = useState<"gps" | "find" | null>(null);
  async function gps() {
    setBusy("gps");
    try {
      const p = await currentPosition();
      onChange({ address: value.address || `My location (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`, point: { lat: p.lat, lng: p.lng } });
    } catch (e) {
      flash(`GPS: ${(e as Error).message}`, "danger");
    } finally {
      setBusy(null);
    }
  }
  async function find() {
    setBusy("find");
    try {
      const h = await geocode(value.address);
      setHits(h);
      if (!h.length) flash("No address found - try a landmark or an area name.", "warn");
    } catch (e) {
      flash(`Address search: ${(e as Error).message}`, "danger");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-muted">{label}</span>
        <span className={`text-[11px] font-bold ${value.point ? "text-ok" : "text-warn"}`}>{value.point ? "📍 pinned" : "no pin yet"}</span>
      </div>
      <Input
        value={value.address}
        onChange={(e) => onChange({ address: e.target.value, point: null })}
        placeholder="Area, landmark, society…"
        disabled={disabled}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" tone="secondary" busy={busy === "gps"} onClick={() => void gps()} disabled={disabled}>
          📍 My GPS
        </Button>
        <Button
          size="sm"
          tone="secondary"
          busy={busy === "find"}
          onClick={() => void find()}
          disabled={disabled || value.address.trim().length < 3}
        >
          🔎 Find on map
        </Button>
        {workshop?.point ? (
          <Button
            size="sm"
            tone="secondary"
            onClick={() => onChange({ address: workshop.name, point: workshop.point })}
            disabled={disabled}
          >
            🏭 Workshop
          </Button>
        ) : null}
      </div>
      {hits.length ? (
        <ul className="mt-2 space-y-1">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lng}`}>
              <button
                type="button"
                className="w-full rounded-md border border-line bg-raised px-2 py-1.5 text-left text-[12.5px] hover:border-accent"
                onClick={() => {
                  onChange({ address: h.label, point: { lat: h.lat, lng: h.lng } });
                  setHits([]);
                }}
              >
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function TripForm({ locationId }: { locationId: string | null }) {
  const invalidate = useInvalidate();
  const { data: drivers = [] } = useDrivers(locationId);
  const { data: cards = [] } = useRateCards();
  const { data: locations = [] } = useLocations();
  const loc = locations.find((l) => l.id === locationId) ?? null;
  const workshop = loc
    ? { name: loc.name, point: isValidPoint({ lat: loc.lat ?? NaN, lng: loc.lng ?? NaN }) ? { lat: loc.lat!, lng: loc.lng! } : null }
    : null;
  const rate = rateFor(locationId, cards);

  const [open, setOpen] = useState(true);
  const [kind, setKind] = useState<TripKind>("pickup");
  const [driverId, setDriverId] = useState("");
  const [f, setF] = useState({ customer_name: "", customer_mobile: "", reg_no: "", jc_no: "", waiting: "0", notes: "" });
  const [pick, setPick] = useState<Place>(EMPTY);
  const [drop, setDrop] = useState<Place>(EMPTY);
  const [dist, setDist] = useState<{ km: number; source: "osrm" | "haversine" } | null>(null);
  const [manualKm, setManualKm] = useState("");
  const [measuring, setMeasuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  // Pickup: customer -> workshop. Drop: workshop -> customer. Round: workshop -> customer (factor applies).
  useEffect(() => {
    if (!workshop?.point) return;
    if (kind === "pickup") setDrop({ address: workshop.name, point: workshop.point });
    else setPick({ address: workshop.name, point: workshop.point });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, locationId]);

  // Measure the road distance whenever both ends are pinned.
  useEffect(() => {
    let alive = true;
    if (!pick.point || !drop.point) {
      setDist(null);
      return;
    }
    setMeasuring(true);
    routeKm(pick.point, drop.point).then((r) => {
      if (alive) {
        setDist(r);
        setMeasuring(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [pick.point, drop.point]);

  const km = manualKm ? Number(manualKm) : (dist?.km ?? 0);
  const money = useMemo(
    () => (rate ? computeAmount(rate, km, { waitingMinutes: Number(f.waiting) || 0, kind, startClock: clockIst() }) : null),
    [rate, km, f.waiting, kind],
  );
  const driver = drivers.find((d) => d.id === driverId);

  async function save() {
    if (!locationId) return flash("Choose a workshop first.", "warn");
    if (!driver) return flash("Choose the driver.", "warn");
    if (!pick.address.trim() || !drop.address.trim()) return flash("Pick and drop locations are required.", "warn");
    if (!rate) return flash("No rate card for this workshop - set one in the Admin pack first.", "warn");
    setSaving(true);
    try {
      const distance_km = km > 0 ? km : null;
      const distance_source = manualKm ? "manual" : (dist?.source ?? null);
      const t = await createTrip({
        location_id: locationId,
        driver_id: driver.id,
        driver_name: driver.name,
        kind,
        reg_no: f.reg_no ? cleanReg(f.reg_no) : null,
        customer_name: f.customer_name || null,
        customer_mobile: f.customer_mobile || null,
        jc_no: f.jc_no || null,
        pick_address: pick.address,
        pick_lat: pick.point?.lat ?? null,
        pick_lng: pick.point?.lng ?? null,
        drop_address: drop.address,
        drop_lat: drop.point?.lat ?? null,
        drop_lng: drop.point?.lng ?? null,
        distance_km,
        distance_source,
        waiting_minutes: Number(f.waiting) || 0,
        rate_card_id: rate.id,
        rate_snapshot: rate,
        amount: money?.amount ?? null,
        amount_breakdown: money ? { ...money } : null,
        notes: f.notes || null,
      });
      flash(`Trip planned for ${t.driver_name} · ${fmtKm(t.distance_km)} · ${inr(t.amount)}`);
      setF({ customer_name: "", customer_mobile: "", reg_no: "", jc_no: "", waiting: "0", notes: "" });
      setDriverId("");
      setManualKm("");
      if (kind === "pickup") setPick(EMPTY);
      else setDrop(EMPTY);
      invalidate("trips", "stats");
    } catch (e) {
      flash(`Not saved: ${(e as Error).message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="New pick / drop"
      sub={
        rate
          ? `Rate card: ${rate.name} · ${inr(rate.per_km)}/km${rate.min_charge ? ` · min ${inr(rate.min_charge)}` : ""}${rate.location_id ? "" : " (company default - set this workshop's own card in Admin)"}`
          : "No rate card yet - the Admin pack sets it once per workshop."
      }
      right={
        <Button size="sm" tone="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Show"}
        </Button>
      }
    >
      {open ? (
        <div className="space-y-3">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "pickup", label: "Pick up (customer → workshop)" },
              { value: "drop", label: "Drop (workshop → customer)" },
              { value: "round", label: "Round trip" },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Driver" className="lg:col-span-1">
              <Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                <option value="">— choose —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.vehicle_no ? ` · ${d.vehicle_no}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Customer">
              <Input value={f.customer_name} onChange={set("customer_name")} />
            </Field>
            <Field label="Mobile">
              <Input value={f.customer_mobile} onChange={set("customer_mobile")} inputMode="tel" />
            </Field>
            <Field label="Vehicle reg no.">
              <Input value={f.reg_no} onChange={set("reg_no")} placeholder="MH12AB1234" autoCapitalize="characters" />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <PlaceInput label="Pick location" value={pick} onChange={setPick} workshop={workshop} disabled={saving} />
            <PlaceInput label="Drop location" value={drop} onChange={setDrop} workshop={workshop} disabled={saving} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Distance"
              hint={
                measuring
                  ? "Measuring on the road…"
                  : dist
                    ? dist.source === "osrm"
                      ? "Measured on the road (OSRM)"
                      : "Router unreachable - straight line × 1.3 (estimate)"
                    : "Pin both ends to measure automatically"
              }
            >
              <Input
                value={manualKm || (dist ? String(dist.km) : "")}
                onChange={(e) => setManualKm(e.target.value)}
                placeholder="km"
                inputMode="decimal"
                className="font-extrabold"
              />
            </Field>
            <Field label="Waiting (minutes)">
              <Input value={f.waiting} onChange={set("waiting")} inputMode="numeric" />
            </Field>
            <Field label="Job card">
              <Input value={f.jc_no} onChange={set("jc_no")} />
            </Field>
            <Field label="Notes">
              <Input value={f.notes} onChange={set("notes")} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Money (automatic)</div>
              <div className="text-[22px] font-extrabold text-ok">{money ? inr(money.amount) : "—"}</div>
              {money ? (
                <div className="text-[11px] text-muted">
                  {fmtKm(money.km)} × {inr(money.per_km)}
                  {money.base_fare ? ` + base ${inr(money.base_fare)}` : ""}
                  {money.waiting_charge ? ` + waiting ${inr(money.waiting_charge)}` : ""}
                  {money.night ? ` + night ${money.night_pct}%` : ""}
                  {money.min_applied ? " · minimum applied" : ""}
                </div>
              ) : null}
            </div>
            <Button size="lg" busy={saving} onClick={() => void save()} disabled={!locationId}>
              Save trip
            </Button>
            {!workshop?.point ? (
              <Note tone="warn">
                This workshop has no map pin yet - set its latitude/longitude in the Admin pack so the Workshop button works.
              </Note>
            ) : null}
          </div>
        </div>
      ) : null}
    </Section>
  );
}
