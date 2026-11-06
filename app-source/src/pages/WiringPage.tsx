import { useState } from "react";
import { Link } from "react-router";
import { GROUPS, MODULES, countBy, groupById, type GroupId, type State } from "@/app/modules";
import { usePlan } from "@/app/plan";
import { Badge, Input, Note, Segmented, Stat, Table, Td } from "@/components/ui";
import { stateTone } from "@/pages/GroupPage";

/**
 * THE WIRING BOARD (Ravi 23-10-2026: "Then we can link the wirings one by one"). Every module of the app, its
 * state, where its data comes from and the next wiring step - so the wiring is done one module at a time, in the
 * open. Read from the one registry (src/app/modules.ts); nothing here is typed twice.
 */
type Show = "ALL" | State;

export default function WiringPage() {
  const { base } = usePlan();
  const [show, setShow] = useState<Show>("ALL");
  const [group, setGroup] = useState<GroupId | "">("");
  const [q, setQ] = useState("");
  const list = MODULES.filter((m) => m.id !== "crm-sense");
  const qq = q.trim().toLowerCase();
  const rows = list.filter(
    (m) =>
      (show === "ALL" || m.state === show) &&
      (!group || m.group === group) &&
      (!qq || `${m.name} ${m.source} ${m.hero ?? ""} ${m.w2 ?? ""}`.toLowerCase().includes(qq)),
  );

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-extrabold">Wiring board</h1>
          <p className="text-[12.5px] text-muted">
            Every module of the Sehgal Maruti app, its state and its data source (React + TypeScript + Vite, Supabase behind one gateway).
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Modules" value={list.length} />
        <Stat label="Working - real data" value={countBy("WORKING", list)} tone="ok" />
        <Stat label="Built - no rows yet" value={countBy("BUILT", list)} />
        <Stat label="Placeholder - not wired" value={countBy("PLACEHOLDER", list)} tone="warn" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={show}
          onChange={setShow}
          options={[
            { value: "ALL", label: `All · ${list.length}` },
            { value: "WORKING", label: `Working · ${countBy("WORKING", list)}` },
            { value: "BUILT", label: `Built · ${countBy("BUILT", list)}` },
            { value: "PLACEHOLDER", label: `Not wired · ${countBy("PLACEHOLDER", list)}` },
          ]}
        />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as GroupId | "")}
          className="rounded-lg border border-line bg-raised px-2 py-2 text-[13px]"
          aria-label="Group"
        >
          <option value="">All 11 groups</option>
          {GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.icon} {g.name}
            </option>
          ))}
        </select>
        <div className="w-56">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search module or source" aria-label="Search" />
        </div>
      </div>
      {rows.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Table head={["Group", "Module", "State", "Data source", "Next wiring step"]}>
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-surface">
                <Td className="whitespace-nowrap">{groupById(m.group)?.name}</Td>
                <Td className="font-bold">
                  <Link to={`${base}/g/${m.group}/${m.id}`} className="text-accent underline-offset-2 hover:underline">
                    {m.name}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={stateTone(m.state)}>{m.state}</Badge>
                </Td>
                <Td className="text-[12px]">{m.source}</Td>
                <Td className="text-[12px]">{m.next}</Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : (
        <Note tone="info">No module matches this filter.</Note>
      )}
    </div>
  );
}
