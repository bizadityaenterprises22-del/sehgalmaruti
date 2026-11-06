import type { OcrFailReason, OcrOutcome } from "./types";

/**
 * The read-text reply -> what the gate screen shows. Pure, so it is tested without Supabase.
 *
 * Since Hero App r34 (31-10-2026, Ravi: "Hero app, Maruti App will use the tree only") read-text asks only
 * the office OCR Tree. When the tree gives nothing back it answers
 * { text: null, reason: "reader-not-answering", detail: "Reader not answering – type it." },
 * and { text: null, reason: "not-available" } for a task the tree has no reader for. Neither is the photo's
 * fault, so neither may say "retake the photo". 'unreadable' stays for a reply that read nothing for any
 * other reason.
 */
export function outcomeOfReply(data: unknown): OcrOutcome {
  const d = (data ?? {}) as {
    text?: unknown;
    reason?: unknown;
    detail?: unknown;
    confidence?: unknown;
    provider?: unknown;
    validated?: unknown;
  };
  const detail = typeof d.detail === "string" && d.detail ? d.detail : undefined;
  if (d.reason === "not-configured") return { ok: false, reason: "not-configured", detail };
  if (!d.text) {
    // The words below already say what the server's detail says - no second copy in brackets.
    if (d.reason === "reader-not-answering") return { ok: false, reason: "reader-not-answering" };
    if (d.reason === "not-available") return { ok: false, reason: "not-available" };
    return { ok: false, reason: "unreadable" };
  }
  return {
    ok: true,
    reading: {
      text: String(d.text),
      confidence: Number(d.confidence ?? 0),
      provider: String(d.provider ?? "unknown"),
      validated: d.validated !== false,
    },
  };
}

/** One line per reason. The guard always has the typed number to fall back on. */
export const OCR_FAIL_WORDS: Record<OcrFailReason, string> = {
  offline: "No connection - the photo could not be read. Type the number.",
  "not-configured": "Automatic reading is not switched on for this task. Type the number.",
  "reader-not-answering": "The reader is not answering just now – type the number.",
  "not-available": "There is no automatic reader for this photo yet – type the number.",
  unreadable: "Could not read the photo. Retake closer, or type the number.",
};

export function ocrFailLine(reason: OcrFailReason, detail?: string): string {
  return OCR_FAIL_WORDS[reason] + (detail ? ` (${detail})` : "");
}
