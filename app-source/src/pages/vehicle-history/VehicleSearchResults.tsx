import { Fragment } from "react";
import { Badge, Table, Td } from "@/components/ui";
import { openKeyOf, type VhSearchResult } from "@/app/vehicleHistoryApi";

/*
  The smart-search answer as a TABLE (never cards). Tapping a row opens that vehicle's report.
  Wide screens get the eight columns; a phone gets three (vehicle / customer / visits) that carry
  the same eight facts, so nothing needs sideways scrolling. A missing field is left blank.
*/

const text = (s?: string) => s?.trim() ?? "";

function MatchedOn({ list }: { list?: string[] }) {
  if (!list?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.map((m) => (
        <Badge key={m} tone="brand">
          {m.replace(/_/g, " ")}
        </Badge>
      ))}
    </span>
  );
}

function RegButton({ row, onOpen }: { row: VhSearchResult; onOpen: (r: VhSearchResult) => void }) {
  const key = openKeyOf(row);
  const reg = text(row.registration);
  const label = reg || text(row.vin);
  if (!key) return <span className="font-mono text-[14px] font-extrabold text-muted">{label}</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(row);
      }}
      className={`min-h-[44px] text-left font-mono font-extrabold text-accent underline underline-offset-2 ${reg ? "text-[15px]" : "text-[12px]"}`}
      aria-label={`Open ${label}`}
    >
      {label}
    </button>
  );
}

export function SearchResults({ rows, phone, onOpen }: { rows: VhSearchResult[]; phone: boolean; onOpen: (r: VhSearchResult) => void }) {
  const rowCls = (r: VhSearchResult) => `${openKeyOf(r) ? "cursor-pointer hover:bg-surface" : ""}`;
  const go = (r: VhSearchResult) => {
    if (openKeyOf(r)) onOpen(r);
  };

  return (
    <div className="h-full overflow-y-auto p-2">
      {phone ? (
        <Table head={["Vehicle", "Customer", "Visits"]}>
          {rows.map((r, i) => (
            <Fragment key={`${r.registration ?? ""}|${r.vin ?? ""}|${i}`}>
              <tr onClick={() => go(r)} className={rowCls(r)}>
                <Td className="max-w-[150px] !border-b-0 [overflow-wrap:anywhere]">
                  <RegButton row={r} onOpen={onOpen} />
                  <div className="text-[12.5px] font-semibold text-ink">{[text(r.model), text(r.variant)].filter(Boolean).join(" ")}</div>
                  {text(r.brand_name) ? <div className="text-[12px] text-muted">{text(r.brand_name)}</div> : null}
                  <div className="mt-1">
                    <MatchedOn list={r.matched_on} />
                  </div>
                </Td>
                <Td className="max-w-[150px] !border-b-0 [overflow-wrap:anywhere]">
                  <div className="text-[14px] font-bold text-ink">{text(r.customer_name)}</div>
                  <div className="font-mono text-[13px] text-ink">{text(r.mobile)}</div>
                  <div className="text-[12px] text-muted">{text(r.city)}</div>
                </Td>
                <Td className="!border-b-0 text-[16px] font-extrabold tabular-nums text-ink">{r.visits ?? ""}</Td>
              </tr>
              <tr onClick={() => go(r)} className={rowCls(r)}>
                <Td colSpan={3} className="pt-0 text-[12.5px] text-muted [overflow-wrap:anywhere]">
                  {text(r.last_visit) || text(r.last_dealer) ? (
                    <>
                      Last visit <span className="font-semibold text-ink">{text(r.last_visit)}</span>
                      {text(r.last_dealer) ? <> at {text(r.last_dealer)}</> : null}
                    </>
                  ) : null}
                </Td>
              </tr>
            </Fragment>
          ))}
        </Table>
      ) : (
        <Table head={["Registration", "Customer", "Mobile", "Model", "Visits", "Last visit", "Last dealer", "Matched on"]}>
          {rows.map((r, i) => (
            <tr key={`${r.registration ?? ""}|${r.vin ?? ""}|${i}`} onClick={() => go(r)} className={rowCls(r)}>
              <Td>
                <RegButton row={r} onOpen={onOpen} />
              </Td>
              <Td>
                <div className="font-bold text-ink">{text(r.customer_name)}</div>
                <div className="text-[12px] text-muted">{text(r.city)}</div>
              </Td>
              <Td className="font-mono">{text(r.mobile)}</Td>
              <Td>
                <div className="font-semibold text-ink">{text(r.model)}</div>
                <div className="text-[12px] text-muted">{[text(r.brand_name), text(r.variant)].filter(Boolean).join(" · ")}</div>
              </Td>
              <Td className="font-extrabold tabular-nums">{r.visits ?? ""}</Td>
              <Td className="whitespace-nowrap">{text(r.last_visit)}</Td>
              <Td className="max-w-[280px]">{text(r.last_dealer)}</Td>
              <Td>
                <MatchedOn list={r.matched_on} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
