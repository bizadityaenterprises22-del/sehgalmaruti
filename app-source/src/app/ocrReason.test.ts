import { describe, expect, it } from "vitest";
import { OCR_FAIL_WORDS, ocrFailLine, outcomeOfReply } from "./ocrReason";

describe("outcomeOfReply - the read-text reply as the gate screen sees it", () => {
  it("office tree silent (Hero r34 reply) -> reader not answering, not 'retake the photo'", () => {
    const out = outcomeOfReply({
      text: null,
      reason: "reader-not-answering",
      detail: "Reader not answering – type it.",
      tried: ["ocr-tree"],
      task: "plate",
    });
    expect(out).toEqual({ ok: false, reason: "reader-not-answering" });
    if (out.ok) throw new Error("expected a failure");
    const line = ocrFailLine(out.reason, out.detail);
    expect(line).toBe("The reader is not answering just now – type the number.");
    expect(line).not.toMatch(/retake/i);
  });

  it("no tree reader for the task -> not available", () => {
    const out = outcomeOfReply({
      text: null,
      reason: "not-available",
      task: "plate",
      tried: [],
      detail: "Not available – the OCR Tree has no reader for this yet. Type it.",
    });
    expect(out).toEqual({ ok: false, reason: "not-available" });
    if (out.ok) throw new Error("expected a failure");
    expect(ocrFailLine(out.reason, out.detail)).not.toMatch(/retake/i);
  });

  it("a reply that read nothing for any other reason stays unreadable", () => {
    expect(outcomeOfReply({ text: null, reason: "unreadable" })).toEqual({ ok: false, reason: "unreadable" });
    expect(outcomeOfReply({ text: "" })).toEqual({ ok: false, reason: "unreadable" });
    expect(outcomeOfReply(null)).toEqual({ ok: false, reason: "unreadable" });
    expect(ocrFailLine("unreadable")).toBe("Could not read the photo. Retake closer, or type the number.");
  });

  it("not-configured keeps its detail, as before", () => {
    expect(outcomeOfReply({ reason: "not-configured", detail: "no reader" })).toEqual({
      ok: false,
      reason: "not-configured",
      detail: "no reader",
    });
    expect(ocrFailLine("not-configured", "no reader")).toBe(
      "Automatic reading is not switched on for this task. Type the number. (no reader)",
    );
  });

  it("a tree reading is passed on unchanged", () => {
    expect(outcomeOfReply({ text: "MH12RY1947", confidence: 0.93, provider: "ocr-tree", validated: true })).toEqual({
      ok: true,
      reading: { text: "MH12RY1947", confidence: 0.93, provider: "ocr-tree", validated: true },
    });
    const unchecked = outcomeOfReply({ text: "MH12RY194", provider: "ocr-tree", validated: false });
    expect(unchecked.ok && unchecked.reading.validated).toBe(false);
  });

  it("every reason has its own words", () => {
    expect(Object.keys(OCR_FAIL_WORDS).sort()).toEqual([
      "not-available",
      "not-configured",
      "offline",
      "reader-not-answering",
      "unreadable",
    ]);
    expect(new Set(Object.values(OCR_FAIL_WORDS)).size).toBe(5);
  });
});
