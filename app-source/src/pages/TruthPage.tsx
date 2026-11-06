import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { truthBoard, type TruthRow } from "@/app/api";
import { Badge, Empty, Note, Table, Td } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";

/**
 * Maruti truth (Ravi 17-10-2026): one reconciled row per job card - DMS (open / invoiced / amount) + our cameras
 * (first / last seen) + the customer's own answer - and the exceptions from it, each with its owner from the
 * escalation matrix by age. Holdup law (17-10): no invoice in DMS = holdup; invoiced = with the customer; nothing
 * in between. Every source shows its own data date - the board is only as fresh as its oldest source.
 */
const KINDS: Array<[string, string, string]> = [
  ["CUSTOMER_HAS_VEHICLE_JC_OPEN", "Customer has it, JC open", "With the customer (their answer, or off our cameras for 2+ watched days) but DMS has no invoice."],
  ["INVOICED_BUT_ON_OUR_CAMERA", "Invoiced, still here", "DMS has the invoice but the vehicle was on our camera 2-10 days later (or the customer says it is with us), no new JC."],
  ["PAID_NO_GST_BILL", "Paid, no GST bill", "The customer paid and says no GST bill was given. Money - CEO."],
  ["PAID_NOT_EQUAL_DMS", "Paid ≠ DMS", "What the customer paid is not the DMS bill. Money - CEO."],
  ["CAMERA_ENTRY_NO_JC", "Camera, no JC", "A known customer vehicle was inside (3+ reads) and DMS has no JC within 3 days (only up to the DMS date minus 3 days)."],
  ["PARTS_HOLDUP", "Parts holdup", "DMS holdup reason is parts (PNA) and still no invoice."],
];

const day = (v: unknown) => (typeof v === "string" && v ? fmtDateTime(v).slice(0, 10) : "—");
const when = (v: unknown) => (typeof v === "string" && v ? fmtDateTime(v) : "—");
const old = (v: unknown) => typeof v === "string" && v !== "" && Date.now() - new Date(v).getTime() > 3 * 86400000;

export default function TruthPage() {
  const [tab, setTab] = useState(KINDS[0][0]);
  const [q, setQ] = useState("");
  const { data, error, isLoading } = useQuery({ queryKey: ["truth-board"], queryFn: () => truthBoard(null), staleTime: 5 * 60_000 });

  if (isLoading) return <div className="p-4 text-muted">Opening…</div>;
  if (error) return <div className="p-4"><Note tone="danger">{(error as Error).message}</Note></div>;
  const s = data?.sources ?? {};
  const counts = data?.counts ?? {};
  const kind = KINDS.find((k) => k[0] === tab) ?? KINDS[0];
  const qq = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const rows = (data?.rows ?? []).filter(
    (r: TruthRow) => r.kind === tab && (!qq || `${r.reg_no ?? ""}${r.jc_no ?? ""}`.toUpperCase().includes(qq)),
  );
  const cov = (s.camera_covered ?? {}) as Record<string, string>;
  const src: Array<[string, unknown, boolean]> = [
    ["DMS job cards to", s.dms_jc_to, true],
    ["DMS billing to", s.dms_billing_to, true],
    ["DMS holdup to", s.dms_holdup_to, true],
    ["Cameras last read", s.camera_last, false],
    ["Board refreshed", s.refreshed_at, false],
  ];

  return (
    <div className="mx-auto flex h-full max-w-[1300px] flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-2 text-[12px]">
        {src.map(([label, v, dateOnly]) => (
          <span key={label} className={`rounded px-2 py-1 ${old(v) ? "bg-red-700 text-white" : "bg-surface"}`}>
            {label}: <b>{dateOnly ? day(v) : when(v)}</b>
          </span>
        ))}
        {Object.keys(cov).length > 0 && (
          <span className="rounded bg-surface px-2 py-1">
            Fully watched: {Object.entries(cov).map(([w, d]) => `${w} ${day(d)}`).join(", ")}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1 border-b border-line">
        {KINDS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-[13px] font-bold ${tab === k ? "border-b-2 border-accent text-accent" : "text-muted"}`}
          >
            {label} <Badge tone={/^PAID/.test(k) && counts[k] ? "danger" : "muted"}>{counts[k] ?? 0}</Badge>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Reg / JC"
          className="w-40 rounded-lg border border-line bg-raised px-3 py-1.5 text-[14px]"
        />
        <span className="text-[12px] text-muted">{kind[2]}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <Empty>Nothing here.</Empty>
        ) : (
          <Table head={["Vehicle / JC", "Workshop", "What we saw", "Age", "Owner now", "Sources"]}>
            {rows.map((r) => (
              <tr key={r.id} className={r.money ? "bg-red-50 dark:bg-red-950" : ""}>
                <Td className="whitespace-nowrap font-bold">
                  {r.reg_no ?? "—"}
                  <div className="text-[11px] font-normal text-muted">{r.jc_no ?? "no JC"}</div>
                </Td>
                <Td>{r.workshop}</Td>
                <Td>
                  {r.fact}
                  <div className="text-[11px] text-muted">since {when(r.fact_at)}</div>
                </Td>
                <Td className={`whitespace-nowrap font-bold ${(r.age_days ?? 0) >= 7 ? "text-red-600" : (r.age_days ?? 0) >= 2 ? "text-amber-600" : ""}`}>
                  {r.age_days == null ? "—" : `${r.age_days} d`}
                </Td>
                <Td>
                  <b>{r.owner_role ?? "—"}</b>
                  {r.owner_person ? <div>{r.owner_person}</div> : null}
                  <div className="text-[11px] text-muted">
                    level {r.owner_level ?? 1}
                    {r.top_role && r.top_role !== r.owner_role ? ` · then ${r.top_role}` : ""}
                  </div>
                </Td>
                <Td className="text-[11px] text-muted">
                  {Object.entries(r.sources ?? {})
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        {k.replace(/_/g, " ")}: {when(v)}
                      </div>
                    ))}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
