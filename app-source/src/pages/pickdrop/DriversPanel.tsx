import { useState } from "react";
import { saveDriver } from "@/app/api";
import type { Driver } from "@/app/types";
import { useDriverChanges, useDrivers, useInvalidate, useLocations } from "@/hooks/useQueries";
import { Badge, Button, Empty, Field, Input, Note, Section, Select, Table, Td, flash } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";

const BLANK: Partial<Driver> = { name: "", mobile: "", licence_no: "", vehicle_no: "", is_active: true };

/**
 * The drivers of ONE workshop. Location-wise on purpose (Ravi, 05-09-2026: "Location wise
 * will be different for Drivers. It is not same for all Sehgal."). Only Admin / CEO / VP /
 * AVP / GM may add, edit or deactivate - the database refuses everyone else and logs
 * every change (mar_driver_changes).
 */
export default function DriversPanel({ locationId, canManage }: { locationId: string | null; canManage: boolean }) {
  const { data: drivers = [], isLoading } = useDrivers(locationId, true);
  const { data: locations = [] } = useLocations();
  const { data: changes = [] } = useDriverChanges();
  const invalidate = useInvalidate();
  const [edit, setEdit] = useState<Partial<Driver> | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      await saveDriver({ ...edit, location_id: edit.location_id ?? locationId });
      flash(edit.id ? "Driver updated (logged)" : "Driver added (logged)");
      setEdit(null);
      invalidate("drivers", "driver-changes");
    } catch (e) {
      flash((e as Error).message, "danger");
    } finally {
      setSaving(false);
    }
  }

  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <Section
        title={`Drivers · ${drivers.filter((d) => d.is_active).length} active`}
        sub={locationId ? `Workshop: ${locName(locationId)}` : "All workshops"}
        right={
          canManage ? (
            <Button size="sm" onClick={() => setEdit({ ...BLANK, location_id: locationId })}>
              + Add driver
            </Button>
          ) : null
        }
      >
        {!canManage ? <Note tone="info">Only Admin, CEO, VP, AVP and GM can change drivers. Ask them for a change.</Note> : null}
        {edit ? (
          <div className="mb-3 grid gap-3 rounded-xl border border-accent/40 bg-accent/5 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name">
              <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <Input value={edit.mobile ?? ""} onChange={(e) => setEdit({ ...edit, mobile: e.target.value })} inputMode="tel" />
            </Field>
            <Field label="Licence no.">
              <Input value={edit.licence_no ?? ""} onChange={(e) => setEdit({ ...edit, licence_no: e.target.value })} />
            </Field>
            <Field label="Vehicle no.">
              <Input value={edit.vehicle_no ?? ""} onChange={(e) => setEdit({ ...edit, vehicle_no: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Workshop">
              <Select value={edit.location_id ?? ""} onChange={(e) => setEdit({ ...edit, location_id: e.target.value || null })}>
                <option value="">—</option>
                {locations
                  .filter((l) => l.is_active)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="flex items-end gap-2 lg:col-span-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={edit.is_active ?? true}
                  onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
                />{" "}
                Active
              </label>
              <Button busy={saving} onClick={() => void save()}>
                {edit.id ? "Save changes" : "Add driver"}
              </Button>
              <Button tone="secondary" onClick={() => setEdit(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : drivers.length === 0 ? (
          <Empty>No driver at this workshop yet.{canManage ? " Add the first one." : ""}</Empty>
        ) : (
          <Table head={["Driver", "Mobile", "Licence", "Vehicle", "Workshop", "Status", canManage ? "Edit" : ""]}>
            {drivers.map((d) => (
              <tr key={d.id} className="hover:bg-surface">
                <Td className="font-bold">{d.name}</Td>
                <Td>{d.mobile ?? "—"}</Td>
                <Td>{d.licence_no ?? "—"}</Td>
                <Td>{d.vehicle_no ?? "—"}</Td>
                <Td>{locName(d.location_id)}</Td>
                <Td>
                  <Badge tone={d.is_active ? "ok" : "muted"}>{d.is_active ? "Active" : "Inactive"}</Badge>
                </Td>
                <Td>
                  {canManage ? (
                    <Button size="sm" tone="secondary" onClick={() => setEdit(d)}>
                      Edit
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Driver changes (log)" sub="Every add, edit, deactivation and driver swap on a trip - who, when, what. Latest first.">
        {changes.length === 0 ? (
          <Empty>No change logged yet.</Empty>
        ) : (
          <Table head={["When", "Field", "From", "To"]}>
            {changes.map((c) => (
              <tr key={c.id}>
                <Td>{fmtDateTime(c.changed_at)}</Td>
                <Td>{c.field}</Td>
                <Td>{c.old_value ?? "—"}</Td>
                <Td className="font-bold">{c.new_value ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
