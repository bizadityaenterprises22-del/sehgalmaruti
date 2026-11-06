import { Suspense, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { GROUPS, STATE_LABEL, countBy, groupById, modulesOf, type ModuleDef, type State } from "@/app/modules";
import { usePlan } from "@/app/plan";
import { useUi } from "@/app/store";
import { Badge, Note, Segmented, Spinner, Table, Td } from "@/components/ui";
import { SCREENS } from "@/pages/screens";

/**
 * One group of the Maruti operating app (UI law: tab strip on top, ONE panel visible, no long scrolling page).
 * Left: the modules of the group (a list that scrolls inside itself; a dropdown on a phone). Right: the one
 * open module - its real screen when it has one, otherwise its planned layout with "not wired yet - source: X".
 */
export const stateTone = (s: State) => (s === "WORKING" ? "ok" : s === "BUILT" ? "brand" : "muted") as "ok" | "brand" | "muted";
const STATE_SHORT: Record<State, string> = { WORKING: "Working", BUILT: "Built · empty", PLACEHOLDER: "Not wired" };

export default function GroupPage() {
  const { group = "", module } = useParams();
  const { base } = usePlan();
  const navigate = useNavigate();
  const g = groupById(group);
  if (!g) return <Navigate to={`${base}/wiring`} replace />;
  const mods = modulesOf(g.id).filter((m) => m.id !== "crm-sense"); // Sense stays hidden (Ravi 06-10-2026 legal hold)
  const m = mods.find((x) => x.id === module) ?? mods[0];
  const go = (id: string) => navigate(`${base}/g/${g.id}/${id}`);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line bg-raised px-4 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-[17px] font-extrabold text-brand dark:text-accent">
            {g.icon} {g.name}
          </h1>
          <div className="flex gap-1.5 text-[11px]">
            <Badge tone="ok">{countBy("WORKING", mods)} working</Badge>
            <Badge tone="brand">{countBy("BUILT", mods)} built</Badge>
            <Badge tone="muted">{countBy("PLACEHOLDER", mods)} not wired</Badge>
          </div>
        </div>
        <p className="text-[12.5px] text-muted">{g.blurb}</p>
        <select
          value={m.id}
          onChange={(e) => go(e.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-surface px-2 py-2 text-[14px] md:hidden"
          aria-label="Module"
        >
          {mods.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} - {STATE_SHORT[x.state]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[270px] shrink-0 overflow-y-auto border-r border-line bg-raised md:block" aria-label={`${g.name} modules`}>
          {mods.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => go(x.id)}
              className={`flex w-full items-start justify-between gap-2 border-b border-line px-3 py-2 text-left text-[13px] ${
                x.id === m.id ? "border-l-[3px] border-l-accent bg-accent/10 font-bold text-accent" : "text-ink hover:bg-surface"
              }`}
            >
              <span>{x.name}</span>
              <span className="shrink-0">
                <Badge tone={stateTone(x.state)}>{STATE_SHORT[x.state]}</Badge>
              </span>
            </button>
          ))}
        </nav>
        <section className="min-w-0 flex-1 overflow-y-auto p-4">
          <ModulePanel key={m.id} m={m} />
        </section>
      </div>
    </div>
  );
}

function ModulePanel({ m }: { m: ModuleDef }) {
  const { planOnly } = usePlan();
  const me = useUi((s) => s.me);
  const screen = m.screen ? SCREENS[m.screen] : null;
  const [view, setView] = useState<"screen" | "plan" | "rule">(screen && !planOnly ? "screen" : "plan");
  const allowed = !screen?.minRank || (me?.rank ?? 0) >= screen.minRank || !!me?.is_admin;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold">{m.name}</h2>
          <p className="text-[13px] text-muted">{m.blurb}</p>
        </div>
        <Badge tone={stateTone(m.state)}>{STATE_LABEL[m.state]}</Badge>
      </div>
      <div className="grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
        <div>
          <span className="font-bold">Data source:</span> {m.source}
        </div>
        <div>
          <span className="font-bold">Who:</span> {m.roles.join(", ")}
        </div>
        <div>
          <span className="font-bold">West2 source:</span> {m.w2 ?? "—"}
        </div>
      </div>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          ...(screen ? [{ value: "screen" as const, label: m.state === "PLACEHOLDER" ? "Practice screen" : "Screen" }] : []),
          { value: "plan" as const, label: "Planned layout" },
          ...(m.law ? [{ value: "rule" as const, label: "The rule" }] : []),
        ]}
      />
      {view === "screen" && screen ? (
        planOnly ? (
          <Note tone="info">
            This module has a real screen. <b>Sign in</b> with your employee login to open it with live data. Before sign-in we show the plan only.
          </Note>
        ) : !allowed ? (
          <Note tone="warn">This screen opens for {screen.who ?? "managers"} only. The database refuses it for other logins.</Note>
        ) : (
          <>
            {m.state === "PLACEHOLDER" ? (
              <Note tone="warn">
                <b>Practice data, not real customers.</b> The calculation engine is built and tested, but it is not wired to our customer base yet. Next:{" "}
                {m.next}
              </Note>
            ) : null}
            <Suspense
              fallback={
                <div className="grid place-items-center py-10 text-muted">
                  <Spinner />
                </div>
              }
            >
              <screen.C />
            </Suspense>
          </>
        )
      ) : view === "rule" && m.law ? (
        <Note tone="info">{m.law}</Note>
      ) : (
        <PlannedLayout m={m} />
      )}
    </div>
  );
}

/** The planned layout of a module: honest words first, then the filters, columns and actions it will have. */
export function PlannedLayout({ m }: { m: ModuleDef }) {
  const wired = m.state !== "PLACEHOLDER";
  return (
    <div className="space-y-3">
      <Note tone={wired ? "ok" : "warn"}>
        {wired ? (
          <b>{m.next}</b>
        ) : (
          <>
            <b>Not wired yet - source: {m.source}.</b> Next wiring step: {m.next}
          </>
        )}
      </Note>
      {m.plan.filters.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Filters</span>
          {m.plan.filters.map((f) => (
            <span key={f} className="rounded-lg border border-dashed border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted">
              {f} ▾
            </span>
          ))}
        </div>
      ) : null}
      {m.plan.cols.length ? (
        <Table head={m.plan.cols}>
          <tr>
            <Td colSpan={m.plan.cols.length} className="py-6 text-center text-muted">
              No rows here - {!wired ? "this module is not wired yet." : m.screen ? "the Screen tab shows the live list after sign-in." : "this module has no list of its own."}
            </Td>
          </tr>
        </Table>
      ) : null}
      {m.plan.actions.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Actions</span>
          {m.plan.actions.map((a) => (
            <button
              key={a}
              type="button"
              disabled
              title="Not wired yet"
              className="cursor-not-allowed rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-bold text-muted opacity-70"
            >
              {a}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The group menu used by the shell (one entry per group). */
export function groupLinks(base: string) {
  return GROUPS.map((g) => ({ to: `${base}/g/${g.id}`, icon: g.icon, label: g.name }));
}

export function GroupCard({ id }: { id: string }) {
  const { base } = usePlan();
  const g = groupById(id)!;
  const mods = modulesOf(g.id).filter((m) => m.id !== "crm-sense");
  return (
    <Link to={`${base}/g/${g.id}`} className="rounded-xl border border-line bg-raised p-3 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
      <div className="text-[15px] font-extrabold text-brand dark:text-accent">
        {g.icon} {g.name}
      </div>
      <div className="mt-0.5 text-[12px] text-muted">{mods.length} modules</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {countBy("WORKING", mods) ? <Badge tone="ok">{countBy("WORKING", mods)} working</Badge> : null}
        {countBy("BUILT", mods) ? <Badge tone="brand">{countBy("BUILT", mods)} built</Badge> : null}
        <Badge tone="muted">{countBy("PLACEHOLDER", mods)} not wired</Badge>
      </div>
    </Link>
  );
}
