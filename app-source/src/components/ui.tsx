import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";
import { capturePhoto } from "@/app/api";
import { previewUrl } from "@/lib/image";

/* ------------------------------------------------------------------ flash (toast) --- */
interface FlashState {
  msg: string | null;
  tone: "ok" | "warn" | "danger";
  set: (msg: string | null, tone?: "ok" | "warn" | "danger") => void;
}
export const useFlash = create<FlashState>((set) => ({ msg: null, tone: "ok", set: (msg, tone = "ok") => set({ msg, tone }) }));
export const flash = (msg: string, tone: "ok" | "warn" | "danger" = "ok") => useFlash.getState().set(msg, tone);

export function FlashBar() {
  const { msg, tone, set } = useFlash();
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => set(null), tone === "ok" ? 3500 : 7000);
    return () => clearTimeout(t);
  }, [msg, tone, set]);
  if (!msg) return null;
  const cls = tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-danger";
  return (
    <div
      className={`fixed bottom-4 left-1/2 z-[2000] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${cls}`}
      role="status"
      onClick={() => set(null)}
    >
      {msg}
    </div>
  );
}

/* ------------------------------------------------------------------------- basics --- */
type Tone = "primary" | "secondary" | "danger" | "ok" | "ghost";
export function Button({
  tone = "primary",
  busy,
  full,
  size = "md",
  className = "",
  children,
  ...rest
}: {
  tone?: Tone;
  busy?: boolean;
  full?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px";
  const tones: Record<Tone, string> = {
    primary: "bg-accent text-white hover:brightness-110",
    secondary: "border border-line bg-raised text-ink hover:bg-surface",
    danger: "bg-danger text-white hover:brightness-110",
    ok: "bg-ok text-white hover:brightness-110",
    ghost: "text-brand hover:bg-surface",
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3.5 text-base" };
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={`${base} ${tones[tone]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}

export function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-[16px] text-ink outline-none focus:border-accent";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} autoCorrect="off" spellCheck={false} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Section({
  title,
  sub,
  right,
  children,
  className = "",
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-raised p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-extrabold text-brand dark:text-accent">{title}</h2>
          {sub ? <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Badge({ tone = "muted", children }: { tone?: "ok" | "warn" | "danger" | "muted" | "brand"; children: ReactNode }) {
  const cls = {
    ok: "border-ok/50 bg-ok/15 text-ok",
    warn: "border-warn/50 bg-warn/15 text-warn",
    danger: "border-danger/50 bg-danger/15 text-danger",
    muted: "border-line bg-line/60 text-muted",
    brand: "border-accent/50 bg-accent/10 text-accent",
  }[tone];
  return (
    <span className={`inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-extrabold uppercase ${cls}`}>
      {children}
    </span>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: ReactNode }) {
  const cls = {
    info: "border-line bg-surface text-ink",
    warn: "border-warn/40 bg-warn/10 text-ink",
    danger: "border-danger/40 bg-danger/10 text-ink",
    ok: "border-ok/40 bg-ok/10 text-ink",
  }[tone];
  return <div className={`rounded-lg border px-3 py-2 text-[13px] ${cls}`}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-muted">{children}</p>;
}

/* ---------------------------------------------------------------------- tables --- */
export function Table({ head, children, className = "" }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-line ${className}`}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap border-b border-line bg-surface px-3 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = "", ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...rest} className={`border-b border-line px-3 py-2 align-top ${className}`}>
    {children}
  </td>
);

/* ----------------------------------------------------------------- segmented tabs --- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-bold transition-colors ${value === o.value ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ photo slot --- */
/**
 * One photograph: capture (phone camera / file), preview, status. The parent decides
 * what to do with the blob (upload, OCR). Never uploads by itself.
 */
export function PhotoSlot({
  label,
  blob,
  onBlob,
  status,
  required,
  disabled,
}: {
  label: string;
  blob: Blob | null;
  onBlob: (b: Blob | null) => void;
  status?: ReactNode;
  required?: boolean;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = previewUrl(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  const [busy, setBusy] = useState(false);
  async function take() {
    setBusy(true);
    try {
      const b = await capturePhoto();
      if (b) onBlob(b);
    } catch (e) {
      flash(`Camera: ${(e as Error).message}`, "danger");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-muted">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </span>
        {blob ? (
          <button type="button" className="text-[12px] font-bold text-danger" onClick={() => onBlob(null)} disabled={disabled}>
            remove
          </button>
        ) : null}
      </div>
      {url ? <img src={url} alt={label} className="mb-2 max-h-48 w-full rounded-lg object-cover" /> : null}
      <Button tone={blob ? "secondary" : "primary"} full busy={busy} onClick={take} disabled={disabled}>
        📷 {blob ? "Retake" : "Take photo"}
      </Button>
      {status ? <div className="mt-2 text-[12.5px] text-muted">{status}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------------- stat tile --- */
export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "ok" | "brand" | "warn" }) {
  const c = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-brand dark:text-accent";
  return (
    <div className="rounded-xl border border-line bg-raised px-4 py-3 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-[22px] font-extrabold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
