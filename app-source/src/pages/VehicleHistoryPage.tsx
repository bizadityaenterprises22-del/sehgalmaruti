import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { isConsultant, isNativeApp, vehicleHistory, vehicleSearch, vhLiveAsk, vhLiveStatus } from "@/app/api";
import { SEHGAL_TENANT, holdsAnything, isSearchableQuery, liveRegOf, openKeyOf, type VhSearchResult } from "@/app/vehicleHistoryApi";
import { Button, Input, Note, Spinner, flash } from "@/components/ui";
import { renderVehicleHistoryHtml } from "@/lib/vehicle-history/render";
import type { VehicleHistoryReport } from "@/lib/vehicle-history/types";
import { ReadingView } from "./vehicle-history/VehicleReadingView";
import { PdfView } from "./vehicle-history/VehiclePdfView";
import { holdupOf } from "./vehicle-history/vehicleOverview";
import { SearchResults } from "./vehicle-history/VehicleSearchResults";

/*
  VEHICLE HISTORY - the Maruti DMS "Vehicle History" report, rebuilt from our own data.

  Ravi, 16-Oct-2026: "Sehgal Maruti app will show sehgal visits only. But if it is my login
  it will show all visits."  Everyone sees Sehgal visits; a consultant login also gets the
  two-way switch below and starts on "All dealers". The database decides who may see what
  (vehicle_history_search / vehicle_history_report); this screen only asks, and shows the
  server's plain refusal.

  Ravi, tonight: "Make a mobile version also. Intelligently it should also give all the
  information based on reg no. Searches can be on reg no, vin no, mobile no, customer name
  like contains, many things etc."
    - ONE search box (registration, VIN, chassis/engine digits, mobile, name, job card) -> a
      results TABLE -> tap a row for that vehicle's report. Exactly one hit opens its report at once.
    - A report has two views built from the same JSON: the READING view (a phone-native tab per
      visit) and the exact Maruti PDF page view. A phone (<= 640px wide, or the Capacitor app)
      starts on the reading view; a desktop starts on the PDF view; either can be switched.

  UI LAW: one tab panel, the document never scrolls. Only the panel body inside the bordered box scrolls.
  Download PDF = the browser's print box (Save as PDF).
*/

type Scope = "sehgal" | "all";
type View = "read" | "pdf";

/** The scope line. `tenantName` is the app's own dealer group ("Sehgal Maruti" here, "Sehgal Hero" in the Hero app). */
const scopeLabel = (tenantName: string): Record<Scope, string> => ({
  sehgal: `${tenantName} - own visits`,
  all: "All dealers - consultant view",
});

const PDF_PHONE = "PDF on phone: coming next";

/** What the server read the search text as, in plain words for the strip above the results. */
const SEARCHED_AS_LABEL: Record<string, string> = {
  registration: "registration",
  partial: "part of registration",
  vin: "VIN",
  chassis_or_engine: "chassis / engine digits",
  mobile: "mobile",
  name: "name",
  jobcard: "job card",
  words: "all words together",
};

/** Amber = "this is incomplete", readable in both themes. */
const AMBER_BOX = "border-amber-500/50 bg-amber-500/10 text-ink";
const AMBER =
  "rounded-md border border-amber-600 bg-amber-100 px-2 py-0.5 font-bold text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100";

const scopeOf = (mode: "tenant" | "consultant"): Scope => (mode === "consultant" ? "all" : "sehgal");

type Drawn = { ok: true; html: string } | { ok: false; message: string };

/** The renderer is pure, but a report with a damaged visit must not take the screen down. */
function draw(report: VehicleHistoryReport): Drawn {
  try {
    return { ok: true, html: renderVehicleHistoryHtml(report) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** A two-way switch with touch-sized (44px) buttons. */
function Toggle<T extends string>({
  label,
  value,
  onChange,
  options,
  compact,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  compact?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-ink/40 bg-raised">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[44px] font-bold transition-colors ${compact ? "px-2.5 text-[13px]" : "px-4 text-[14px]"} ${i > 0 ? "border-l border-ink/30" : ""} ${
            value === o.value ? "bg-accent text-white" : "text-ink hover:bg-surface"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid h-full place-items-center p-6 text-center">{children}</div>;
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <Centered>
      <div role="alert" className="max-w-[560px]">
        <Note tone="danger">
          <span className="text-[15px] font-bold">{children}</span>
        </Note>
      </div>
    </Centered>
  );
}

/**
 * The Sehgal Maruti app mounts it with no props. Another app of the group mounts the same screen for its own tenant,
 * e.g. the Hero app: <VehicleHistoryPage tenant="sehgal" tenantName="Sehgal Hero" /> (release 1.2, every brand).
 */
export default function VehicleHistoryPage({ tenant: ownTenant = SEHGAL_TENANT, tenantName = "Sehgal Maruti" }: { tenant?: string; tenantName?: string } = {}) {
  const SCOPE_LABEL = scopeLabel(tenantName);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const printOnLoad = useRef(false);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null); // a vehicle chosen from the results table
  const [pick, setPick] = useState<Scope | null>(null);
  const [viewPick, setViewPick] = useState<View | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const narrow = useMediaQuery("(max-width: 640px)");
  const native = isNativeApp();
  const phone = narrow || native;
  const view: View = viewPick ?? (phone ? "read" : "pdf");

  // Is this login a consultant? Until we know, Search waits - otherwise the first answer
  // would be fetched in the wrong scope and then fetched again. If the check fails it counts
  // as "not a consultant" (Sehgal visits only) and the strip says so.
  const who = useQuery({ queryKey: ["vh-is-consultant"], queryFn: isConsultant, staleTime: 10 * 60_000, retry: 1 });
  const ready = !who.isPending;
  const consultant = who.data === true;
  const scope: Scope = consultant ? (pick ?? "all") : "sehgal";
  const tenant = scope === "sehgal" ? ownTenant : null;

  // Customer history is not kept in memory after it leaves the screen (gcTime 0), and a
  // refused or failed lookup is shown at once instead of being retried behind a spinner.
  const search = useQuery({
    queryKey: ["vh-search", query, scope, ownTenant],
    queryFn: () => vehicleSearch(query ?? "", tenant),
    enabled: query !== null && ready,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const searching = search.fetchStatus === "fetching";
  const found = searching ? undefined : search.data;

  // Exactly one hit opens its report straight away; otherwise the report is the row that was tapped.
  const only = found && found.results.length === 1 ? openKeyOf(found.results[0]) : null;
  // A full registration we hold nothing for still opens: the DMS is asked live (Ravi 27-10-2026: "just put in the reg no").
  const fresh = found && found.results.length === 0 ? liveRegOf(query) : null;
  const openKey = picked ?? only ?? fresh;

  const rep = useQuery({
    queryKey: ["vehicle-history", openKey, scope, ownTenant],
    queryFn: () => vehicleHistory(openKey ?? "", tenant),
    enabled: openKey !== null && ready,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const opening = rep.fetchStatus === "fetching";
  const report = openKey !== null && !opening ? rep.data : undefined;
  const visits = report?.visits.length ?? 0;
  const showingReport = report !== undefined && visits > 0;
  const drawn = useMemo(() => (report && view === "pdf" ? draw(report) : null), [report, view]);
  const canPrint = showingReport && !native;
  const busy = searching || opening;

  // The strip tells the truth about what the server answered, not what the switch said.
  const answered = openKey !== null ? report?.scope : found?.scope;
  const shownScope: Scope = answered ? scopeOf(answered.mode) : scope;
  const notLoaded = (openKey !== null ? (report?.not_loaded ?? []) : []).filter((s) => s.trim() !== "");
  const liveReg = openKey !== null ? (liveRegOf(report?.registration) ?? liveRegOf(openKey)) : null;
  const refetchReport = rep.refetch;
  const holdup = report ? holdupOf(report) : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = typed.trim();
    if (!isSearchableQuery(text)) {
      setFormError("Type at least 3 letters or digits");
      return;
    }
    setFormError(null);
    setPicked(null);
    if (text === query) void search.refetch();
    else setQuery(text);
  }

  function open(row: VhSearchResult) {
    const key = openKeyOf(row);
    if (key) setPicked(key);
  }

  function printNow() {
    const win = frameRef.current?.contentWindow;
    if (!win) {
      flash("There is no report on the screen to save.", "warn");
      return;
    }
    win.focus();
    win.print();
  }

  // Download PDF prints the page view. From the reading view it opens the page view first and prints once it has loaded.
  function downloadPdf() {
    if (view !== "pdf") {
      printOnLoad.current = true;
      setViewPick("pdf");
      return;
    }
    printNow();
  }
  function onFrameLoad() {
    if (printOnLoad.current) {
      printOnLoad.current = false;
      printNow();
    }
  }

  const pdfTitle = native ? PDF_PHONE : canPrint ? "Opens the print box - choose Save as PDF" : "Search for a vehicle first";
  const showControls = !phone || showingReport;

  let body: ReactNode = null;
  if (query === null) {
    body = (
      <Centered>
        <p className="max-w-[440px] text-[15px] font-semibold text-ink">
          Type a registration number, VIN, chassis or engine digits, mobile number, customer name or job card number, then press Search.
        </p>
      </Centered>
    );
  } else if (openKey !== null) {
    if (opening) {
      body = (
        <Centered>
          <p className="inline-flex items-center gap-3 text-[15px] font-semibold text-ink">
            <Spinner /> Opening {openKey}…
          </p>
        </Centered>
      );
    } else if (rep.isError) {
      body = <Problem>{(rep.error as Error).message}</Problem>;
    } else if (report && visits === 0 && holdsAnything(report)) {
      // no job card in this view, but we know the owner / vehicle (release 1.2): the reading view, Overview only
      body = <ReadingView key={`${openKey}|${scope}`} report={report} phone={phone} />;
    } else if (report && visits === 0) {
      body = (
        <Centered>
          <p className="text-[16px] font-bold text-ink">
            No visits found for {openKey} in {SCOPE_LABEL[shownScope]}
            {liveReg ? " yet - the DMS is being asked live (the line above)." : ""}
          </p>
        </Centered>
      );
    } else if (report && view === "read") {
      body = <ReadingView key={`${openKey}|${scope}`} report={report} phone={phone} />;
    } else if (drawn && !drawn.ok) {
      body = <Problem>This report could not be drawn: {drawn.message}</Problem>;
    } else if (report && drawn?.ok) {
      body = (
        <PdfView
          html={drawn.html}
          title={`Vehicle History report for ${report.registration}`}
          frameRef={frameRef}
          phone={phone}
          onFrameLoad={onFrameLoad}
        />
      );
    }
  } else if (searching) {
    body = (
      <Centered>
        <p className="inline-flex items-center gap-3 text-[15px] font-semibold text-ink">
          <Spinner /> Searching for {query}…
        </p>
      </Centered>
    );
  } else if (search.isError) {
    body = <Problem>{(search.error as Error).message}</Problem>;
  } else if (found && found.results.length === 0) {
    body = (
      <Centered>
        <p className="text-[16px] font-bold text-ink">
          Nothing found for “{query}” in {SCOPE_LABEL[shownScope]}
        </p>
      </Centered>
    );
  } else if (found) {
    body = <SearchResults rows={found.results} phone={phone} onOpen={open} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2">
        <form onSubmit={submit} className={`flex min-w-0 items-end gap-2 ${phone ? "w-full" : "w-[560px]"}`}>
          <div className="min-w-0 flex-1">
            <label
              htmlFor="vh-query"
              className={`text-[12px] font-bold uppercase tracking-wide text-muted ${phone ? "sr-only" : "mb-1 block"}`}
            >
              Find a vehicle
            </label>
            <Input
              id="vh-query"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setFormError(null);
              }}
              placeholder="Reg no, VIN, chassis, mobile, name, job card - or mix: name + reg digits"
              autoCapitalize="none"
              autoComplete="off"
              enterKeyHint="search"
              aria-invalid={formError ? true : undefined}
              className="!min-h-[48px] !text-[17px] font-bold"
            />
          </div>
          <Button type="submit" size="lg" busy={busy} disabled={!ready} className="min-h-[48px] shrink-0">
            Search
          </Button>
        </form>

        {consultant ? (
          <Toggle<Scope>
            label="Whose visits"
            value={scope}
            onChange={setPick}
            options={[
              { value: "sehgal", label: "Sehgal only" },
              { value: "all", label: "All dealers" },
            ]}
          />
        ) : null}

        {showControls ? (
          <div className={`flex flex-wrap items-center gap-2 ${phone ? "w-full" : "ml-auto"}`}>
            {showingReport ? (
              <Toggle<View>
                label="Report view"
                compact={phone}
                value={view}
                onChange={setViewPick}
                options={[
                  { value: "read", label: "Reading view" },
                  { value: "pdf", label: report?.brand && report.brand !== "MARUTI" ? "PDF view" : "Maruti PDF view" },
                ]}
              />
            ) : null}
            {native ? <span className="text-[12px] font-semibold text-muted">{PDF_PHONE}</span> : null}
            <span title={pdfTitle}>
              <Button
                type="button"
                tone="secondary"
                className={`min-h-[44px] !border-ink/40 ${phone ? "!px-2.5 !text-[13px]" : ""}`}
                disabled={!canPrint}
                onClick={downloadPdf}
              >
                Download PDF
              </Button>
            </span>
          </div>
        ) : null}
      </div>

      {formError ? (
        <div role="alert" className="shrink-0 text-[13px] font-bold text-danger">
          {formError}
        </div>
      ) : null}

      <div className="flex shrink-0 items-start gap-2">
        {picked !== null ? (
          <Button tone="secondary" className="min-h-[44px] shrink-0 !border-ink/40" onClick={() => setPicked(null)}>
            ← Results
          </Button>
        ) : null}
        <div
          role="status"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-raised px-3 py-2 text-[13px] text-ink"
        >
          <span>
            <span className="font-bold text-muted">Showing: </span>
            <span className="font-extrabold">{SCOPE_LABEL[shownScope]}</span>
          </span>
          {openKey === null && found ? (
            <span className="font-extrabold">
              Searched as: {SEARCHED_AS_LABEL[found.searched_as ?? ""] ?? (found.searched_as ?? "").replace(/_/g, " ")} - {found.total} found
              {found.total > found.results.length ? `, showing the first ${found.results.length}` : ""}
            </span>
          ) : null}
          {report ? (
            <span className="font-extrabold tabular-nums">
              {visits} {visits === 1 ? "visit" : "visits"}
            </span>
          ) : null}
          {notLoaded.length > 0 ? <span className={AMBER}>NOT LOADED YET: {notLoaded.join(", ")}</span> : null}
          {!ready ? (
            <span className="inline-flex items-center gap-2 text-muted">
              <Spinner /> Checking this login…
            </span>
          ) : null}
          {who.isError ? <span className={AMBER}>Could not check this login - showing {tenantName} visits only</span> : null}
        </div>
      </div>

      {holdup ? (
        <div role="alert" className="shrink-0 rounded-lg border-2 border-red-700 bg-red-700 px-3 py-2 text-[14px] font-extrabold text-white">
          HOLDUP - not billed: job card {holdup.jobcard} opened {holdup.opened}, {holdup.days} {holdup.days === 1 ? "day" : "days"} in the workshop
          {holdup.service ? ` · ${holdup.service}` : ""}
          {holdup.sa ? ` · SA ${holdup.sa}` : ""}
        </div>
      ) : null}
      {liveReg ? <LiveLine key={liveReg} reg={liveReg} onDone={() => void refetchReport()} /> : null}

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-raised">{body}</div>
    </div>
  );
}

const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) : "";

/**
 * The live line: the DMS is asked for this registration the moment the vehicle opens, our DMS reader reads its whole life
 * (every year), and the report reloads by itself when the answer is in. What we already hold stays on screen meanwhile.
 */
function LiveLine({ reg, onDone }: { reg: string; onDone: () => void }) {
  const ask = useQuery({ queryKey: ["vh-live-ask", reg], queryFn: () => vhLiveAsk(reg), staleTime: Infinity, gcTime: 0, retry: false });
  const id = ask.data?.id ?? null;
  const st = useQuery({
    queryKey: ["vh-live", id],
    queryFn: () => vhLiveStatus(id as number),
    enabled: id !== null,
    gcTime: 0,
    retry: 2,
    refetchInterval: (q) => (q.state.data && (q.state.data.state === "done" || q.state.data.state === "failed") ? false : 3000),
  });
  const now = st.data ?? ask.data;
  const told = useRef(false);
  useEffect(() => {
    if (now?.state === "done" && !told.current) {
      told.current = true;
      onDone();
    }
  }, [now?.state, onDone]);

  let tone = "border-line bg-raised text-ink";
  let text: ReactNode;
  if (ask.isError) {
    tone = AMBER_BOX;
    text = <>Could not ask the DMS live: {(ask.error as Error).message}</>;
  } else if (!now) {
    text = (
      <span className="inline-flex items-center gap-2">
        <Spinner /> Asking the Maruti DMS live for {reg}…
      </span>
    );
  } else if (now.state === "done") {
    tone = "border-ok/40 bg-ok/10 text-ink";
    text = (
      <>
        <b>Live from the Maruti DMS</b> at {clock(now.done_at)} - {now.job_cards ?? 0} job cards in this vehicle&apos;s whole life
        {now.note ? ` (${now.note})` : ""}
      </>
    );
  } else if (now.state === "failed") {
    tone = AMBER_BOX;
    text = <>The live DMS read did not finish - showing what we hold. {now.note}</>;
  } else if (!now.reader.alive) {
    tone = AMBER_BOX;
    text = (
      <>
        Our DMS reader is not on right now{now.reader.seen_at ? ` (last seen ${clock(now.reader.seen_at)})` : ""} - showing what we hold.
        The request for {reg} waits and is read as soon as the reader is back.
      </>
    );
  } else {
    text = (
      <span className="inline-flex items-center gap-2">
        <Spinner /> Live from the Maruti DMS: {now.step ?? "waiting for the reader"} …
      </span>
    );
  }
  return (
    <div role="status" className={`shrink-0 rounded-lg border px-3 py-2 text-[13px] font-semibold ${tone}`}>
      {text}
    </div>
  );
}
