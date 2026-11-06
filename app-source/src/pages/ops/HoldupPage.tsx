import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { holdupBoard, type HoldupRow } from "@/app/api";
import { Empty, Input, Note, Segmented, Stat, Table, Td } from "@/components/ui";
import { fmtDateDMY, fmtDateTime } from "@/lib/dates";

/**
 * Holdup list under THE HOLDUP LAW (Ravi 17-10-2026): HOLDUP = no invoice in the DMS. A row of the latest DMS
 * holdup file whose job card already has a bill date is INVOICED - the vehicle is with the customer - so it is not
 * listed, only counted. Server: mar_holdup_board() (0211). The file date is shown first: the list is only as fresh
 * as the feed.
 */
type Tab = "list" | "reasons" | "workshops";

export default function HoldupPage() {
  const [tab, setTab] = useState<Tab>("list");
  const [ws, setWs] = useState<string>("");
  const [q, setQ] = useState("");
  const { data, error, isLoading } = useQuery({ queryKey: ["mar-holdup"], queryFn: () => holdupBoard(null), staleTime: 5 * 60_000 });

  const rows = useMemo(() => {
    const qq = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return (data?.rows ?? []).filter(
      (r: HoldupRow) => (!ws || r.workshop === ws) && (!qq || `${r.reg_no ?? ""}${r.jc_no ?? ""}`.toUpperCase().replace(/[^A-Z0-9]/g, "").includes(qq)),
    );
  }, [data, ws, q]);

  if (isLoading) return <div className="p-4 text-muted">Opening the holdup list…</div>;
  if (error) return <div className="p-4"><Note tone="danger">{(error as Error).message}</Note></div>;
  if (!data) return null;
  const stale = (data.age_days ?? 99) > 1;
  const workshops = Object.keys(data.by_workshop).sort();

  return (
    <div className="space-y-3">
      <Note tone={stale ? "warn" : "ok"}>
        DMS holdup file of <b>{data.file_date ? fmtDateDMY(data.file_date) : "—"}</b>
        {stale ? ` - ${data.age_days} days old. The daily Maruti BI pull has not run since; numbers below are of that day.` : " - today's file."}{" "}
        Loaded {fmtDateTime(data.loaded_at)}.
      </Note>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Holdup (no invoice)" value={data.holdup} tone="warn" />
        <Stat label="In the DMS file" value={data.in_file} />
        <Stat label="Invoiced - with customer, left the list" value={data.invoiced_left} tone="ok" />
        <Stat label="Workshops with holdup" value={workshops.length} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "list", label: `Holdup list · ${rows.length}` },
            { value: "reasons", label: "Where stuck" },
            { value: "workshops", label: "By workshop" },
          ]}
        />
        {tab === "list" ? (
          <>
            <select value={ws} onChange={(e) => setWs(e.target.value)} className="rounded-lg border border-line bg-raised px-2 py-2 text-[13px]" aria-label="Workshop">
              <option value="">All workshops</option>
              {workshops.map((w) => (
                <option key={w} value={w}>
                  {w} · {data.by_workshop[w]}
                </option>
              ))}
            </select>
            <div className="w-48">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reg no or JC" aria-label="Search" />
            </div>
          </>
        ) : null}
      </div>

      {tab === "list" ? (
        rows.length ? (
          <div className="max-h-[56vh] overflow-auto">
            <Table head={["Workshop", "JC", "Reg no", "Model", "Service", "Reason", "Days open", "Promised", "Beyond promise", "Payable by"]}>
              {rows.map((r, i) => (
                <tr key={`${r.jc_no}-${i}`} className="hover:bg-surface">
                  <Td>{r.workshop}</Td>
                  <Td className="font-mono text-[12px]">{r.jc_no ?? "—"}</Td>
                  <Td className="font-bold">{r.reg_no ?? "—"}</Td>
                  <Td>{r.model ?? "—"}</Td>
                  <Td>{r.service_type ?? "—"}</Td>
                  <Td>{r.reason ?? "—"}</Td>
                  <Td className="tabular-nums">{r.days_open ?? "—"}</Td>
                  <Td>{r.promised ? fmtDateDMY(r.promised) : "—"}</Td>
                  <Td className="tabular-nums">{r.beyond_promise ?? "—"}</Td>
                  <Td>{r.payable_by ?? "—"}</Td>
                </tr>
              ))}
            </Table>
          </div>
        ) : (
          <Empty>No holdup vehicle matches this filter.</Empty>
        )
      ) : tab === "reasons" ? (
        <Table head={["Reason (DMS)", "Vehicles"]}>
          {data.by_reason.map((r) => (
            <tr key={r.reason}>
              <Td>{r.reason}</Td>
              <Td className="tabular-nums font-bold">{r.n}</Td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table head={["Workshop", "Holdup vehicles"]}>
          {workshops.map((w) => (
            <tr key={w}>
              <Td>{w}</Td>
              <Td className="tabular-nums font-bold">{data.by_workshop[w]}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
