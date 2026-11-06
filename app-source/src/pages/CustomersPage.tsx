import { Fragment, useState } from "react";
import { saveCustomer, saveInteraction } from "@/app/api";
import { useUi } from "@/app/store";
import type { Customer, InteractionKind } from "@/app/types";
import { useCustomers, useInteractions, useInvalidate } from "@/hooks/useQueries";
import { Badge, Button, Empty, Field, Input, Note, Section, Segmented, Select, Table, Td, TextArea, flash } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";

/*
  CUSTOMERS - the salesperson owns name + mobile (Ravi's brief). The server enforces it:
  another salesperson, the guard and reception are refused; a GM and above may correct
  only with a reason, and every change of name / mobile / owner is written to the audit.
*/

const KINDS: { value: InteractionKind; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "test_drive", label: "Test drive" },
  { value: "finance", label: "Finance" },
  { value: "quotation", label: "Quotation" },
  { value: "follow_up", label: "Follow-up" },
];

function CustomerForm({ c, locationId, onDone }: { c: Partial<Customer> | null; locationId: string | null; onDone: () => void }) {
  const me = useUi((s) => s.me)!;
  const [f, setF] = useState<Partial<Customer>>(c ?? { name: "", mobile: "", area: "", is_test: false });
  const [busy, setBusy] = useState(false);
  const notMine = !!c?.id && c.owner_profile_id !== me.profile_id;
  async function save() {
    let reason: string | undefined;
    if (notMine) {
      const r = window.prompt("This customer belongs to another salesperson. Reason for the correction (kept in the audit):", "");
      if (!r) return;
      reason = r;
    }
    setBusy(true);
    try {
      await saveCustomer({ ...f, location_id: f.location_id ?? locationId }, reason);
      flash(c?.id ? "Customer corrected (audited)" : "Customer added");
      onDone();
    } catch (e) {
      flash((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title={c?.id ? `Correct · ${c.name}` : "New customer"} sub={notMine ? "Senior correction - a reason is required and recorded." : "You become the owner of this customer."}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name">
          <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Mobile (10 digits)">
          <Input inputMode="numeric" value={f.mobile ?? ""} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
        </Field>
        <Field label="Area">
          <Input value={f.area ?? ""} onChange={(e) => setF({ ...f, area: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        {!c?.id ? (
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={!!f.is_test} onChange={(e) => setF({ ...f, is_test: e.target.checked })} /> Test record
          </label>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button tone="secondary" onClick={onDone}>
            Close
          </Button>
          <Button busy={busy} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </Section>
  );
}

function Timeline({ c }: { c: Customer }) {
  const { data = [] } = useInteractions({ customerId: c.id });
  const invalidate = useInvalidate();
  const [kind, setKind] = useState<InteractionKind>("note");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <div className="grid gap-2 sm:grid-cols-[140px_1fr_200px_auto]">
        <Select value={kind} onChange={(e) => setKind(e.target.value as InteractionKind)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
        <TextArea rows={1} placeholder="What happened / what was agreed" value={body} onChange={(e) => setBody(e.target.value)} />
        <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} title="Follow-up date (optional)" />
        <Button
          busy={busy}
          onClick={async () => {
            if (!body.trim()) return;
            setBusy(true);
            try {
              await saveInteraction({
                customer_id: c.id,
                location_id: c.location_id,
                kind,
                body: body.trim(),
                due_at: due ? new Date(due).toISOString() : null,
                is_test: c.is_test,
              });
              setBody("");
              setDue("");
              invalidate("interactions");
            } catch (e) {
              flash((e as Error).message, "danger");
            } finally {
              setBusy(false);
            }
          }}
        >
          Add
        </Button>
      </div>
      {data.length === 0 ? (
        <p className="text-[12.5px] text-muted">Nothing recorded yet.</p>
      ) : (
        data.map((i) => (
          <div key={i.id} className="flex flex-wrap items-start gap-2 text-[13px]">
            <Badge tone={i.source === "sense" ? "brand" : "muted"}>{i.kind.replace("_", " ")}</Badge>
            <span className="flex-1">{i.body}</span>
            {i.due_at ? (
              <span className={i.done_at ? "text-muted line-through" : "font-bold text-warn"}>due {fmtDateTime(i.due_at)}</span>
            ) : null}
            {i.due_at && !i.done_at ? (
              <Button
                size="sm"
                tone="ok"
                onClick={async () => {
                  try {
                    await saveInteraction({ id: i.id, done_at: new Date().toISOString() });
                    invalidate("interactions");
                  } catch (e) {
                    flash((e as Error).message, "danger");
                  }
                }}
              >
                ✓ Done
              </Button>
            ) : null}
            <span className="text-[11px] text-muted">{fmtDateTime(i.created_at)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function FollowUpsDue() {
  const me = useUi((s) => s.me)!;
  const { data = [] } = useInteractions({ mineOpen: me.profile_id });
  const due = data.filter((i) => i.due_at).sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1));
  if (!due.length) return null;
  return (
    <Section title={`My follow-ups · ${due.length}`} sub="Open follow-ups you set, earliest first.">
      {due.slice(0, 20).map((i) => (
        <div key={i.id} className="flex gap-2 border-b border-line py-1.5 text-[13px] last:border-0">
          <span className={new Date(i.due_at!) < new Date() ? "font-bold text-danger" : "font-bold text-warn"}>{fmtDateTime(i.due_at)}</span>
          <Badge>{i.kind.replace("_", " ")}</Badge>
          <span className="flex-1">{i.body}</span>
        </div>
      ))}
    </Section>
  );
}

export default function CustomersPage() {
  const me = useUi((s) => s.me)!;
  const locationId = useUi((s) => s.locationId);
  const [scope, setScope] = useState<"mine" | "all">(me.role === "sales" ? "mine" : "all");
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Partial<Customer> | null | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data = [], isLoading } = useCustomers({ locationId, search, mine: scope === "mine" ? me.profile_id : null });
  const invalidate = useInvalidate();
  const canEdit = ["sales", "ccm"].includes(me.role ?? "") || me.rank >= 70;

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: "mine", label: "My customers" },
            { value: "all", label: "Workshop" },
          ]}
        />
        <div className="flex gap-2">
          <Input placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} className="!w-56" />
          {canEdit ? <Button onClick={() => setEdit(null)}>+ Customer</Button> : null}
        </div>
      </div>
      {!canEdit ? <Note>Customer details are kept by the sales executive. You can read them and add notes on visits.</Note> : null}
      {edit !== undefined ? (
        <CustomerForm
          c={edit}
          locationId={locationId}
          onDone={() => {
            setEdit(undefined);
            invalidate("customers");
          }}
        />
      ) : null}
      {scope === "mine" ? <FollowUpsDue /> : null}
      <Section title={`Customers · ${data.length}`}>
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : data.length === 0 ? (
          <Empty>No customer yet.</Empty>
        ) : (
          <Table head={["Name", "Mobile", "Area", "Since", ""]}>
            {data.map((c) => (
              <Fragment key={c.id}>
                <tr className="hover:bg-surface">
                  <Td className="font-bold">
                    {c.name} {c.is_test ? <Badge tone="warn">test</Badge> : null}
                    {c.owner_profile_id === me.profile_id ? <div className="text-[10px] text-ok">yours</div> : null}
                  </Td>
                  <Td>{c.mobile ?? "—"}</Td>
                  <Td>{c.area ?? "—"}</Td>
                  <Td>{fmtDateTime(c.created_at)}</Td>
                  <Td className="space-x-1 whitespace-nowrap">
                    <Button size="sm" tone="ghost" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                      Timeline
                    </Button>
                    {canEdit ? (
                      <Button size="sm" tone="secondary" onClick={() => setEdit(c)}>
                        Edit
                      </Button>
                    ) : null}
                  </Td>
                </tr>
                {openId === c.id ? (
                  <tr>
                    <td colSpan={5} className="px-3 pb-3">
                      <Timeline c={c} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
