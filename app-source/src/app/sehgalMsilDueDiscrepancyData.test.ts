import { describe, expect, it } from "vitest";
import {
  MSIL_DISCREPANCY_SAMPLE_CASES,
  MSIL_DUE_17M_AUDIT,
  MSIL_MONTHLY_1BY1_LEDGER,
  MSIL_WORKSHOP_NOV_PLUS_6M_SHIELD,
} from "./sehgalMsilDueDiscrepancyData";

describe("MSIL 1-by-1 17-Month Due Discrepancy Audit & Nov+6M Corporate Blame-Shield", () => {
  it("contains all 17 individual 1-by-1 monthly slices (Nov 2026 down to Jul 2025)", () => {
    expect(MSIL_MONTHLY_1BY1_LEDGER.length).toBe(17);
    const novPlus6 = MSIL_MONTHLY_1BY1_LEDGER.filter((m) => m.is_nov_plus_6);
    expect(novPlus6.length).toBe(7);
    for (const row of MSIL_MONTHLY_1BY1_LEDGER) {
      expect(row.exported_rows).toBeGreaterThan(0);
      expect(row.unique_vins).toBeGreaterThan(0);
      expect(row.shield_100pct_target_vins).toBe(row.unique_vins);
    }
  });

  it("proves multi-month all-at-once selection collapses rows vs 1-by-1 monthly downloads", () => {
    const mm7 = MSIL_DUE_17M_AUDIT.multi_month_selection_distortion.nov_plus_6_may_to_nov2026;
    const mm16 = MSIL_DUE_17M_AUDIT.multi_month_selection_distortion.sixteen_months_aug2025_to_nov2026;
    expect(mm7.sum_1by1_rows).toBeGreaterThan(mm7.all_at_once_rows);
    expect(mm7.rows_lost_or_distorted).toBeGreaterThan(0);
    expect(mm16.sum_1by1_rows).toBeGreaterThan(mm16.all_at_once_rows);
    expect(mm16.rows_lost_or_distorted).toBeGreaterThan(0);
  });

  it("covers all 9 Sehgal Autoriders workshops with 100% contact shield and 0 uncontacted exposure", () => {
    expect(MSIL_WORKSHOP_NOV_PLUS_6M_SHIELD.length).toBe(9);
    for (const ws of MSIL_WORKSHOP_NOV_PLUS_6M_SHIELD) {
      expect(ws.nov_plus_6m_unique_vins).toBeGreaterThan(0);
      expect(ws.total_contact_shield_coverage_pct).toBe(100);
      expect(ws.uncontacted_blame_exposure_vins).toBe(0);
    }
    expect(MSIL_DISCREPANCY_SAMPLE_CASES.length).toBeGreaterThanOrEqual(15);
  });
});
