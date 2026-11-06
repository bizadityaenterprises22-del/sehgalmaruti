import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jcTat } from "@/app/api";
import { Note, Segmented, Stat, Table, Td } from "@/components/ui";
import { fmtDateDMY, fmtDateTime } from "@/lib/dates";

/**
 * Job cards and TAT from the DMS (BI report "JobCard TATs" -> maruti-feed -> dms_jc). Server: mar_jc_tat() (0211).
 * Same-day delivery = opened and INVOICED the same day (holdup law). The BI TAT report holds billed visits, so this
 * screen never claims a list of open job cards - that waits for a DMS JC-opening feed.
 */
type Tab = "day" | "type";
const DAYS = ["7", "30", "90"] as const;

export default function TatPage() {
  const [tab, setTab] = useState<Tab>("day");
  const [days, setDays] = useState<(typeof DAYS)[number]>("30");
  const [ws, setWs] = useState("");
  const { data, error, isLoading } = useQuery({
    queryKey: ["mar-tat", days, ws],
    queryFn: () => jcTat(Number(days), ws || null),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="p-4 text-muted">Opening job cards…</div>;
  if (error) return <div className="p-4"><Note tone="danger">{(error as Error).message}</Note></div>;
  if (!data) return null;
  const pct = data.opened ? Math.round((data.same_day * 100) / data.opened) : 0;
  const workshops = [...new Set(data.by_day.map((r) => r.workshop))].sort();

  return (
    <div className="space-y-3">
      <Note tone="warn">
        DMS data up to <b>{data.data_to ? fmtDateDMY(data.data_to) : "—"}</b> (loaded {fmtDateTime(data.loaded_at)}). Window{" "}
        {data.from ? fmtDateDMY(data.from) : "—"} to {data.data_to ? fmtDateDMY(data.data_to) : "—"}. The BI TAT report lists billed visits only.
      </Note>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Job cards opened" value={data.opened} />
        <Stat label="Invoiced" value={data.invoiced} tone="ok" />
        <Stat label="Same-day delivery" value={data.same_day} tone="ok" />
        <Stat label="Same-day %" value={`${pct} %`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: "day", label: "By day" }, { value: "type", label: "By service type" }]} />
        <Segmented value={days} onChange={setDays} options={DAYS.map((d) => ({ value: d, label: `${d} days` }))} />
        <select value={ws} onChange={(e) => setWs(e.target.value)} className="rounded-lg border border-line bg-raised px-2 py-2 text-[13px]" aria-label="Workshop">
          <option value="">All workshops</option>
          {(ws ? [ws] : workshops).map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>
      <div className="max-h-[52vh] overflow-auto">
        {tab === "day" ? (
          <Table head={["Date", "Workshop", "Opened", "Invoiced", "Same day"]}>
            {data.by_day.map((r) => (
              <tr key={`${r.d}-${r.workshop}`} className="hover:bg-surface">
                <Td>{fmtDateDMY(r.d)}</Td>
                <Td>{r.workshop}</Td>
                <Td className="tabular-nums">{r.opened}</Td>
                <Td className="tabular-nums">{r.invoiced}</Td>
                <Td className="tabular-nums">{r.same_day}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Table head={["Service type (DMS)", "Opened", "Invoiced"]}>
            {data.by_type.map((r) => (
              <tr key={r.service_type} className="hover:bg-surface">
                <Td>{r.service_type}</Td>
                <Td className="tabular-nums">{r.opened}</Td>
                <Td className="tabular-nums">{r.invoiced}</Td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
