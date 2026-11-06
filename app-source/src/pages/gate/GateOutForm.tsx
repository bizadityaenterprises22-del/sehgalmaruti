import { useMemo, useState } from "react";
import { createGateOut, updateGateOut, uploadPhoto } from "@/app/api";
import { useGateIn, useInvalidate } from "@/hooks/useQueries";
import { Button, Field, Input, Note, PhotoSlot, Section, Select, TextArea, flash } from "@/components/ui";
import { cleanReg, extractAmount, extractPassNo, extractReceiptNo, extractRegs, isKnownRegFormat, prettyReg } from "@/lib/plate";
import { fmtTime } from "@/lib/dates";
import { ocrLine, useDocumentOcr, usePlateOcr } from "./usePlateOcr";

/**
 * Gate Out = three photographs: the vehicle (plate read by OCR), the gate pass (its number
 * and the registration read as a second witness) and the receipt (number and amount).
 * All three are kept in the private bucket and registered in media_store - the central
 * AEBrain resource the camera app and Vehicle History read by registration.
 */
export default function GateOutForm({ locationId }: { locationId: string | null }) {
  const invalidate = useInvalidate();
  const { data: open = [] } = useGateIn({ locationId, openOnly: true });
  const plate = usePlateOcr();
  const passOcr = useDocumentOcr();
  const receiptOcr = useDocumentOcr();

  const [gateInId, setGateInId] = useState("");
  const [reg, setReg] = useState("");
  const [regFromOcr, setRegFromOcr] = useState<{ text: string; confidence: number } | null>(null);
  const [vehicle, setVehicle] = useState<Blob | null>(null);
  const [pass, setPass] = useState<Blob | null>(null);
  const [receipt, setReceipt] = useState<Blob | null>(null);
  const [passText, setPassText] = useState<string | null>(null);
  const [receiptText, setReceiptText] = useState<string | null>(null);
  const [f, setF] = useState({ km_out: "", gate_pass_no: "", receipt_no: "", receipt_amount: "", authorised_by: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const regClean = cleanReg(reg);
  const matches = useMemo(() => (regClean ? open.filter((g) => (g.reg_no ?? "").includes(regClean)) : open), [open, regClean]);
  const witness = useMemo(() => (passText ? extractRegs(passText) : []), [passText]);
  const witnessAgrees = witness.length ? witness.includes(regClean) : null;

  function pickGateIn(id: string) {
    setGateInId(id);
    const g = open.find((x) => x.id === id);
    if (g?.reg_no) {
      setReg(g.reg_no);
      setRegFromOcr(null);
    }
  }

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
      const g = open.find((x) => x.reg_no === r.reg);
      if (g) setGateInId(g.id);
    }
  }

  async function onPass(b: Blob | null) {
    setPass(b);
    setPassText(null);
    if (!b) {
      passOcr.reset();
      return;
    }
    const r = await passOcr.run(b);
    if (r) {
      setPassText(r.text);
      const no = extractPassNo(r.text);
      if (no && !f.gate_pass_no) setF((s) => ({ ...s, gate_pass_no: no }));
      const regs = extractRegs(r.text);
      if (regs.length === 1 && !reg) setReg(regs[0]);
    }
  }

  async function onReceipt(b: Blob | null) {
    setReceipt(b);
    setReceiptText(null);
    if (!b) {
      receiptOcr.reset();
      return;
    }
    const r = await receiptOcr.run(b);
    if (r) {
      setReceiptText(r.text);
      const no = extractReceiptNo(r.text);
      const amt = extractAmount(r.text);
      setF((s) => ({ ...s, receipt_no: s.receipt_no || no || "", receipt_amount: s.receipt_amount || (amt !== null ? String(amt) : "") }));
    }
  }

  async function save() {
    if (!locationId) return flash("Choose a workshop first.", "warn");
    const regNo = cleanReg(reg);
    if (!regNo) return flash("Registration number is required.", "warn");
    if (!vehicle || !pass || !receipt) return flash("All three photographs are required: vehicle, gate pass, receipt.", "warn");
    setSaving(true);
    try {
      const row = await createGateOut({
        location_id: locationId,
        gate_in_id: gateInId || null,
        reg_no: regNo,
        reg_no_ocr: regFromOcr?.text ?? null,
        reg_confidence: regFromOcr ? Math.min(0.999, Math.max(0, regFromOcr.confidence)) : null,
        reg_source: regFromOcr && cleanReg(regFromOcr.text) === regNo ? "ocr" : "manual",
        km_out: f.km_out ? Number(f.km_out) : null,
        gate_pass_no: f.gate_pass_no || null,
        gate_pass_ocr: passText,
        receipt_no: f.receipt_no || null,
        receipt_amount: f.receipt_amount ? Number(f.receipt_amount) : null,
        receipt_ocr: receiptText,
        authorised_by: f.authorised_by || null,
        notes: f.notes || null,
      });
      const base = { regNo, refTable: "mar_gate_out" as const, refId: row.id, locationId };
      const photo_vehicle = await uploadPhoto(vehicle, { ...base, kind: "gate_out_vehicle", ocrText: regFromOcr?.text ?? null });
      const photo_gate_pass = await uploadPhoto(pass, { ...base, kind: "gate_out_gate_pass", ocrText: passText });
      const photo_receipt = await uploadPhoto(receipt, { ...base, kind: "gate_out_receipt", ocrText: receiptText });
      await updateGateOut(row.id, { photo_vehicle, photo_gate_pass, photo_receipt });
      flash(`Gate out saved · ${prettyReg(regNo)} · 3 photos kept`);
      setGateInId("");
      setReg("");
      setRegFromOcr(null);
      setVehicle(null);
      setPass(null);
      setReceipt(null);
      setPassText(null);
      setReceiptText(null);
      plate.reset();
      passOcr.reset();
      receiptOcr.reset();
      setF({ km_out: "", gate_pass_no: "", receipt_no: "", receipt_amount: "", authorised_by: "", notes: "" });
      invalidate("gate-out", "gate-in", "stats");
    } catch (e) {
      flash(`Not saved: ${(e as Error).message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Gate Out"
      sub="Three photographs: the vehicle, the gate pass and the receipt. The plate, pass number, receipt number and amount are read automatically - confirm, then save."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <PhotoSlot
          label="1 · Vehicle (plate visible)"
          blob={vehicle}
          onBlob={(b) => void onVehicle(b)}
          status={ocrLine(plate.state)}
          required
          disabled={saving}
        />
        <PhotoSlot
          label="2 · Gate pass"
          blob={pass}
          onBlob={(b) => void onPass(b)}
          required
          disabled={saving}
          status={
            witness.length
              ? `${ocrLine(passOcr.state)} · pass shows ${witness.map(prettyReg).join(", ")}${witnessAgrees === false ? " ⚠ differs from the plate" : witnessAgrees ? " ✓ matches" : ""}`
              : ocrLine(passOcr.state)
          }
        />
        <PhotoSlot
          label="3 · Receipt"
          blob={receipt}
          onBlob={(b) => void onReceipt(b)}
          status={ocrLine(receiptOcr.state)}
          required
          disabled={saving}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Vehicle inside (open gate-ins)"
          className="lg:col-span-2"
          hint={
            open.length
              ? `${open.length} vehicle${open.length === 1 ? "" : "s"} currently inside this workshop`
              : "No open gate-in at this workshop - the gate out is still recorded."
          }
        >
          <Select value={gateInId} onChange={(e) => pickGateIn(e.target.value)}>
            <option value="">— not linked —</option>
            {matches.map((g) => (
              <option key={g.id} value={g.id}>
                #{g.entry_no} · {prettyReg(g.reg_no)} · {g.customer_name ?? "—"} · in {fmtTime(g.in_at)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Registration no."
          hint={regClean && !isKnownRegFormat(regClean) ? "Not a known Indian format - saved anyway." : regClean ? prettyReg(regClean) : ""}
        >
          <Input
            value={reg}
            onChange={(e) => setReg(e.target.value.toUpperCase())}
            placeholder="MH12AB1234"
            autoCapitalize="characters"
            className="font-mono text-[18px] font-extrabold tracking-wider"
          />
        </Field>
        <Field label="Gate pass no.">
          <Input value={f.gate_pass_no} onChange={set("gate_pass_no")} />
        </Field>
        <Field label="Receipt no.">
          <Input value={f.receipt_no} onChange={set("receipt_no")} />
        </Field>
        <Field label="Receipt amount (₹)">
          <Input value={f.receipt_amount} onChange={set("receipt_amount")} inputMode="decimal" />
        </Field>
        <Field label="KM at gate">
          <Input value={f.km_out} onChange={set("km_out")} inputMode="numeric" />
        </Field>
        <Field label="Authorised by">
          <Input value={f.authorised_by} onChange={set("authorised_by")} placeholder="SA / WM who released" />
        </Field>
        <Field label="Notes">
          <TextArea value={f.notes} onChange={set("notes")} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="lg" busy={saving} onClick={() => void save()} disabled={!locationId}>
          Save gate out
        </Button>
        <Note tone="info">
          The three photographs are saved to the central media register - the camera app and Vehicle History find them by
          registration.
        </Note>
      </div>
    </Section>
  );
}
