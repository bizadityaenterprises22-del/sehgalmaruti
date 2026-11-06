import { useState } from "react";
import { currentPosition, saveLocation } from "@/app/api";
import type { Location } from "@/app/types";
import { useInvalidate, useLocations } from "@/hooks/useQueries";
import { Badge, Button, Empty, Field, Input, Section, Table, Td, flash } from "@/components/ui";

const BLANK: Partial<Location> = {
  code: "",
  name: "",
  msil_outlet_code: "",
  msil_locn: "",
  city: "Pune",
  lat: null,
  lng: null,
  is_active: true,
};

/** The Sehgal Maruti workshops (seeded from the MSIL manpower sheet). Map pins live here. */
export default function LocationsPanel() {
  const { data: locations = [] } = useLocations();
  const invalidate = useInvalidate();
  const [edit, setEdit] = useState<Partial<Location> | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!edit?.code || !edit?.name) return flash("Code and name are required.", "warn");
    setSaving(true);
    try {
      await saveLocation(edit);
      flash("Workshop saved");
      setEdit(null);
      invalidate("locations");
    } catch (e) {
      flash((e as Error).message, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function pinHere() {
    try {
      const p = await currentPosition();
      setEdit({ ...edit, lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
      flash("Pinned to this phone's GPS position");
    } catch (e) {
      flash(`GPS: ${(e as Error).message}`, "danger");
    }
  }

  return (
    <Section
      title={`Workshops · ${locations.length}`}
      sub="Code, name, MSIL outlet code, and the map pin used for the Workshop button and the map."
      right={
        <Button size="sm" onClick={() => setEdit({ ...BLANK })}>
          + Add workshop
        </Button>
      }
    >
      {edit ? (
        <div className="mb-4 grid gap-3 rounded-xl border border-accent/40 bg-accent/5 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Code">
            <Input
              value={edit.code ?? ""}
              onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
              disabled={!!edit.id}
            />
          </Field>
          <Field label="Name" className="lg:col-span-2">
            <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </Field>
          <Field label="City">
            <Input value={edit.city ?? ""} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
          </Field>
          <Field label="MSIL outlet code">
            <Input value={edit.msil_outlet_code ?? ""} onChange={(e) => setEdit({ ...edit, msil_outlet_code: e.target.value })} />
          </Field>
          <Field label="MSIL location name">
            <Input value={edit.msil_locn ?? ""} onChange={(e) => setEdit({ ...edit, msil_locn: e.target.value })} />
          </Field>
          <Field label="Latitude">
            <Input
              inputMode="decimal"
              value={edit.lat ?? ""}
              onChange={(e) => setEdit({ ...edit, lat: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Field>
          <Field label="Longitude">
            <Input
              inputMode="decimal"
              value={edit.lng ?? ""}
              onChange={(e) => setEdit({ ...edit, lng: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2 lg:col-span-4">
            <Button tone="secondary" size="sm" onClick={() => void pinHere()}>
              📍 Pin to my GPS
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />{" "}
              Active
            </label>
            <Button busy={saving} onClick={() => void save()}>
              {edit.id ? "Save changes" : "Add workshop"}
            </Button>
            <Button tone="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {locations.length === 0 ? (
        <Empty>No workshop yet.</Empty>
      ) : (
        <Table head={["Code", "Name", "MSIL outlet", "City", "Pin", "Status", "Edit"]}>
          {locations.map((l) => (
            <tr key={l.id} className="hover:bg-surface">
              <Td className="font-mono font-bold">{l.code}</Td>
              <Td className="font-bold">
                {l.name}
                <div className="text-[11px] text-muted">{l.msil_locn ?? ""}</div>
              </Td>
              <Td>{l.msil_outlet_code ?? "—"}</Td>
              <Td>{l.city ?? "—"}</Td>
              <Td>
                {l.lat != null && l.lng != null ? `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}` : <span className="text-warn">no pin</span>}
              </Td>
              <Td>
                <Badge tone={l.is_active ? "ok" : "muted"}>{l.is_active ? "Active" : "Inactive"}</Badge>
              </Td>
              <Td>
                <Button size="sm" tone="secondary" onClick={() => setEdit(l)}>
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
