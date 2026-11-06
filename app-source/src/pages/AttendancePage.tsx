import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { attendanceDay, markAttendance } from "@/app/api";
import { useUi } from "@/app/store";
import { ROLE_LABEL, type AttendanceDay, type AttendanceKind } from "@/app/types";
import { useAttendance, useAttendanceDay, useInvalidate, useStaff } from "@/hooks/useQueries";
import { Badge, Button, Empty, Note, Section, Stat, Table, Td, flash } from "@/components/ui";
import { fmtDateDMY, fmtTime, todayIst } from "@/lib/dates";

/*
  ATTENDANCE - explicit check-in / check-out / break / duty-out by the person themself.
  The server stamps the time (never the phone's clock) and measures the distance from the
  workshop pin. No location fix = UNKNOWN, never "absent". A phone being present is not
  proof that its owner is present - the screen says so.

  on-site %   = verified on-site minutes / scheduled minutes
  accounted % = (on-site + approved off-site duty) / scheduled
  unknown minutes are always shown beside both.
*/

const LABEL: Record<AttendanceKind, string> = {
  check_in: "Checked in",
  check_out: "Checked out",
  break_start: "Break",
  break_end: "Back from break",
  duty_out: "Out on duty",
  duty_back: "Back from duty",
};

function nextActions(last: AttendanceKind | undefined): { kind: AttendanceKind; label: string; tone: "ok" | "danger" | "secondary" }[] {
  switch (last) {
    case undefined:
    case "check_out":
      return [{ kind: "check_in", label: "Check in", tone: "ok" }];
    case "break_start":
      return [{ kind: "break_end", label: "Back from break", tone: "ok" }];
    case "duty_out":
      return [{ kind: "duty_back", label: "Back from duty", tone: "ok" }];
    default:
      return [
        { kind: "break_start", label: "Break", tone: "secondary" },
        { kind: "duty_out", label: "Out on duty", tone: "secondary" },
        { kind: "check_out", label: "Check out", tone: "danger" },
      ];
  }
}

export function DaySummary({ d }: { d: AttendanceDay }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <Stat label="Shift" value={`${fmtTime(d.shift_from)}–${fmtTime(d.shift_to)}`} />
      <Stat label="On site (verified)" value={`${d.on_site_min} min`} tone="ok" />
      <Stat label="Approved duty out" value={`${d.approved_offsite_min} min`} />
      <Stat label="Unknown" value={`${d.unknown_min} min`} tone="warn" />
      <Stat label="On-site %" value={d.on_site_pct === null ? "—" : `${d.on_site_pct}%`} tone="ok" />
      <Stat label="Accounted %" value={d.accounted_pct === null ? "—" : `${d.accounted_pct}%`} />
      <Stat label="Outside, avg" value={d.avg_outside_min === null ? "—" : `${d.avg_outside_min} min × ${d.outside_episodes}`} />
    </div>
  );
}

function TeamRow({ profileId, name, role }: { profileId: string; name: string; role: string }) {
  const day = todayIst();
  const { data: d, error } = useQuery({ queryKey: ["attendance-day", profileId, day], queryFn: () => attendanceDay(profileId, day) });
  return (
    <tr className="hover:bg-surface">
      <Td className="font-bold">
        {name}
        <div className="text-[11px] text-muted">{ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role}</div>
      </Td>
      {error ? (
        <Td colSpan={6} className="text-muted">
          {(error as Error).message}
        </Td>
      ) : !d ? (
        <Td colSpan={6}>…</Td>
      ) : (
        <>
          <Td>{d.first_check_in ? fmtTime(d.first_check_in) : <Badge tone="muted">no check-in</Badge>}</Td>
          <Td className="font-bold text-ok">{d.on_site_pct ?? "—"}%</Td>
          <Td>{d.accounted_pct ?? "—"}%</Td>
          <Td className="text-warn">{d.unknown_min} min</Td>
          <Td>{d.last_verified_on_site ? fmtTime(d.last_verified_on_site) : "—"}</Td>
          <Td>{d.possible_early_leave ? <Badge tone="warn">check early leave</Badge> : ""}</Td>
        </>
      )}
    </tr>
  );
}

export default function AttendancePage() {
  const me = useUi((s) => s.me)!;
  const locationId = useUi((s) => s.locationId);
  const { data: events = [] } = useAttendance(me.profile_id);
  const { data: day } = useAttendanceDay(me.profile_id);
  const { data: staff = [] } = useStaff(locationId);
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState<AttendanceKind | null>(null);
  const last = events.length ? events[events.length - 1].kind : undefined;

  async function mark(kind: AttendanceKind) {
    if (!locationId) return flash("Choose your workshop at the top first.", "warn");
    let reason: string | undefined;
    if (kind === "duty_out") {
      const r = window.prompt("Going out on duty - where and why? (required)", "");
      if (!r) return;
      reason = r;
    }
    setBusy(kind);
    try {
      const e = await markAttendance(kind, locationId, reason);
      flash(
        `${LABEL[kind]} at ${fmtTime(e.at)} · ${e.on_site === true ? "on site" : e.on_site === false ? `${Math.round(e.distance_m ?? 0)} m from the workshop` : "no location fix (unknown)"}`,
        e.on_site === false ? "warn" : "ok",
      );
      invalidate("attendance", "attendance-day");
    } catch (err) {
      flash((err as Error).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4">
      <Section title={`My attendance · ${fmtDateDMY(todayIst())}`} sub={last ? `Now: ${LABEL[last]}` : "Not checked in today"}>
        <div className="flex flex-wrap gap-2">
          {nextActions(last).map((a) => (
            <Button key={a.kind} size="lg" tone={a.tone} busy={busy === a.kind} onClick={() => void mark(a.kind)}>
              {a.label}
            </Button>
          ))}
        </div>
        <div className="mt-3">
          {events.length === 0 ? (
            <Empty>Nothing marked today.</Empty>
          ) : (
            <div className="flex flex-wrap gap-2">
              {events.map((e) => (
                <span key={e.id} className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px]">
                  <b>{fmtTime(e.at)}</b> {LABEL[e.kind]} ·{" "}
                  {e.on_site === true ? <span className="text-ok">on site</span> : e.on_site === false ? <span className="text-warn">{Math.round(e.distance_m ?? 0)} m away</span> : <span className="text-muted">unknown</span>}
                  {e.reason ? ` · ${e.reason}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>
      {day ? <DaySummary d={day} /> : null}
      <Note>
        Evidence, not proof: we record the phone's location only when you press a button, with its accuracy. No fix means UNKNOWN, never absent. A phone at the
        workshop does not prove its owner is there. Reasons for going out are what you typed - we never guess them.
      </Note>
      {me.rank >= 50 ? (
        <Section title="Team today" sub="Per person, from their own check-ins. Read the unknown minutes before deciding anything.">
          <Table head={["Person", "First in", "On-site %", "Accounted %", "Unknown", "Last on site", ""]}>
            {staff
              .filter((s) => s.profile_id !== me.profile_id)
              .map((s) => (
                <TeamRow key={s.profile_id} profileId={s.profile_id} name={s.display_name} role={s.role} />
              ))}
          </Table>
        </Section>
      ) : null}
    </div>
  );
}
