import { signedUrl } from "@/app/api";
import { useGateIn, useGateOut } from "@/hooks/useQueries";
import { Badge, Empty, Section, Table, Td, flash } from "@/components/ui";
import { fmtTime } from "@/lib/dates";
import { prettyReg } from "@/lib/plate";
import { inr } from "@/lib/money";

export async function openPhoto(path: string | null) {
  if (!path) return;
  try {
    const u = await signedUrl(path);
    window.open(u, "_blank", "noopener");
  } catch (e) {
    flash(`Photo: ${(e as Error).message}`, "danger");
  }
}

export function PhotoLink({ path, label }: { path: string | null; label: string }) {
  if (!path) return <span className="text-muted">—</span>;
  return (
    <button type="button" className="font-bold text-accent underline-offset-2 hover:underline" onClick={() => void openPhoto(path)}>
      {label}
    </button>
  );
}

export function GateInTable({ locationId, day }: { locationId: string | null; day: string }) {
  const { data = [], isLoading } = useGateIn({ locationId, day });
  return (
    <Section title={`Gate in today · ${data.length}`} sub="Latest first.">
      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : data.length === 0 ? (
        <Empty>No vehicle has come in today at this workshop.</Empty>
      ) : (
        <Table head={["Time", "#", "Reg no.", "Customer", "Model", "Purpose", "KM", "Photo", "Status"]}>
          {data.map((g) => (
            <tr key={g.id} className="hover:bg-surface">
              <Td>{fmtTime(g.in_at)}</Td>
              <Td>{g.entry_no}</Td>
              <Td className="font-mono font-extrabold">
                {prettyReg(g.reg_no)}
                {g.reg_source === "ocr" ? <span className="ml-1 text-[10px] text-ok">OCR</span> : null}
              </Td>
              <Td>
                {g.customer_name ?? "—"}
                <div className="text-[11px] text-muted">{g.mobile ?? ""}</div>
              </Td>
              <Td>{g.model ?? "—"}</Td>
              <Td>{g.purpose ?? "—"}</Td>
              <Td>{g.km_in ?? "—"}</Td>
              <Td>
                <PhotoLink path={g.photo_vehicle} label="vehicle" />
              </Td>
              <Td>
                <Badge tone={g.status === "in" ? "brand" : "muted"}>{g.status === "in" ? "Inside" : "Out"}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}

export function GateOutTable({ locationId, day }: { locationId: string | null; day: string }) {
  const { data = [], isLoading } = useGateOut({ locationId, day });
  return (
    <Section title={`Gate out today · ${data.length}`} sub="Latest first. Every row has its three photographs.">
      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : data.length === 0 ? (
        <Empty>No vehicle has gone out today at this workshop.</Empty>
      ) : (
        <Table head={["Time", "Reg no.", "Gate pass", "Receipt", "Amount", "KM", "Authorised", "Photos"]}>
          {data.map((g) => (
            <tr key={g.id} className="hover:bg-surface">
              <Td>{fmtTime(g.out_at)}</Td>
              <Td className="font-mono font-extrabold">
                {prettyReg(g.reg_no)}
                {g.reg_source === "ocr" ? <span className="ml-1 text-[10px] text-ok">OCR</span> : null}
              </Td>
              <Td>{g.gate_pass_no ?? "—"}</Td>
              <Td>{g.receipt_no ?? "—"}</Td>
              <Td className="font-bold">{inr(g.receipt_amount)}</Td>
              <Td>{g.km_out ?? "—"}</Td>
              <Td>{g.authorised_by ?? "—"}</Td>
              <Td className="space-x-2">
                <PhotoLink path={g.photo_vehicle} label="vehicle" />
                <PhotoLink path={g.photo_gate_pass} label="pass" />
                <PhotoLink path={g.photo_receipt} label="receipt" />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}
