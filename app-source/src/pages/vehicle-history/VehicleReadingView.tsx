import { Fragment, useState, type ReactNode } from "react";
import { Badge, Table, Td } from "@/components/ui";
import type { VehicleHistoryReport, VhVisit } from "@/lib/vehicle-history/types";
import { overviewOf, rupees } from "./vehicleOverview";

/*
  The phone-native READING VIEW of a Vehicle History report, built from the same
  VehicleHistoryReport JSON the Maruti-look PDF page view uses (nothing is shrunk).

  Layout (UI law: tabs, one panel, no long page): vehicle + customer summary on top, a tab strip
  (Overview first, then one tab per visit, newest first), and ONE panel below it - the only thing that scrolls.
  A value we do not hold is shown blank, never a placeholder.
*/

type Row = [label: string, value: ReactNode];

const text = (s?: string | null) => s?.trim() ?? "";

/** The newest non-blank value of a field across visits (customer/vehicle details are "as at that visit"). */
function newest(visits: VhVisit[], pick: (v: VhVisit) => string | undefined): string {
  for (const v of visits) {
    const t = text(pick(v));
    if (t) return t;
  }
  return "";
}

function newestAddress(visits: VhVisit[]): string {
  for (const v of visits) {
    const lines = (v.customer.address_lines ?? []).map(text).filter(Boolean);
    if (lines.length) return lines.join(", ");
  }
  return "";
}

const join = (parts: (string | undefined)[], sep: string) => parts.map(text).filter(Boolean).join(sep);

/** "V3 02/10/26" - the visit number and the date part of the printed job-card date. */
export function visitTabLabel(v: VhVisit): string {
  const day = text(v.jobcard.jobcard_date).split(" ")[0];
  return day ? `V${v.visit_no} ${day}` : `V${v.visit_no}`;
}

function KeyValue({ rows, pairs }: { rows: Row[]; pairs: boolean }) {
  const per = pairs ? 2 : 1;
  const chunks: Row[][] = [];
  for (let i = 0; i < rows.length; i += per) chunks.push(rows.slice(i, i + per));
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-raised">
      <table className="w-full table-fixed border-collapse text-[14px]">
        <colgroup>
          {pairs ? (
            <>
              <col className="w-[16%]" />
              <col className="w-[34%]" />
              <col className="w-[16%]" />
              <col className="w-[34%]" />
            </>
          ) : (
            <>
              <col className="w-[38%]" />
              <col className="w-[62%]" />
            </>
          )}
        </colgroup>
        <tbody>
          {chunks.map((c, i) => (
            <tr key={i} className="border-b border-line last:border-b-0">
              {c.map(([k, v]) => (
                <Fragment key={k}>
                  <th scope="row" className="break-words px-3 py-1.5 text-left align-top text-[12.5px] font-bold text-muted">
                    {k}
                  </th>
                  <td className="break-words px-3 py-1.5 align-top font-semibold text-ink">{v}</td>
                </Fragment>
              ))}
              {pairs && c.length === 1 ? (
                <>
                  <th />
                  <td />
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

// The file's own word, nothing less and nothing more (Ravi, 18-10-2026: "If it is CUS, then CUS, if CUSTOMER, then
// CUSTOMER"). Only the colour follows the payer.
function Billable({ type }: { type?: string }) {
  const t = text(type);
  if (!t) return null;
  const w = t.toLowerCase();
  return <Badge tone={w === "cus" || w === "customer" ? "brand" : w === "ins" || w === "insurance" ? "warn" : "muted"}>{t}</Badge>;
}

/**
 * The report's own header block (release 1.2) as a last "visit" to fall back on: a vehicle with no job card on record
 * (most Hero customers today) still shows its owner and details. Older reports have no header - nothing changes.
 */
function withHeader(report: VehicleHistoryReport): VhVisit[] {
  const header: VhVisit = {
    visit_no: 0,
    customer: report.customer ?? {},
    vehicle: report.vehicle ?? {},
    jobcard: {},
    demanded_repairs: [],
    parts: [],
    labour: [],
  };
  return [...report.visits, header];
}

function Summary({ report, phone }: { report: VehicleHistoryReport; phone: boolean }) {
  const [pick, setPick] = useState<boolean | null>(null);
  const open = pick ?? !phone; // a phone starts with the summary folded to one line
  const v = withHeader(report);
  const reg = text(report.registration);
  const modelVariant = join([newest(v, (x) => x.vehicle.model), newest(v, (x) => x.vehicle.variant)], " / ");
  const customer = newest(v, (x) => x.customer.name);
  const rows: Row[] = [
    ["Registration", reg],
    ["Make", text(report.brand_name)],
    ["Model / Variant", modelVariant],
    ["Chassis", newest(v, (x) => x.vehicle.chassis_no)],
    ["Engine", newest(v, (x) => x.vehicle.engine_no)],
    ["Sold by / date", join([newest(v, (x) => x.vehicle.sold_by), newest(v, (x) => x.vehicle.sold_date)], " / ")],
    ["Customer", customer],
    ["Mobile", newest(v, (x) => x.customer.mobile_phone)],
    ["Other phone", join([newest(v, (x) => x.customer.car_user_phone), newest(v, (x) => x.customer.res_phone)], ", ")],
    ["Email", newest(v, (x) => x.customer.email)],
    ["Address", newestAddress(v)],
  ];
  const headline = join([reg, modelVariant, customer], " · ");

  return (
    <div className="shrink-0">
      {phone ? (
        <button
          type="button"
          onClick={() => setPick(!open)}
          aria-expanded={open}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-ink/40 bg-raised px-3 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[12px] font-extrabold uppercase tracking-wide text-muted">Vehicle and customer</span>
            {open ? null : <span className="block truncate text-[14px] font-bold text-ink">{headline}</span>}
          </span>
          <span className="shrink-0 text-[14px] font-extrabold text-accent">{open ? "Hide ▴" : "Show ▾"}</span>
        </button>
      ) : null}
      {open ? (
        <div className={phone ? "mt-2 max-h-[40vh] overflow-y-auto" : ""}>
          <KeyValue rows={rows} pairs={!phone} />
        </div>
      ) : null}
    </div>
  );
}

function VisitPanel({ visit, phone }: { visit: VhVisit; phone: boolean }) {
  const jc = visit.jobcard;
  const psf = jc.psf;
  const psfText =
    psf && (text(psf.sa) || text(psf.cce) || text(psf.second)) ? `SA ${text(psf.sa)} / CCE ${text(psf.cce)} / 2nd ${text(psf.second)}` : "";
  const dealer = (
    <>
      {text(jc.dealer_code)}
      {text(jc.dealer_name) ? <div className="font-normal text-muted">{text(jc.dealer_name)}</div> : null}
    </>
  );
  const rows: Row[] = [
    ["Jobcard no.", text(jc.jobcard_number)],
    ["Date", text(jc.jobcard_date)],
    ["Service type", text(jc.service_type)],
    ["Dealer", dealer],
    ["Service advisor", text(jc.sa_name)],
    ["Mechanic", text(jc.mechanic_name)],
    ["TA", text(jc.ta_name)],
    ["Group", text(jc.group_name)],
    ["Mileage", text(jc.mileage)],
    ["Promised", text(jc.promised_date)],
    ["Ready", text(jc.ready_date)],
    ["CSI %", text(jc.csi_percent)],
    ["PSF", psfText],
    ["Attended through", text(jc.attended_through)],
    ["Bill no.", text(jc.bill_number)],
    ["Bill date", text(jc.bill_date)],
    ["Part amount", text(jc.part_amount)],
    ["Labour amount", text(jc.labour_amount)],
    ["Total amount", text(jc.total_amount)],
    ["Est. part", text(jc.est_part_amount)],
    ["Est. labour", text(jc.est_labour_amount)],
    ["Est. total", text(jc.est_total_amount)],
  ];
  const demanded = (visit.demanded_repairs ?? []).map(text).filter(Boolean);
  const parts = visit.parts ?? [];
  const labour = visit.labour ?? [];
  const remarks = (visit.remarks ?? []).map(text).filter(Boolean);
  const extras: Row[] = (visit.extras ?? [])
    .map((f): Row => [text(f.label), text(f.value)])
    .filter(([l, v]) => l !== "" && v !== "");
  const recs = text(visit.recommendations);
  const unapproved = text(visit.unapproved_fitments);

  return (
    <div className="space-y-4 p-2">
      <Block title="Job card">
        <KeyValue rows={rows} pairs={!phone} />
      </Block>

      {demanded.length ? (
        <Block title={`Demanded repairs · ${demanded.length}`}>
          <ol className="overflow-hidden rounded-lg border border-line bg-raised text-[14px]">
            {demanded.map((d, i) => (
              <li key={i} className="flex gap-3 border-b border-line px-3 py-2 last:border-b-0">
                <span className="w-6 shrink-0 font-bold tabular-nums text-muted">{i + 1}</span>
                <span className="min-w-0 break-words font-semibold text-ink">{d}</span>
              </li>
            ))}
          </ol>
        </Block>
      ) : null}

      {parts.length ? (
        <Block title={`Parts · ${parts.length}`}>
          <Table head={["Part no.", "Description", "Qty", "Type"]}>
            {parts.map((p, i) => (
              <tr key={i}>
                <Td className="font-mono text-[12px] font-bold">{text(p.part_number)}</Td>
                <Td className="break-words">{text(p.description)}</Td>
                <Td className="text-right tabular-nums">{text(p.quantity)}</Td>
                <Td>
                  <Billable type={p.billable_type} />
                </Td>
              </tr>
            ))}
          </Table>
        </Block>
      ) : null}

      {labour.length ? (
        <Block title={`Labour · ${labour.length}`}>
          <Table head={["Code", "Description", "Type"]}>
            {labour.map((l, i) => (
              <tr key={i}>
                <Td className="font-mono text-[12px] font-bold">{text(l.labour_code)}</Td>
                <Td className="break-words">{text(l.description)}</Td>
                <Td>
                  <Billable type={l.billable_type} />
                </Td>
              </tr>
            ))}
          </Table>
        </Block>
      ) : null}

      {recs ? (
        <Block title="Job card recommendations">
          <p className="whitespace-pre-line rounded-lg border border-line bg-raised px-3 py-2 text-[14px] font-semibold text-ink">{recs}</p>
        </Block>
      ) : null}

      {unapproved ? (
        <Block title="Unapproved fitments">
          <p className="whitespace-pre-line rounded-lg border border-line bg-raised px-3 py-2 text-[14px] font-semibold text-ink">
            {unapproved}
          </p>
        </Block>
      ) : null}

      {extras.length ? (
        <Block title="Additional">
          <KeyValue rows={extras} pairs={!phone} />
        </Block>
      ) : null}

      {remarks.length ? (
        <Block title="Remarks">
          <ul className="overflow-hidden rounded-lg border border-line bg-raised text-[14px]">
            {remarks.map((r, i) => (
              <li key={i} className="break-words border-b border-line px-3 py-2 font-semibold text-ink last:border-b-0">
                {r}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
    </div>
  );
}

/** The vehicle at a glance - worked out from the visits below, so it can never disagree with them. */
function OverviewPanel({ report, phone }: { report: VehicleHistoryReport; phone: boolean }) {
  const o = overviewOf(report);
  const psfParts = [
    o.psf.satisfied ? `${o.psf.satisfied} satisfied` : "",
    o.psf.dissatisfied ? `${o.psf.dissatisfied} dissatisfied` : "",
    o.psf.other ? `${o.psf.other} other` : "",
    o.psf.none ? `${o.psf.none} no PSF` : "",
  ].filter(Boolean);
  const rows: Row[] = [
    ["Visits", o.visits ? `${o.visits} · first ${o.first} · last ${o.last}` : "No job card on record in this view"],
    ["Dealers visited", o.dealers.length ? String(o.dealers.length) : ""],
    ["Last mileage", o.mileage ? `${o.mileage} km on ${o.mileageOn}` : ""],
    ["Amount on record", o.spent !== null ? `${rupees(o.spent)} on ${o.spentOn} of ${o.visits} visits` : ""],
    ["PSF", psfParts.join(" · ")],
  ];
  const facts: Row[] = (report.vehicle_facts ?? [])
    .map((f): Row => [text(f.label), text(f.value)])
    .filter(([l, v]) => l !== "" && v !== "");
  return (
    <div className="space-y-4 p-2">
      <Block title="At a glance">
        <KeyValue rows={rows} pairs={!phone} />
      </Block>
      {facts.length ? (
        <Block title="Vehicle facts">
          <KeyValue rows={facts} pairs={!phone} />
        </Block>
      ) : null}
      {o.dealers.length ? (
        <Block title={`Dealers · ${o.dealers.length}`}>
          <Table head={["Dealer", "Visits", "Last visit"]}>
            {o.dealers.map((d) => (
              <tr key={d.dealer}>
                <Td className="break-words font-semibold">{d.dealer}</Td>
                <Td className="text-right tabular-nums">{d.visits}</Td>
                <Td className="tabular-nums">{d.last}</Td>
              </tr>
            ))}
          </Table>
        </Block>
      ) : null}
      {o.serviceTypes.length ? (
        <Block title={`Service types · ${o.serviceTypes.length}`}>
          <Table head={["Service type", "Visits"]}>
            {o.serviceTypes.map((t) => (
              <tr key={t.label}>
                <Td className="break-words font-semibold">{t.label}</Td>
                <Td className="text-right tabular-nums">{t.count}</Td>
              </tr>
            ))}
          </Table>
        </Block>
      ) : null}
    </div>
  );
}

const OVERVIEW = -1;

/** One vehicle: summary, an Overview tab then a tab per visit (newest first), one panel. Give it a `key` per vehicle. */
export function ReadingView({ report, phone }: { report: VehicleHistoryReport; phone: boolean }) {
  const [sel, setSel] = useState(OVERVIEW);
  const visits = report.visits;
  const idx = sel === OVERVIEW ? OVERVIEW : Math.min(sel, visits.length - 1);
  const visit = idx === OVERVIEW ? null : visits[idx];
  const tabClass = (on: boolean) =>
    `min-h-[44px] shrink-0 whitespace-nowrap rounded-lg border px-4 text-[14px] font-bold ${
      on ? "border-accent bg-accent text-white" : "border-ink/40 bg-raised text-ink hover:bg-surface"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <Summary report={report} phone={phone} />
      <div role="tablist" aria-label="Overview, then visits newest first" className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          role="tab"
          id="vh-tab-overview"
          aria-selected={idx === OVERVIEW}
          aria-controls="vh-panel"
          onClick={() => setSel(OVERVIEW)}
          className={tabClass(idx === OVERVIEW)}
        >
          Overview
        </button>
        {visits.map((v, i) => (
          <button
            key={v.visit_no}
            type="button"
            role="tab"
            id={`vh-tab-${v.visit_no}`}
            aria-selected={i === idx}
            aria-controls="vh-panel"
            onClick={() => setSel(i)}
            className={tabClass(i === idx)}
          >
            {visitTabLabel(v)}
          </button>
        ))}
      </div>
      <div
        key={visit ? visit.visit_no : "overview"}
        id="vh-panel"
        role="tabpanel"
        aria-labelledby={visit ? `vh-tab-${visit.visit_no}` : "vh-tab-overview"}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-line bg-surface"
      >
        {visit ? <VisitPanel visit={visit} phone={phone} /> : <OverviewPanel report={report} phone={phone} />}
      </div>
    </div>
  );
}
