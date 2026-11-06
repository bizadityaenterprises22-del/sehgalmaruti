import { useState } from "react";
import { saveRateCard } from "@/app/api";
import type { RateCard } from "@/app/types";
import { useInvalidate, useLocations, useRateCards } from "@/hooks/useQueries";
import { Badge, Button, Empty, Field, Input, Note, Section, Select, Table, Td, flash } from "@/components/ui";
import { computeAmount, inr } from "@/lib/money";
import { todayIst } from "@/lib/dates";

const BLANK: Partial<RateCard> = {
  location_id: null,
  name: "Standard",
  per_km: 0,
  base_fare: 0,
  min_charge: 0,
  waiting_per_hour: 0,
  night_pct: 0,
  night_from: "22:00",
  night_to: "06:00",
  round_trip_factor: 1,
  effective_from: todayIst(),
  is_active: true,
  notes: "",
};

/** The inputs the money is computed from - entered ONCE per workshop (Ravi, 05-09-2026). */
export default function RatesPanel() {
  const { data: cards = [] } = useRateCards();
  const { data: locations = [] } = useLocations();
  const invalidate = useInvalidate();
  const [edit, setEdit] = useState<Partial<RateCard> | null>(null);
  const [saving, setSaving] = useState(false);
  const locName = (id: string | null) =>
    id ? (locations.find((l) => l.id === id)?.name ?? "—") : "Company default (all workshops without their own)";
  const num = (k: keyof RateCard) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEdit({ ...edit, [k]: e.target.value === "" ? 0 : Number(e.target.value) });

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      await saveRateCard(edit);
      flash("Rate card saved - every new trip at that workshop uses it.");
      setEdit(null);
      invalidate("rates");
    } catch (e) {
      flash((e as Error).message, "danger");
    } finally {
      setSaving(false);
    }
  }

  const sample = edit ? computeAmount(edit as RateCard, 10, { waitingMinutes: 30 }) : null;

  return (
    <Section
      title="Rate cards"
      sub="Per-km rate, base fare, minimum, waiting per hour, night %, round-trip factor. One card per workshop; the company default covers the rest."
      right={
        <Button size="sm" onClick={() => setEdit({ ...BLANK })}>
          + New rate card
        </Button>
      }
    >
      {edit ? (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/5 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Workshop" className="lg:col-span-2">
              <Select value={edit.location_id ?? ""} onChange={(e) => setEdit({ ...edit, location_id: e.target.value || null })}>
                <option value="">Company default (all workshops)</option>
                {locations
                  .filter((l) => l.is_active)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Card name">
              <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Effective from">
              <Input
                type="date"
                value={edit.effective_from ?? todayIst()}
                onChange={(e) => setEdit({ ...edit, effective_from: e.target.value })}
              />
            </Field>
            <Field label="₹ per km">
              <Input inputMode="decimal" value={edit.per_km ?? 0} onChange={num("per_km")} />
            </Field>
            <Field label="Base fare ₹">
              <Input inputMode="decimal" value={edit.base_fare ?? 0} onChange={num("base_fare")} />
            </Field>
            <Field label="Minimum charge ₹">
              <Input inputMode="decimal" value={edit.min_charge ?? 0} onChange={num("min_charge")} />
            </Field>
            <Field label="Waiting ₹ per hour">
              <Input inputMode="decimal" value={edit.waiting_per_hour ?? 0} onChange={num("waiting_per_hour")} />
            </Field>
            <Field label="Night extra %">
              <Input inputMode="decimal" value={edit.night_pct ?? 0} onChange={num("night_pct")} />
            </Field>
            <Field label="Night from">
              <Input type="time" value={edit.night_from ?? "22:00"} onChange={(e) => setEdit({ ...edit, night_from: e.target.value })} />
            </Field>
            <Field label="Night to">
              <Input type="time" value={edit.night_to ?? "06:00"} onChange={(e) => setEdit({ ...edit, night_to: e.target.value })} />
            </Field>
            <Field label="Round-trip factor" hint="1.8 = a round trip pays 1.8 × the one-way distance">
              <Input inputMode="decimal" value={edit.round_trip_factor ?? 1} onChange={num("round_trip_factor")} />
            </Field>
            <Field label="Notes" className="lg:col-span-3">
              <Input value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Note tone="ok">
              Check: 10 km with 30 min waiting = <b>{sample ? inr(sample.amount) : "—"}</b>
            </Note>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />{" "}
              Active
            </label>
            <Button busy={saving} onClick={() => void save()}>
              {edit.id ? "Save changes" : "Create card"}
            </Button>
            <Button tone="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {cards.length === 0 ? (
        <Empty>No rate card yet.</Empty>
      ) : (
        <Table head={["Workshop", "Card", "₹/km", "Base", "Min", "Wait/hr", "Night", "Round ×", "From", "", "Edit"]}>
          {cards.map((c) => (
            <tr key={c.id} className="hover:bg-surface">
              <Td className="font-bold">{locName(c.location_id)}</Td>
              <Td>
                {c.name}
                {c.notes ? <div className="text-[11px] text-muted">{c.notes}</div> : null}
              </Td>
              <Td className="font-extrabold">{inr(c.per_km)}</Td>
              <Td>{inr(c.base_fare)}</Td>
              <Td>{inr(c.min_charge)}</Td>
              <Td>{inr(c.waiting_per_hour)}</Td>
              <Td>
                {c.night_pct}% ({c.night_from.slice(0, 5)}–{c.night_to.slice(0, 5)})
              </Td>
              <Td>{c.round_trip_factor}</Td>
              <Td>{c.effective_from.split("-").reverse().join("-")}</Td>
              <Td>
                <Badge tone={c.location_id ? "brand" : "muted"}>{c.location_id ? "workshop" : "default"}</Badge>
              </Td>
              <Td>
                <Button size="sm" tone="secondary" onClick={() => setEdit(c)}>
                  Edit
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}
