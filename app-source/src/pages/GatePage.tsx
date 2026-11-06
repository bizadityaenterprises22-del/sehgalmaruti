import { useSearchParams } from "react-router";
import { useUi } from "@/app/store";
import { Note, Segmented } from "@/components/ui";
import GateInForm from "./gate/GateInForm";
import GateOutForm from "./gate/GateOutForm";
import { GateInTable, GateOutTable } from "./gate/GateTables";
import { todayIst } from "@/lib/dates";

type Mode = "in" | "out";

export default function GatePage() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("mode") === "out" ? "out" : "in";
  const locationId = useUi((s) => s.locationId);
  const setMode = (m: Mode) => setParams(m === "out" ? { mode: "out" } : {});

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "in", label: "🚗 Gate In" },
            { value: "out", label: "🏁 Gate Out" },
          ]}
        />
        <span className="text-[12px] text-muted">Today · {todayIst().split("-").reverse().join("-")}</span>
      </div>
      {!locationId ? <Note tone="warn">Choose a workshop in the header first - every gate movement belongs to one workshop.</Note> : null}
      {mode === "in" ? <GateInForm locationId={locationId} /> : <GateOutForm locationId={locationId} />}
      {mode === "in" ? <GateInTable locationId={locationId} day={todayIst()} /> : <GateOutTable locationId={locationId} day={todayIst()} />}
    </div>
  );
}
