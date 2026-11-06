import { useState } from "react";
import { useUi } from "@/app/store";
import { useGateIn, useGateOut, useLocations, useTrips } from "@/hooks/useQueries";
import { Badge, Button, Empty, Field, Input, Section, Table, Td } from "@/components/ui";
import { fmtDateDMY, fmtTime, todayIst } from "@/lib/dates";
import { fmtKm } from "@/lib/geo";
import { inr } from "@/lib/money";
import { prettyReg } from "@/lib/plate";
import { PhotoLink } from "./gate/GateTables";

/** Day-wise money and movements. Tables, not cards. Latest first. Print = the daily sheet. */
export default function LedgerPage() {
  const locationId = useUi((s) => s.locationId);
  const [day, setDay] = useState(todayIst());
  const { data: trips = [] } = useTrips({ locationId, day });
  const { data: gin = [] } = useGateIn({ locationId, day });
  const { data: gout = [] } = useGateOut({ locationId, day });
  const { data: locations = [] } = useLocations();
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";

  const done = trips.filter((t) => t.status === "done");
  const payable = done.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const km = trips.filter((t) => t.status !== "cancelled").reduce((s, t) => s + (Number(t.distance_km) || 0), 0);
  const receipts = gout.reduce((s, g) => s + (Number(g.receipt_amount) || 0), 0);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <Field label="Day">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value || todayIst())} className="!w-auto" />
        </Field>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted">
            {locationId ? locName(locationId) : "All workshops"} · {fmtDateDMY(day)}
          </span>
          <Button tone="secondary" onClick={() => window.print()}>
            🖨️ Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Trips", String(trips.length)],
          ["KM", km.toFixed(1)],
          ["Driver payable", inr(payable)],
          ["Receipts at gate", inr(receipts)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-raised px-4 py-3">
            <div className="text-[11px] font-bold uppercase text-muted">{l}</div>
            <div className="text-[20px] font-extrabold text-brand dark:text-accent">{v}</div>
          </div>
        ))}
      </div>

      <Section
        title={`Driver pick & drop · ${trips.length}`}
        sub="Each row carries the rate card it was priced with, so a later rate change never rewrites it."
      >
        {trips.length === 0 ? (
          <Empty>No trips on this day.</Empty>
        ) : (
          <Table head={["Time", "Driver", "Type", "Customer", "Vehicle", "Route", "KM", "Rate", "Amount", "Status", "Workshop"]}>
            {trips.map((t) => (
              <tr key={t.id}>
                <Td>{fmtTime(t.started_at ?? t.created_at)}</Td>
                <Td className="font-bold">{t.driver_name}</Td>
                <Td>{t.kind}</Td>
                <Td>{t.customer_name ?? "—"}</Td>
                <Td className="font-mono">{prettyReg(t.reg_no)}</Td>
                <Td className="max-w-[240px]">
                  <div className="truncate">{t.pick_address}</div>
                  <div className="truncate text-muted">→ {t.drop_address}</div>
                </Td>
                <Td>
                  {fmtKm(t.distance_km)}
                  <div className="text-[10px] text-muted">{t.distance_source ?? ""}</div>
                </Td>
                <Td>{t.rate_snapshot ? `${inr(t.rate_snapshot.per_km)}/km` : "—"}</Td>
                <Td className="font-extrabold text-ok">{inr(t.amount)}</Td>
                <Td>
                  <Badge tone={t.status === "done" ? "ok" : t.status === "running" ? "warn" : t.status === "planned" ? "brand" : "muted"}>
                    {t.status}
                  </Badge>
                </Td>
                <Td>{locName(t.location_id)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title={`Gate movements · ${gin.length} in / ${gout.length} out`}>
        {gin.length + gout.length === 0 ? (
          <Empty>No gate movement on this day.</Empty>
        ) : (
          <Table head={["Time", "Movement", "Reg no.", "Customer / pass", "Receipt", "Amount", "KM", "Photos", "Workshop"]}>
            {[...gin.map((g) => ({ k: "in" as const, at: g.in_at, g })), ...gout.map((g) => ({ k: "out" as const, at: g.out_at, g }))]
              .sort((a, b) => (a.at < b.at ? 1 : -1))
              .map((r) =>
                r.k === "in" ? (
                  <tr key={`in-${r.g.id}`}>
                    <Td>{fmtTime(r.g.in_at)}</Td>
                    <Td>
                      <Badge tone="brand">IN</Badge>
                    </Td>
                    <Td className="font-mono font-bold">{prettyReg(r.g.reg_no)}</Td>
                    <Td>{r.g.customer_name ?? "—"}</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>{r.g.km_in ?? "—"}</Td>
                    <Td>
                      <PhotoLink path={r.g.photo_vehicle} label="vehicle" />
                    </Td>
                    <Td>{locName(r.g.location_id)}</Td>
                  </tr>
                ) : (
                  <tr key={`out-${r.g.id}`}>
                    <Td>{fmtTime(r.g.out_at)}</Td>
                    <Td>
                      <Badge tone="ok">OUT</Badge>
                    </Td>
                    <Td className="font-mono font-bold">{prettyReg(r.g.reg_no)}</Td>
                    <Td>pass {r.g.gate_pass_no ?? "—"}</Td>
                    <Td>{r.g.receipt_no ?? "—"}</Td>
                    <Td>{inr(r.g.receipt_amount)}</Td>
                    <Td>{r.g.km_out ?? "—"}</Td>
                    <Td className="space-x-2">
                      <PhotoLink path={r.g.photo_vehicle} label="vehicle" />
                      <PhotoLink path={r.g.photo_gate_pass} label="pass" />
                      <PhotoLink path={r.g.photo_receipt} label="receipt" />
                    </Td>
                    <Td>{locName(r.g.location_id)}</Td>
                  </tr>
                ),
              )}
          </Table>
        )}
      </Section>
    </div>
  );
}
