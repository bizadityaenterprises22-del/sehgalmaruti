import { Fragment, useState } from "react";
import { createVisit, saveInteraction, updateVisit } from "@/app/api";
import { useUi } from "@/app/store";
import { ROLE_LABEL, type Visit, type VisitPurpose, type VisitStatus } from "@/app/types";
import { useInteractions, useInvalidate, useStaff, useVisits } from "@/hooks/useQueries";
import { Badge, Button, Empty, Field, Input, Note, Section, Segmented, Select, Table, Td, TextArea, flash } from "@/components/ui";
import { fmtTime, todayIst } from "@/lib/dates";
import { prettyReg } from "@/lib/plate";

/*
  RECEPTION + MY VISITS. A gate-in opens a visit by itself (database trigger), so the guard's
  vehicle shows here at once. Reception assigns it to an executive / adviser; the assignee
  sees it under "Mine". Visitor name/mobile here is what was SAID at reception - the
  customer master is the salesperson's (Customers tab).
*/

const STATUS_TONE: Record<VisitStatus, "brand" | "warn" | "ok" | "muted" | "danger"> = {
  arrived: "brand",
  waiting: "warn",
  with_staff: "ok",
  done: "muted",
  left: "muted",
  cancelled: "danger",
};
const PURPOSES: VisitPurpose[] = ["sales", "service", "bodyshop", "delivery", "other"];

function NewWalkIn({ locationId, onDone }: { locationId: string | null; onDone: () => void }) {
  const [f, setF] = useState({ visitor_name: "", visitor_mobile: "", reg_no: "", purpose: "sales" as VisitPurpose, notes: "", is_test: false });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!locationId) return flash("Choose a workshop at the top first.", "warn");
    if (!f.visitor_name.trim()) return flash("Visitor name is required.", "warn");
    setBusy(true);
    try {
      await createVisit({
        location_id: locationId,
        visitor_name: f.visitor_name.trim(),
        visitor_mobile: f.visitor_mobile.replace(/\D/g, "").slice(-10) || null,
        reg_no: f.reg_no.toUpperCase().replace(/[^A-Z0-9]/g, "") || null,
        purpose: f.purpose,
        notes: f.notes || null,
        is_test: f.is_test,
      });
      flash("Walk-in recorded");
      onDone();
    } catch (e) {
      flash((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="Walk-in without a vehicle" sub="A vehicle that came through the gate is already in the list below.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Visitor name">
          <Input value={f.visitor_name} onChange={(e) => setF({ ...f, visitor_name: e.target.value })} />
        </Field>
        <Field label="Mobile">
          <Input inputMode="numeric" value={f.visitor_mobile} onChange={(e) => setF({ ...f, visitor_mobile: e.target.value })} />
        </Field>
        <Field label="Purpose">
          <Select value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value as VisitPurpose })}>
            {PURPOSES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Vehicle no. (if any)">
          <Input value={f.reg_no} onChange={(e) => setF({ ...f, reg_no: e.target.value })} />
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={f.is_test} onChange={(e) => setF({ ...f, is_test: e.target.checked })} /> Test record
        </label>
        <Button busy={busy} onClick={() => void save()}>
          Record walk-in
        </Button>
      </div>
    </Section>
  );
}

function VisitNotes({ v }: { v: Visit }) {
  const { data = [] } = useInteractions({ visitId: v.id });
  const invalidate = useInvalidate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-line bg-surface p-2">
      {data.map((i) => (
        <div key={i.id} className="text-[12.5px]">
          <Badge tone={i.source === "sense" ? "brand" : "muted"}>{i.kind}</Badge> {i.body}{" "}
          <span className="text-muted">· {fmtTime(i.created_at)}</span>
        </div>
      ))}
      <div className="flex gap-2">
        <TextArea rows={1} placeholder="Add a note to this visit" value={text} onChange={(e) => setText(e.target.value)} />
        <Button
          size="sm"
          busy={busy}
          onClick={async () => {
            if (!text.trim()) return;
            setBusy(true);
            try {
              await saveInteraction({ visit_id: v.id, location_id: v.location_id, customer_id: v.customer_id, kind: v.purpose === "sales" ? "note" : "service_note", body: text.trim(), is_test: v.is_test });
              setText("");
              invalidate("interactions");
            } catch (e) {
              flash((e as Error).message, "danger");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export default function VisitsPage() {
  const me = useUi((s) => s.me)!;
  const locationId = useUi((s) => s.locationId);
  const [view, setView] = useState<"all" | "mine">(me.role === "reception" || me.rank >= 50 ? "all" : "mine");
  const day = todayIst();
  const { data: visits = [], isLoading } = useVisits(view === "mine" ? { assignedTo: me.profile_id, open: true } : { locationId, day });
  const { data: staff = [] } = useStaff(locationId);
  const invalidate = useInvalidate();
  const [open, setOpen] = useState<string | null>(null);
  const canAssign = ["reception", "sa", "wm", "ccm", "bsm"].includes(me.role ?? "") || me.rank >= 65;
  const nameOf = (id: string | null) => staff.find((s) => s.profile_id === id)?.display_name ?? (id ? "someone" : "—");

  async function patch(v: Visit, p: Partial<Visit>, msg: string) {
    try {
      await updateVisit(v.id, p);
      flash(msg);
      invalidate("visits");
    } catch (e) {
      flash((e as Error).message, "danger");
    }
  }

  const waiting = visits.filter((v) => v.status === "arrived" || v.status === "waiting").length;

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "all", label: `Today at this workshop` },
            { value: "mine", label: "Assigned to me" },
          ]}
        />
        <span className="text-[13px] text-muted">{waiting} waiting for someone</span>
      </div>
      {view === "all" && (me.role === "reception" || me.rank >= 50) ? <NewWalkIn locationId={locationId} onDone={() => invalidate("visits")} /> : null}
      <Section title={view === "mine" ? "My open visits" : `Visits today · ${visits.length}`} sub="Gate-in, walk-ins and appointments. One visit number follows the car to the gate-out.">
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : visits.length === 0 ? (
          <Empty>No visit yet.</Empty>
        ) : (
          <Table head={["#", "Status", "Visitor", "Vehicle", "Purpose", "Arrived", "With", "Actions"]}>
            {visits.map((v) => (
              <Fragment key={v.id}>
                <tr className="hover:bg-surface">
                  <Td className="font-bold">
                    {v.visit_no}
                    {v.is_test ? <div className="text-[10px] text-warn">TEST</div> : null}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[v.status]}>{v.status.replace("_", " ")}</Badge>
                  </Td>
                  <Td>
                    {v.visitor_name ?? "—"}
                    <div className="text-[11px] text-muted">{v.visitor_mobile ?? ""}</div>
                  </Td>
                  <Td>{v.reg_no ? prettyReg(v.reg_no) : "—"}{v.gate_in_id ? <div className="text-[10px] text-muted">via gate</div> : null}</Td>
                  <Td>{v.purpose}</Td>
                  <Td>{fmtTime(v.arrived_at)}</Td>
                  <Td>
                    {canAssign && !["done", "left", "cancelled"].includes(v.status) ? (
                      <Select
                        className="!w-auto !py-1 !text-[12px]"
                        value={v.assigned_to ?? ""}
                        onChange={(e) => {
                          const s = staff.find((x) => x.profile_id === e.target.value);
                          if (s) void patch(v, { assigned_to: s.profile_id, assigned_role: s.role }, `Given to ${s.display_name}`);
                        }}
                      >
                        <option value="">— choose —</option>
                        {staff
                          .filter((s) => !["guard", "driver"].includes(s.role))
                          .map((s) => (
                            <option key={s.profile_id} value={s.profile_id}>
                              {s.display_name} · {ROLE_LABEL[s.role] ?? s.role}
                            </option>
                          ))}
                      </Select>
                    ) : (
                      nameOf(v.assigned_to)
                    )}
                  </Td>
                  <Td className="space-x-1 whitespace-nowrap">
                    {v.status === "arrived" ? (
                      <Button size="sm" tone="secondary" onClick={() => void patch(v, { status: "waiting" }, "Marked waiting")}>
                        Waiting
                      </Button>
                    ) : null}
                    {v.status === "with_staff" && (v.assigned_to === me.profile_id || me.rank >= 50) ? (
                      <Button size="sm" tone="ok" onClick={() => void patch(v, { status: "done" }, "Visit done")}>
                        Done
                      </Button>
                    ) : null}
                    <Button size="sm" tone="ghost" onClick={() => setOpen(open === v.id ? null : v.id)}>
                      Notes
                    </Button>
                  </Td>
                </tr>
                {open === v.id ? (
                  <tr>
                    <td colSpan={8} className="px-3 pb-3">
                      <VisitNotes v={v} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </Table>
        )}
      </Section>
      <Note>Gate-out closes the visit by itself. A visit can be assigned only by reception, advisers and managers - the server refuses anyone else.</Note>
    </div>
  );
}
