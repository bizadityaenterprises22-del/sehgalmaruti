import { useState } from "react";
import { createGateIn, updateGateIn, uploadPhoto } from "@/app/api";
import { useInvalidate } from "@/hooks/useQueries";
import { Button, Field, Input, Note, PhotoSlot, Section, Select, TextArea, flash } from "@/components/ui";
import { cleanReg, isKnownRegFormat, prettyReg } from "@/lib/plate";
import { ocrLine, usePlateOcr } from "./usePlateOcr";

const PURPOSES = ["Periodic service", "Running repair", "Bodyshop", "Insurance / accident", "PDI", "Delivery", "Sales / demo", "Other"];

export default function GateInForm({ locationId }: { locationId: string | null }) {
  const invalidate = useInvalidate();
  const plate = usePlateOcr();
  const [vehicle, setVehicle] = useState<Blob | null>(null);
  const [platePhoto, setPlatePhoto] = useState<Blob | null>(null);
  const [reg, setReg] = useState("");
  const [regFromOcr, setRegFromOcr] = useState<{ text: string; confidence: number } | null>(null);
  const [f, setF] = useState({
    customer_name: "",
    mobile: "",
    model: "",
    km_in: "",
    purpose: PURPOSES[0],
    jc_no: "",
    brought_by: "",
    sa_name: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function onVehicle(b: Blob | null) {
    setVehicle(b);
    if (!b) {
      plate.reset();
      return;
    }
    const r = await plate.run(b);
    if (r.reg && (!reg || regFromOcr)) {
      setReg(r.reg);
      setRegFromOcr({ text: r.reading?.text ?? "", confidence: r.reading?.confidence ?? 0 });
    }
  }

  async function save() {
    if (!locationId) return flash("Choose a workshop first.", "warn");
    const regNo = cleanReg(reg);
    if (!regNo) return flash("Registration number is required (photo or typed).", "warn");
    if (!vehicle) return flash("Photograph the vehicle first.", "warn");
    setSaving(true);
    try {
      const row = await createGateIn({
        location_id: locationId,
        reg_no: regNo,
        reg_no_ocr: regFromOcr?.text ?? null,
        reg_confidence: regFromOcr ? Math.min(0.999, Math.max(0, regFromOcr.confidence)) : null,
        reg_source: regFromOcr && cleanReg(regFromOcr.text) === regNo ? "ocr" : "manual",
        customer_name: f.customer_name || null,
        mobile: f.mobile || null,
        model: f.model || null,
        km_in: f.km_in ? Number(f.km_in) : null,
        purpose: f.purpose || null,
        jc_no: f.jc_no || null,
        brought_by: f.brought_by || null,
        sa_name: f.sa_name || null,
        notes: f.notes || null,
      });
      const photo_vehicle = await uploadPhoto(vehicle, {
        kind: "gate_in_vehicle",
        regNo,
        refTable: "mar_gate_in",
        refId: row.id,
        locationId,
        ocrText: regFromOcr?.text ?? null,
      });
      const photo_plate = platePhoto
        ? await uploadPhoto(platePhoto, { kind: "gate_in_plate", regNo, refTable: "mar_gate_in", refId: row.id, locationId })
        : null;
      await updateGateIn(row.id, { photo_vehicle, photo_plate });
      flash(`Gate in #${row.entry_no} saved · ${prettyReg(regNo)}`);
      setVehicle(null);
      setPlatePhoto(null);
      setReg("");
      setRegFromOcr(null);
      plate.reset();
      setF({ ...f, customer_name: "", mobile: "", model: "", km_in: "", jc_no: "", brought_by: "", sa_name: "", notes: "" });
      invalidate("gate-in", "stats");
    } catch (e) {
      flash(`Not saved: ${(e as Error).message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  const regClean = cleanReg(reg);
  const regWarn = regClean && !isKnownRegFormat(regClean);

  return (
    <Section title="Gate In" sub="Photograph the vehicle - the registration is read automatically. Confirm it, add the customer, save.">
      <div className="grid gap-3 md:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <PhotoSlot
            label="Vehicle (plate visible)"
            blob={vehicle}
            onBlob={(b) => void onVehicle(b)}
            status={ocrLine(plate.state)}
            required
            disabled={saving}
          />
          <PhotoSlot label="Close-up of plate (optional)" blob={platePhoto} onBlob={setPlatePhoto} disabled={saving} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Registration no."
            className="sm:col-span-2"
            hint={
              regWarn
                ? "Not a known Indian format - saved anyway, check it."
                : regClean
                  ? prettyReg(regClean)
                  : "Read from the photo, or type it."
            }
          >
            <Input
              value={reg}
              onChange={(e) => {
                setReg(e.target.value.toUpperCase());
              }}
              placeholder="MH12AB1234"
              autoCapitalize="characters"
              className="font-mono text-[18px] font-extrabold tracking-wider"
            />
          </Field>
          <Field label="Customer name">
            <Input value={f.customer_name} onChange={set("customer_name")} />
          </Field>
          <Field label="Mobile">
            <Input value={f.mobile} onChange={set("mobile")} inputMode="tel" />
          </Field>
          <Field label="Model">
            <Input value={f.model} onChange={set("model")} placeholder="Swift / Brezza / Ertiga…" />
          </Field>
          <Field label="KM at gate">
            <Input value={f.km_in} onChange={set("km_in")} inputMode="numeric" />
          </Field>
          <Field label="Purpose">
            <Select value={f.purpose} onChange={set("purpose")}>
              {PURPOSES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Job card / appointment no.">
            <Input value={f.jc_no} onChange={set("jc_no")} />
          </Field>
          <Field label="Brought by">
            <Input value={f.brought_by} onChange={set("brought_by")} placeholder="Customer / driver name" />
          </Field>
          <Field label="Service advisor">
            <Input value={f.sa_name} onChange={set("sa_name")} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <TextArea value={f.notes} onChange={set("notes")} />
          </Field>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button size="lg" busy={saving} onClick={() => void save()} disabled={!locationId}>
              Save gate in
            </Button>
            {!vehicle ? <Note tone="info">The vehicle photograph is kept in the central AEBrain media store.</Note> : null}
          </div>
        </div>
      </div>
    </Section>
  );
}
