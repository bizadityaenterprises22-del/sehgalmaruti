import { useQuery } from "@tanstack/react-query";
import { feedFreshness } from "@/app/api";
import { Badge, Empty, Note, Table, Td } from "@/components/ui";
import { fmtDateDMY, fmtDateTime } from "@/lib/dates";

/**
 * The Maruti BI daily pull, one line per report: what day its data is of, when it was loaded, by which runner, and
 * the last try with its error. Server: maruti_feed_freshness() (hero-app 0130). Every BI-fed screen is only as
 * fresh as this list says.
 */
export default function FeedPage() {
  const { data = [], error, isLoading } = useQuery({ queryKey: ["mar-feed"], queryFn: feedFreshness, staleTime: 60_000 });
  if (isLoading) return <div className="p-4 text-muted">Opening the feed list…</div>;
  if (error) return <div className="p-4"><Note tone="danger">{(error as Error).message}</Note></div>;
  if (!data.length) return <Empty>No feed line came back.</Empty>;
  const stale = data.filter((d) => d.state !== "fresh").length;
  return (
    <div className="space-y-3">
      <Note tone={stale ? "warn" : "ok"}>
        {stale ? `${stale} of ${data.length} daily reports are not fresh.` : "All daily reports are fresh."} A report is fresh when its data is of today or yesterday.
      </Note>
      <Table head={["Report", "Data of", "State", "Age (days)", "Rows", "Loaded", "Runner", "Last try", "Last error"]}>
        {data.map((d) => (
          <tr key={d.source} className="hover:bg-surface">
            <Td className="font-bold">{d.label}</Td>
            <Td>{d.report_date ? fmtDateDMY(d.report_date) : "—"}</Td>
            <Td>
              <Badge tone={d.state === "fresh" ? "ok" : d.state === "stale" ? "warn" : "danger"}>{d.state}</Badge>
            </Td>
            <Td className="tabular-nums">{d.age_days ?? "—"}</Td>
            <Td className="tabular-nums">{d.rows_loaded ?? "—"}</Td>
            <Td>{fmtDateTime(d.loaded_at)}</Td>
            <Td>{d.runner ?? "—"}</Td>
            <Td>
              {fmtDateTime(d.last_try_at)} {d.last_try_status ? <span className="text-muted">({d.last_try_status})</span> : null}
            </Td>
            <Td className="max-w-[320px] text-[12px] text-muted">{d.last_error ?? "—"}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
