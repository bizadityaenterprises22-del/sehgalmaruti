/*
  Registration-number handling: cleaning, format checking, correcting the mistakes plate
  OCR actually makes, and pulling a registration / gate-pass number / amount out of the
  free text an OCR engine returns for a document photograph.

  The plate-correction part is the proven Hero v2 logic (features/gate/plate.ts,
  Spec 01 test 7) carried over unchanged so both Sehgal apps read plates the same way.
  Every function here is pure and tested.
*/

const LETTER_FOR_DIGIT: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z", "6": "G", "4": "A" };
const DIGIT_FOR_LETTER: Record<string, string> = Object.fromEntries(Object.entries(LETTER_FOR_DIGIT).map(([d, l]) => [l, d]));

type Slot = "L" | "D";
const TEMPLATES: Record<number, Slot[][]> = {
  9: [
    ["L", "L", "D", "D", "L", "D", "D", "D", "D"],
    ["D", "D", "L", "L", "D", "D", "D", "D", "L"],
  ],
  10: [
    ["L", "L", "D", "D", "L", "L", "D", "D", "D", "D"],
    ["D", "D", "L", "L", "D", "D", "D", "D", "L", "L"],
  ],
  11: [["L", "L", "D", "D", "L", "L", "L", "D", "D", "D", "D"]],
};

/** Upper-case, drop everything that is not A-Z or 0-9. */
export function cleanReg(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Reshape a candidate so each position holds the KIND of character its layout needs. */
export function positionalVariants(candidate: string): string[] {
  const c = cleanReg(candidate);
  const templates = TEMPLATES[c.length];
  if (!templates) return [];
  const out: string[] = [];
  for (const template of templates) {
    let ok = true;
    let built = "";
    for (let i = 0; i < c.length; i++) {
      const ch = c[i];
      const wantLetter = template[i] === "L";
      const isLetter = ch >= "A" && ch <= "Z";
      if (wantLetter === isLetter) {
        built += ch;
        continue;
      }
      const swapped = wantLetter ? LETTER_FOR_DIGIT[ch] : DIGIT_FOR_LETTER[ch];
      if (!swapped) {
        ok = false;
        break;
      }
      built += swapped;
    }
    if (ok && built !== c) out.push(built);
  }
  return [...new Set(out)];
}

const STANDARD = /^[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}$/;
const BHARAT = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

/** Format check - a WARNING, never a block (a real vehicle must never be refused by a regex). */
export function isKnownRegFormat(candidate: string): boolean {
  const c = cleanReg(candidate);
  return STANDARD.test(c) || BHARAT.test(c);
}

/** Best usable registration from a raw OCR reading: as read if valid, else the one corrected layout. */
export function bestReg(raw: string | null | undefined): { reg: string; corrected: boolean } {
  const c = cleanReg(raw);
  if (!c) return { reg: "", corrected: false };
  if (isKnownRegFormat(c)) return { reg: c, corrected: false };
  const fixed = positionalVariants(c).filter(isKnownRegFormat);
  return fixed.length === 1 ? { reg: fixed[0], corrected: true } : { reg: c, corrected: false };
}

/** Display form: MH14EA2706 -> MH 14 EA 2706. Storage stays unspaced. */
export function prettyReg(reg: string | null | undefined): string {
  const c = cleanReg(reg);
  const m = /^([A-Z]{2})([0-9]{2})([A-Z]{1,3})([0-9]{4})$/.exec(c);
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : c;
}

/**
 * Find registration numbers inside free OCR text (a gate pass, a receipt). Tolerates
 * spaces and dashes between the groups ("MH 12 AB 1234", "MH-12-AB-1234").
 */
export function extractRegs(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const re = /\b([A-Z]{2})[\s-]?([0-9]{2})[\s-]?([A-Z]{1,3})[\s-]?([0-9]{4})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const reg = cleanReg(m[0]);
    if (isKnownRegFormat(reg)) found.add(reg);
  }
  const bh = /\b([0-9]{2})[\s-]?BH[\s-]?([0-9]{4})[\s-]?([A-Z]{1,2})\b/gi;
  while ((m = bh.exec(text)) !== null) found.add(cleanReg(m[0]));
  return [...found];
}

/** "Gate Pass No: GP-1234" / "Pass No. 00123" -> "GP-1234" / "00123". */
export function extractPassNo(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = /(?:gate\s*pass|pass|g\.?p\.?)\s*(?:no|number|#)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i.exec(text);
  return m ? m[1].toUpperCase() : null;
}

/** Receipt / invoice number. */
export function extractReceiptNo(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = /(?:receipt|invoice|bill|rcpt|inv)\s*(?:no|number|#)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i.exec(text);
  return m ? m[1].toUpperCase() : null;
}

/** The money on a receipt: prefer a labelled total, else the largest rupee figure. */
export function extractAmount(text: string | null | undefined): number | null {
  if (!text) return null;
  const labelled =
    /(?:grand\s*total|net\s*(?:amount|payable)|total\s*(?:amount|payable)?|amount\s*(?:paid|received)?|paid)\s*[:.\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = labelled.exec(text)) !== null) {
    const v = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(v) && v > 0 && (best === null || v > best)) best = v;
  }
  if (best !== null) return best;
  const rupee = /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  while ((m = rupee.exec(text)) !== null) {
    const v = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(v) && v > 0 && (best === null || v > best)) best = v;
  }
  return best;
}
