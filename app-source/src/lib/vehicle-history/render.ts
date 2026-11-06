// Sehgal Autoriders Vehicle History - printable renderer.
//
// Turns a VehicleHistoryReport into a standalone HTML document that reproduces the Maruti Suzuki
// DMS "Vehicle History" PDF (Oracle Reports, Rel:1.1.7): 778 x 1008 pt pages, two grey header
// bands, newest visit first, the job-card block reprinted on every continuation page, and the
// "Page n of N" footer.
//
// Pagination is done here, in TypeScript, from fixed row heights measured off the reference PDF -
// never by the browser - so the same report always yields the same pages and the same "of N".
// Every text run is placed absolutely (pt units) at the x / baseline Oracle used.
//
// Erasable TypeScript only (no enums, namespaces or parameter properties): runs under
// `node --experimental-strip-types` and imports unchanged into the React app.

import type { VehicleHistoryReport, VhVisit } from './types.ts';

// ---------------------------------------------------------------------------------------------
// Geometry (pt, measured from the reference PDF; y grows downwards from the page top)
// ---------------------------------------------------------------------------------------------

export const PAGE_W = 778;
export const PAGE_H = 1008;

const LEFT = 36; // left edge of every band / table / rule
const TITLE_BAND_TOP = 40.52; // "Vehicle History"
const REG_BAND_TOP = 63.0; // "Registration Number" / "No.of Visits Requested"
const BAND_H = 18.0;
const FIRST_S = 81.0; // bottom of the registration band = top slot of the first visit on a page
const FOOT_RULE_Y = 972.0;
/** Lowest y an element's bottom may reach before it has to move to the next page. */
const LIMIT = 946.0;

const HEAD_VB = 9.0; // VISIT label baseline = slot top + 9.0
const JC_FROM_VB = 160.36; // jobcard block (first row baseline) below the VISIT baseline
const CONT_JB = 112.36; // jobcard block baseline on a continuation page
const JC_BAND_FROM_JB = 112.48; // first table band top below the jobcard block's first baseline
const CUSTOMER_ADDR_MIN_LINES = 4; // Oracle reserves four address lines

const TBL_BAND_H = 13.52; // grey table header row
const ROW_H = 13.5; // one table row
const EXTRA_LINE = 12.0; // each wrapped line after the first
const TEXT_ROW_H = 18.0; // "Job Card Recommendations :" / "Unapproved Fitments :" / "Remarks :"
const GAP_PARTS = 9.0; // demanded repairs -> parts
const GAP_LABOUR = 15.0; // parts -> labour
const GAP_RECS = 17.9; // labour -> recommendations
const RULE_AFTER_VISIT = 0.04;

const VALUE_DY = 0.74; // Oracle prints values this far below the label baseline

// Column x positions
const X_SRL = 36.0;
const X_COL2 = 85.52; // Part number / Labour code / Demanded repair text
const X_COL3 = 207.0; // Part description / Labour description / recommendation text
const X_QTY_HEAD = 576.0;
const X_QTY_RIGHT = 614.2;
const X_BILLABLE = 630.0;
const X_AMT_RIGHT = 737.9;

// Wrap / fit widths (pt)
const W_ADDRESS = 370; // 153 -> 523, the vehicle column starts at 526.5
const W_DEALER = 160; // dealer name box (Oracle wraps between 134 and 185 pt)
const W_PART_DESC = 360; // 207 -> 567
const W_LABOUR_DESC = 415; // 207 -> 622
const W_DEMANDED = 640; // 85.5 -> 725
const W_NOTE = 525; // 207 -> 732

// ---------------------------------------------------------------------------------------------
// Text metrics (Helvetica advance widths, 1/1000 em, characters 32..126) - used only to wrap
// descriptions and to scale a single-line value that would otherwise run into its neighbour.
// ---------------------------------------------------------------------------------------------

const HELV_WIDTHS: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0-9 : ; < = > ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ A-O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P-Z [ \ ] ^ _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` a-o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p-z { | } ~
];

/** Width in pt of `s` in 10pt (or `size`) Helvetica. */
export function textWidth(s: string, size = 10): number {
  let u = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    u += c >= 32 && c <= 126 ? HELV_WIDTHS[c - 32] : 556;
  }
  return (u * size) / 1000;
}

/** Greedy word wrap on single spaces (runs of spaces are kept, as Oracle prints them). */
export function wrapText(text: string, maxW: number, size = 10): string[] {
  const out: string[] = [];
  const rtrim = (x: string) => x.replace(/\s+$/, '');
  for (const para of String(text ?? '').split(/\r\n|\r|\n/)) {
    const words = para.replace(/[\u0000-\u001f\u007f]/g, ' ').split(' ');
    let cur = '';
    let started = false;
    for (const w of words) {
      if (textWidth(w, size) > maxW) {
        // A single word wider than the box is broken by characters rather than overflowing.
        if (started) out.push(rtrim(cur));
        let rest = w;
        while (textWidth(rest, size) > maxW && rest.length > 1) {
          let n = rest.length - 1;
          while (n > 1 && textWidth(rest.slice(0, n), size) > maxW) n--;
          out.push(rest.slice(0, n));
          rest = rest.slice(n);
        }
        cur = rest;
        started = true;
        continue;
      }
      const cand = started ? `${cur} ${w}` : w;
      if (!started || textWidth(cand, size) <= maxW) {
        cur = cand;
        started = true;
      } else {
        out.push(rtrim(cur));
        cur = w;
      }
    }
    out.push(rtrim(cur));
  }
  return out.length ? out : [''];
}

// ---------------------------------------------------------------------------------------------
// Pagination model
// ---------------------------------------------------------------------------------------------

export interface DemandedRow { srl: number; lines: string[] }
export interface PartRow { srl: number; part_number: string; lines: string[]; quantity: string; billable_type: string }
export interface LabourRow { srl: number; labour_code: string; lines: string[]; billable_type: string }

interface BlockBase { visit: VhVisit }

/** `y` is the slot top for visit-head / text blocks and tables (band top), and the first-row baseline for jobcard. */
export type Block =
  | (BlockBase & { kind: 'visit-head'; y: number; address: string[] })
  | (BlockBase & { kind: 'jobcard'; y: number; continued: boolean; dealer: string[] })
  | (BlockBase & { kind: 'demanded'; y: number; rows: DemandedRow[] })
  | (BlockBase & { kind: 'parts'; y: number; rows: PartRow[] })
  | (BlockBase & { kind: 'labour'; y: number; rows: LabourRow[] })
  | (BlockBase & { kind: 'recommendations'; y: number; lines: string[] })
  | (BlockBase & { kind: 'unapproved'; y: number; lines: string[] })
  | (BlockBase & { kind: 'remarks'; y: number; lines: string[] })
  | (BlockBase & { kind: 'extras'; y: number; lines: string[] })
  | { kind: 'facts'; y: number; lines: string[]; visit?: undefined }
  | (BlockBase & { kind: 'rule'; y: number });

export type BlockKind = Block['kind'];

export interface Page {
  /** 1-based. */
  number: number;
  /** Total printed pages, identical on every page ("Page n of N"). */
  total: number;
  blocks: Block[];
}

/** The page title: Maruti's own words unless the report names another maker's title (release 1.2). */
function titleOf(report: VehicleHistoryReport): string {
  return clean(report.report_title).trim() || 'Vehicle History';
}

function clean(v: unknown): string {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ');
}

function rowHeight(lines: number): number {
  return ROW_H + EXTRA_LINE * (Math.max(1, lines) - 1);
}

function textHeight(lines: number): number {
  return TEXT_ROW_H + EXTRA_LINE * (Math.max(1, lines) - 1);
}

interface TableSection<R> { type: 'table'; kind: 'demanded' | 'parts' | 'labour'; gap: number; rows: R[]; heights: number[] }
interface TextSection { type: 'text'; kind: 'recommendations' | 'unapproved' | 'remarks' | 'extras'; gap: number; lines: string[] }
type Section = TableSection<DemandedRow | PartRow | LabourRow> | TextSection;

function buildSections(v: VhVisit): Section[] {
  const sections: Section[] = [];
  const dem: DemandedRow[] = (v.demanded_repairs ?? []).map((t, i) => ({
    srl: i + 1,
    lines: wrapText(clean(t), W_DEMANDED),
  }));
  if (dem.length) sections.push({ type: 'table', kind: 'demanded', gap: 0, rows: dem, heights: dem.map((r) => rowHeight(r.lines.length)) });
  const parts: PartRow[] = (v.parts ?? []).map((p, i) => ({
    srl: i + 1,
    part_number: clean(p.part_number),
    lines: wrapText(clean(p.description), W_PART_DESC),
    quantity: clean(p.quantity),
    billable_type: clean(p.billable_type),
  }));
  if (parts.length) sections.push({ type: 'table', kind: 'parts', gap: GAP_PARTS, rows: parts, heights: parts.map((r) => rowHeight(r.lines.length)) });
  const labour: LabourRow[] = (v.labour ?? []).map((l, i) => ({
    srl: i + 1,
    labour_code: clean(l.labour_code),
    lines: wrapText(clean(l.description), W_LABOUR_DESC),
    billable_type: clean(l.billable_type),
  }));
  if (labour.length) sections.push({ type: 'table', kind: 'labour', gap: GAP_LABOUR, rows: labour, heights: labour.map((r) => rowHeight(r.lines.length)) });
  sections.push({ type: 'text', kind: 'recommendations', gap: GAP_RECS, lines: wrapText(String(v.recommendations ?? ''), W_NOTE) });
  sections.push({ type: 'text', kind: 'unapproved', gap: 0, lines: wrapText(String(v.unapproved_fitments ?? ''), W_NOTE) });
  const remarks = (v.remarks ?? []).map((r) => clean(r).trim()).filter((r) => r !== '');
  if (remarks.length) sections.push({ type: 'text', kind: 'remarks', gap: 0, lines: wrapText(remarks.join(' | '), W_NOTE) });
  const extras = factTexts(v.extras);
  if (extras.length) sections.push({ type: 'text', kind: 'extras', gap: 0, lines: wrapText(extras.join(' | '), W_NOTE) });
  return sections;
}

/** "Label: value" for every fact that has both - a fact without a value is never printed. */
function factTexts(facts: { label?: string; value?: string }[] | undefined): string[] {
  return (facts ?? [])
    .map((f) => [clean(f?.label).trim(), clean(f?.value).trim()])
    .filter(([l, v]) => l !== '' && v !== '')
    .map(([l, v]) => `${l}: ${v}`);
}

/** Height of the smallest piece of a section that may stand alone at the bottom of a page. */
function minUnit(s: Section, gap: number): number {
  return s.type === 'table' ? gap + TBL_BAND_H + s.heights[0] : gap + textHeight(s.lines.length);
}

/**
 * Lay the whole report out. Deterministic: depends only on the report content.
 * Pages are returned with their final `total`.
 */
export function paginate(report: VehicleHistoryReport): Page[] {
  const pages: Page[] = [];
  const newPage = (): Page => {
    const p: Page = { number: pages.length + 1, total: 0, blocks: [] };
    pages.push(p);
    return p;
  };
  let page = newPage();

  /** slot top for the next visit on the current page */
  let s = FIRST_S;

  // Sehgal Autoriders addition: the vehicle facts we hold, once, under the registration band of page 1
  const facts = factTexts(report.vehicle_facts);
  if (facts.length) {
    const lines = wrapText(facts.join(' | '), W_NOTE);
    page.blocks.push({ kind: 'facts', y: FIRST_S, lines });
    s = FIRST_S + textHeight(lines.length);
  }

  for (const visit of report.visits ?? []) {
    const address = (visit.customer?.address_lines ?? []).flatMap((l) => wrapText(clean(l), W_ADDRESS));
    const extraAddr = Math.max(0, address.length - CUSTOMER_ADDR_MIN_LINES);
    const dealerName = clean(visit.jobcard?.dealer_name);
    const dealer = dealerName.trim() === '' ? [] : wrapText(dealerName, W_DEALER);
    const extraDealer = Math.max(0, dealer.length - 2);
    const sections = buildSections(visit);

    const jbFor = (slot: number) => slot + HEAD_VB + JC_FROM_VB + EXTRA_LINE * extraAddr;
    const bandFor = (jb: number) => jb + JC_BAND_FROM_JB + EXTRA_LINE * extraDealer;

    // A visit never starts where its header would be stranded: the first table band + one row
    // (or the first text row) has to fit below the job-card block, otherwise it starts a page.
    const needBottom = bandFor(jbFor(s)) + minUnit(sections[0], 0);
    if (needBottom > LIMIT && page.blocks.length > 0) {
      page = newPage();
      s = FIRST_S;
    }

    const jb0 = jbFor(s);
    page.blocks.push({ kind: 'visit-head', visit, y: s, address });
    page.blocks.push({ kind: 'jobcard', visit, y: jb0, continued: false, dealer });
    let cursor = bandFor(jb0);
    let freshPage = false; // nothing of this visit's sections printed on this page yet
    let first = true;

    const continuePage = () => {
      page = newPage();
      page.blocks.push({ kind: 'jobcard', visit, y: CONT_JB, continued: true, dealer });
      cursor = bandFor(CONT_JB);
      first = true;
      freshPage = true;
    };

    for (const sec of sections) {
      if (sec.type === 'table') {
        let i = 0;
        while (i < sec.rows.length) {
          const top = cursor + (first ? 0 : sec.gap);
          let h = TBL_BAND_H;
          let n = 0;
          while (i + n < sec.rows.length && top + h + sec.heights[i + n] <= LIMIT) {
            h += sec.heights[i + n];
            n++;
          }
          if (n === 0) {
            if (freshPage && first) {
              // a single row taller than a whole page: place it anyway rather than loop
              h += sec.heights[i];
              n = 1;
            } else {
              continuePage();
              continue;
            }
          }
          const rows = sec.rows.slice(i, i + n);
          page.blocks.push({ kind: sec.kind, visit, y: top, rows } as Block);
          cursor = top + h;
          first = false;
          freshPage = false;
          i += n;
          if (i < sec.rows.length) continuePage();
        }
      } else {
        for (;;) {
          const top = cursor + (first ? 0 : sec.gap);
          const h = textHeight(sec.lines.length);
          if (top + h > LIMIT && !(freshPage && first)) {
            continuePage();
            continue;
          }
          page.blocks.push({ kind: sec.kind, visit, y: top, lines: sec.lines } as Block);
          cursor = top + h;
          first = false;
          freshPage = false;
          break;
        }
      }
    }

    page.blocks.push({ kind: 'rule', visit, y: cursor + RULE_AFTER_VISIT });
    s = cursor + RULE_AFTER_VISIT;
  }

  for (const p of pages) p.total = pages.length;
  return pages;
}

// ---------------------------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------------------------

export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

const n2 = (v: number): string => (Math.round(v * 100) / 100).toString();

/**
 * Distance, in CSS px, from the top of a `line-height:12pt` (16px) line box to the text baseline,
 * measured in Chromium with Liberation Sans / Mono (== Arial / Courier New metrics).
 */
const BASELINE_PX: Record<string, number> = { '10': 12, '11': 13, '12': 13, '14': 14, m10: 11 };

/**
 * Chromium rounds a text baseline (and pixel-snaps a filled box) to a whole CSS px when painting, a
 * 0.75pt grid that is visibly coarse against Oracle's 0.01pt positions. So the whole-px part goes
 * in `top` and the remainder is applied as a translateY, which is exact in the printed PDF.
 */
function placeY(topPt: number): { top: string; shift: string } {
  const px = (topPt * 4) / 3;
  const n = Math.floor(px + 1e-9);
  const f = Math.round((px - n) * 1000) / 1000;
  return { top: `top:${n}px`, shift: f > 0 ? `translateY(${f}px)` : '' };
}

interface TxtOpt {
  b?: boolean;
  size?: 10 | 11 | 12 | 14;
  mono?: boolean;
  /** `x` is the right edge instead of the left edge. */
  right?: boolean;
  /** Squeeze (scaleX) a single-line value that is wider than this many pt. */
  maxW?: number;
  center?: boolean;
  /** Extra CSS class. */
  extra?: string;
  /** Pre-escaped inner HTML to use instead of escaping `text` (the text is still what is measured). */
  html?: string;
}

/** One absolutely placed text run. `base` is the baseline y in pt. */
function txt(x: number, base: number, text: string, o: TxtOpt = {}): string {
  const s = clean(text);
  if (s === '') return '';
  const size = o.size ?? 10;
  const bl = BASELINE_PX[o.mono ? `m${size}` : String(size)] ?? 12;
  const cls = ['t'];
  if (o.b) cls.push('b');
  if (size !== 10) cls.push(`s${size}`);
  if (o.mono) cls.push('m');
  if (o.extra) cls.push(o.extra);
  const st: string[] = [];
  if (o.center) {
    st.push('left:36pt', 'width:702pt', 'text-align:center');
  } else if (o.right) {
    st.push(`right:${n2(PAGE_W - x)}pt`);
  } else {
    st.push(`left:${n2(x)}pt`);
  }
  const y = placeY(base - (bl * 3) / 4);
  st.push(y.top);
  const tf: string[] = [];
  if (y.shift) tf.push(y.shift);
  if (o.maxW !== undefined) {
    const w = textWidth(s, size);
    if (w > o.maxW) {
      const k = Math.max(0.5, o.maxW / w);
      tf.push(`scaleX(${k.toFixed(3)})`);
      st.push(`transform-origin:${o.right ? '100%' : '0'} 0`);
    }
  }
  if (tf.length) st.push(`transform:${tf.join(' ')}`);
  return `<div class="${cls.join(' ')}" style="${st.join(';')}">${o.html ?? escapeHtml(s)}</div>`;
}

const bold = (x: number, base: number, text: string, o: TxtOpt = {}) => txt(x, base, text, { ...o, b: true });
const val = (x: number, base: number, text: string | undefined, maxW?: number, right = false) =>
  txt(x, base + VALUE_DY, text ?? '', { maxW, right });
const colon = (x: number, base: number) => txt(x, base, ':', { b: true });
const rect = (cls: string, topPt: number, h?: number) => {
  const y = placeY(topPt);
  const tf: string[] = [];
  if (y.shift) tf.push(y.shift);
  // Oracle strokes its rules with a zero-width (hairline) pen. A filled box cannot be thinner than one
  // CSS px (0.75pt) in Chromium, so rules are one px tall and squeezed to 0.5pt with scaleY.
  if (cls.startsWith('rule')) tf.push('scaleY(.667)');
  const t = tf.length ? `;transform:${tf.join(' ')}` : '';
  return `<div class="${cls}" style="${y.top}${h !== undefined ? `;height:${n2(h)}pt` : ''}${t}"></div>`;
};

function renderVisitHead(b: Extract<Block, { kind: 'visit-head' }>): string {
  const v = b.visit;
  const c = v.customer ?? {};
  const veh = v.vehicle ?? {};
  const vb = b.y + HEAD_VB;
  const extra = EXTRA_LINE * Math.max(0, b.address.length - CUSTOMER_ADDR_MIN_LINES);
  const o: string[] = [];

  // VISIT_n - Oracle draws the underline as a rule from x=36 to the end of the number and prints a
  // blank where we keep an (invisible) underscore, so the text reads VISIT_n and looks like VISIT n.
  o.push(
    txt(LEFT, vb, `VISIT_${v.visit_no}`, {
      b: true,
      extra: 'ul',
      html: `VISIT<span class="us">_</span>${escapeHtml(v.visit_no)}`,
    }),
  );

  o.push(bold(LEFT, vb + 13.53, 'CUSTOMER INFORMATION'));
  o.push(bold(526.52, vb + 13.53, 'Vehicle INFORMATION'));

  // customer, left column
  const row = (dy: number, label: string, value: string | undefined, maxW = 148) => {
    o.push(bold(LEFT, vb + dy, label), colon(139.52, vb + dy), val(153.0, vb + dy, value, maxW));
  };
  row(31.53, 'Name', c.name, W_ADDRESS);
  o.push(bold(LEFT, vb + 45.01, 'Address'), colon(139.52, vb + 45.01));
  b.address.forEach((line, i) => o.push(val(153.0, vb + 45.01 + EXTRA_LINE * i, line)));
  row(93.01 + extra, 'Res. Phone', c.res_phone);
  row(106.49 + extra, 'Mobile Phone', c.mobile_phone);
  // customer, middle column
  o.push(bold(306.0, vb + 93.0 + extra, 'Car User Phone    :'), val(409.52, vb + 93.0 + extra, c.car_user_phone, 112));
  o.push(txt(307.48, vb + 107.25 + extra, 'Email', { b: true }), colon(346.52, vb + 106.49 + extra), txt(355.52, vb + 107.25 + extra, c.email ?? '', { maxW: 165 }));

  // vehicle, right column
  const vrow = (dy: number, label: string, value: string | undefined, colonX = 601.48) => {
    o.push(bold(526.52, vb + dy, label), colon(colonX, vb + dy), val(619.48, vb + dy, value, 118));
  };
  vrow(27.01, 'Model', veh.model);
  vrow(40.53, 'Chassis No.', veh.chassis_no);
  vrow(54.01, 'Engine/Motor No', veh.engine_no, 606.72);
  vrow(67.53, 'Sold By', veh.sold_by);
  vrow(81.01, 'Sold Date', veh.sold_date);
  o.push(bold(527.28, vb + 98.32, 'BAttery No'), colon(606.0, vb + 96.72), val(619.48, vb + 98.32, veh.battery_no, 118));
  o.push(bold(528.0, vb + 114.0, 'Battery Capacity'), colon(611.28, vb + 113.96), val(619.48, vb + 114.0, veh.battery_capacity, 118));
  o.push(bold(526.52, vb + 127.37, 'Variant'), colon(578.28, vb + 127.37), val(593.24, vb + 127.37, veh.variant, 144));
  return o.join('');
}

function renderJobcard(b: Extract<Block, { kind: 'jobcard' }>): string {
  const j = b.visit.jobcard ?? {};
  const jb = b.y;
  const at = (k: number) => jb + ROW_H * k;
  const o: string[] = [];

  // left column
  const L: Array<[string, string | undefined]> = [
    ['Jobcard Number', j.jobcard_number],
    ['Service Type', j.service_type],
    ['SA Name', j.sa_name],
    ['Mechanic Name', j.mechanic_name],
    ['TA Name', j.ta_name],
    ['Group Name', j.group_name],
    ['Servicing Dealer', j.dealer_code],
  ];
  L.forEach(([label, value], k) => {
    o.push(bold(LEFT, at(k), label), colon(139.52, at(k)), val(153.0, at(k), value, 180));
  });
  b.dealer.forEach((line, i) => o.push(val(153.0, at(6) + EXTRA_LINE * (i + 1), line)));

  // middle column
  const psf = j.psf ?? {};
  const M: Array<[string, string | undefined]> = [
    ['Jobcard Date', j.jobcard_date],
    ['Promised Date', j.promised_date],
    ['Ready Date', j.ready_date],
    ['CSI %', j.csi_percent],
    ['PSF Status', `SA- ${clean(psf.sa)} -CCE- ${clean(psf.cce)} -2ND- ${clean(psf.second)}`],
    ['Mileage', j.mileage],
  ];
  M.forEach(([label, value], k) => {
    o.push(bold(337.52, at(k), label), colon(409.52, at(k)), val(418.52, at(k), value, label === 'PSF Status' ? 176 : 150));
  });
  if (clean(j.attended_through) !== '') {
    o.push(bold(337.52, at(6), 'Attended Through :'), val(436.52, at(6), j.attended_through, 130));
  }

  // right column: labels left-aligned at their Oracle x, amounts right-aligned
  const R: Array<[number, string, string | undefined, boolean]> = [
    [598.52, 'Bill Date', j.bill_date, false],
    [598.52, 'Bill Num', j.bill_number, false],
    [598.52, 'Part Amt.', j.part_amount, true],
    [598.52, 'Labour Amt.', j.labour_amount, true],
    [598.52, 'Total Amt.', j.total_amount, true],
    [576.0, 'Est Part Amt.', j.est_part_amount, true],
    [576.0, 'Est Labour Amt.', j.est_labour_amount, true],
    [576.0, 'Est Total Amt.', j.est_total_amount, true],
  ];
  R.forEach(([x, label, value, amount], k) => {
    o.push(bold(x, at(k), label), colon(661.52, at(k)));
    o.push(amount ? val(X_AMT_RIGHT, at(k), value, 70, true) : val(670.52, at(k), value, 67));
  });
  return o.join('');
}

function tableHeader(top: number, cols: Array<[number, string]>): string {
  return rect('hb', top, TBL_BAND_H) + cols.map(([x, t]) => bold(x, top + 9.0, t)).join('');
}

function renderDemanded(b: Extract<Block, { kind: 'demanded' }>): string {
  const o: string[] = [tableHeader(b.y, [[X_SRL, 'Srl.'], [X_COL2, 'Demanded Repairs']])];
  let y = b.y + TBL_BAND_H;
  for (const r of b.rows) {
    const base = y + 9.73;
    o.push(txt(X_SRL, base, String(r.srl)));
    r.lines.forEach((l, i) => o.push(txt(X_COL2, base + EXTRA_LINE * i, l)));
    y += rowHeight(r.lines.length);
  }
  return o.join('');
}

function renderParts(b: Extract<Block, { kind: 'parts' }>): string {
  const o: string[] = [
    tableHeader(b.y, [[X_SRL, 'Srl.'], [X_COL2, 'Part number'], [X_COL3, 'Part Description'], [X_QTY_HEAD, 'Quantity'], [X_BILLABLE, 'Billable Type']]),
  ];
  let y = b.y + TBL_BAND_H;
  for (const r of b.rows) {
    const base = y + 9.73;
    o.push(txt(X_SRL, base, String(r.srl)));
    o.push(txt(X_COL2, base, r.part_number, { maxW: 118 }));
    r.lines.forEach((l, i) => o.push(txt(X_COL3, base + EXTRA_LINE * i, l)));
    o.push(txt(X_QTY_RIGHT, base, r.quantity, { right: true, maxW: 36 }));
    o.push(txt(X_BILLABLE, base, r.billable_type, { maxW: 100 }));
    y += rowHeight(r.lines.length);
  }
  return o.join('');
}

function renderLabour(b: Extract<Block, { kind: 'labour' }>): string {
  const o: string[] = [
    tableHeader(b.y, [[X_SRL, 'Srl.'], [X_COL2, 'Labour Code'], [X_COL3, 'Labour  Description'], [X_BILLABLE, 'Billable Type']]),
  ];
  let y = b.y + TBL_BAND_H;
  for (const r of b.rows) {
    const base = y + 9.73;
    o.push(txt(X_SRL, base, String(r.srl)));
    o.push(txt(X_COL2, base, r.labour_code, { maxW: 118 }));
    r.lines.forEach((l, i) => o.push(txt(X_COL3, base + EXTRA_LINE * i, l)));
    o.push(txt(X_BILLABLE, base, r.billable_type, { maxW: 100 }));
    y += rowHeight(r.lines.length);
  }
  return o.join('');
}

function renderNote(label: string, x: number, b: { y: number; lines: string[] }): string {
  const base = b.y + 9.05;
  const o: string[] = [bold(x, base, label)];
  b.lines.forEach((l, i) => o.push(txt(X_COL3, base + 0.72 + EXTRA_LINE * i, l)));
  return o.join('');
}

function renderBlock(b: Block): string {
  let inner = '';
  switch (b.kind) {
    case 'visit-head':
      inner = renderVisitHead(b);
      break;
    case 'jobcard':
      inner = renderJobcard(b);
      break;
    case 'demanded':
      inner = renderDemanded(b);
      break;
    case 'parts':
      inner = renderParts(b);
      break;
    case 'labour':
      inner = renderLabour(b);
      break;
    case 'recommendations':
      inner = renderNote('Job Card Recommendations : ', LEFT, b);
      break;
    case 'unapproved':
      inner = renderNote('Unapproved Fitments  : ', 36.02, b);
      break;
    case 'remarks':
      inner = renderNote('Remarks :', LEFT, b);
      break;
    case 'extras':
      inner = renderNote('Additional :', LEFT, b);
      break;
    case 'facts':
      inner = renderNote('Vehicle facts :', LEFT, b);
      break;
    case 'rule':
      inner = rect('rule', b.y);
      break;
  }
  const extra =
    b.kind === 'jobcard' && b.continued
      ? ' data-continued="1"'
      : b.kind === 'demanded' || b.kind === 'parts' || b.kind === 'labour'
        ? ` data-srl-from="${b.rows[0].srl}" data-srl-to="${b.rows[b.rows.length - 1].srl}"`
        : '';
  const who = b.kind === 'facts' ? '' : ` data-visit="${escapeHtml(b.visit.visit_no)}"`;
  return `<div class="blk blk-${b.kind}"${who}${extra}>${inner}</div>`;
}

function renderPage(report: VehicleHistoryReport, p: Page): string {
  const o: string[] = [];
  o.push(rect('band', TITLE_BAND_TOP, BAND_H));
  o.push(rect('band', REG_BAND_TOP, BAND_H));
  o.push(txt(0, 53.24, titleOf(report), { b: true, size: 14, center: true }));
  o.push(txt(LEFT, 74.24, `Registration Number : ${clean(report.registration)}`, { b: true, size: 12 }));
  o.push(txt(733.46, 74.24, `No.of Visits Requested :${(report.visits ?? []).length}`, { b: true, size: 12, right: true }));
  for (const b of p.blocks) o.push(renderBlock(b));
  o.push(rect('rule foot', FOOT_RULE_Y));
  o.push(txt(40.52, 987.0, report.printed_at ?? '', { b: true, size: 11 }));
  o.push(txt(400.52, 985.52, `Rel:${clean(report.release)}`, { b: true, mono: true }));
  o.push(txt(646.48, 987.0, `Page  ${p.number}     of  ${p.total}    `, { b: true, size: 11 }));
  return `<section class="page" data-page="${p.number}">${o.join('')}</section>`;
}

const CSS = `
@page{size:778pt 1008pt;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0}
body{background:#525659;padding:12px 0;font-family:Arial,"Liberation Sans",Arimo,Helvetica,sans-serif;font-size:10pt;color:#000}
.page{position:relative;width:778pt;height:1008pt;margin:0 auto 12px;background:#fff;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.45);break-after:page;page-break-after:always}
.page:last-of-type{break-after:auto;page-break-after:auto}
.blk{position:absolute;left:0;top:0;width:778pt;height:1008pt}
.t{position:absolute;margin:0;padding:0;white-space:pre;line-height:12pt;font-size:10pt;font-weight:400;font-kerning:none;font-variant-ligatures:none;text-rendering:optimizeSpeed}
.t.b{font-weight:700}
.t.s11{font-size:11pt}.t.s12{font-size:12pt}.t.s14{font-size:14pt}
.t.m{font-family:"Courier New","Liberation Mono",Cousine,Courier,monospace}
.t.ul{text-decoration:underline;text-decoration-thickness:.96pt;text-underline-offset:1.5pt}
.us{color:transparent}
.band{position:absolute;left:36pt;width:702pt;background:#ccc}
.hb{position:absolute;left:36pt;width:702pt;background:#ccc}
.rule{position:absolute;left:36pt;width:702pt;height:1px;background:#525252;transform-origin:0 0}
.rule.foot{background:#000}
.screen-note{max-width:778pt;margin:0 auto 12px;padding:8px 12px;border-radius:4px;background:#fff3cd;color:#533f03;font:13px/1.4 Arial,"Liberation Sans",sans-serif}
@media print{
  html,body{background:#fff}
  body{padding:0}
  .page{margin:0;box-shadow:none}
  .no-print{display:none!important}
}
`;

/** Complete standalone HTML document (inline CSS, no scripts, no external fonts). */
export function renderVehicleHistoryHtml(report: VehicleHistoryReport): string {
  const pages = paginate(report);
  const notLoaded = (report.not_loaded ?? []).map((s) => clean(s)).filter((s) => s !== '');
  const note = notLoaded.length
    ? `<aside class="screen-note no-print">Not loaded when this report was assembled: ${escapeHtml(notLoaded.join(', '))}. This note is not printed.</aside>`
    : '';
  const body = pages.map((p) => renderPage(report, p)).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titleOf(report))} ${escapeHtml(clean(report.registration))}</title>
<style>${CSS}</style>
</head>
<body>
${note}
${body}
</body>
</html>
`;
}
