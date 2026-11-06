import { useState } from "react";
import { readDocument, readPlate } from "@/app/api";
import { ocrFailLine } from "@/app/ocrReason";
import type { OcrReading } from "@/app/types";
import { bestReg } from "@/lib/plate";

export type OcrState =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "read"; reading: OcrReading; reg: string; corrected: boolean }
  | { phase: "failed"; message: string };

/** Plate photo -> registration suggestion. The guard always confirms; OCR never decides alone. */
export function usePlateOcr() {
  const [state, setState] = useState<OcrState>({ phase: "idle" });
  async function run(blob: Blob): Promise<{ reg: string; reading: OcrReading | null }> {
    setState({ phase: "reading" });
    const out = await readPlate(blob);
    if (!out.ok) {
      setState({ phase: "failed", message: ocrFailLine(out.reason, out.detail) });
      return { reg: "", reading: null };
    }
    const b = bestReg(out.reading.text);
    setState({ phase: "read", reading: out.reading, reg: b.reg, corrected: b.corrected });
    return { reg: b.reg, reading: out.reading };
  }
  return { state, run, reset: () => setState({ phase: "idle" }) };
}

export type DocState =
  { phase: "idle" } | { phase: "reading" } | { phase: "read"; reading: OcrReading } | { phase: "failed"; message: string };

/** Document photo (gate pass, receipt) -> its free text, for the parsers in lib/plate.ts. */
export function useDocumentOcr() {
  const [state, setState] = useState<DocState>({ phase: "idle" });
  async function run(blob: Blob): Promise<OcrReading | null> {
    setState({ phase: "reading" });
    const out = await readDocument(blob);
    if (!out.ok) {
      setState({ phase: "failed", message: ocrFailLine(out.reason, out.detail) });
      return null;
    }
    setState({ phase: "read", reading: out.reading });
    return out.reading;
  }
  return { state, run, reset: () => setState({ phase: "idle" }) };
}

export function ocrLine(s: OcrState | DocState): string {
  switch (s.phase) {
    case "idle":
      return "";
    case "reading":
      return "Reading…";
    case "failed":
      return s.message;
    case "read": {
      const pct = Math.round((s.reading.confidence || 0) * 100);
      const via = `${s.reading.provider} · ${pct}%`;
      return "reg" in s
        ? s.reg
          ? `Read ${s.reg}${s.corrected ? " (corrected)" : ""} · ${via}`
          : `Nothing legible · ${via}`
        : `Text read · ${via}`;
    }
  }
}
