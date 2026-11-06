import { describe, expect, it } from "vitest";
import {
  DEFAULT_WATERFALL_INPUT,
  FR_MATURITY_ROWS,
  NESTED_RETENTION_ROWS,
  SAMPLE_COHORT_CUSTOMERS,
  WORKSHOP_PMS_ROWS,
  classifyCustomerCohort,
  computeActiveBaseWaterfall,
  computeDimensionUplift,
  computeFrMaturity,
  computeNestedRetention,
  computePmsGainLoss,
  rankCallQueue,
  scoreCustomerPriority,
} from "./retention";

describe("classifyCustomerCohort (IDEA-023)", () => {
  it("routes dormant customers beyond 36 months to archive_sales_lead", () => {
    expect(
      classifyCustomerCohort({
        monthsSinceLastVisit: 38,
        runningKmPerMonth: 2200,
        daysToNextDue: 5,
      }),
    ).toBe("archive_sales_lead");
  });

  it("classifies active vehicles due within 30 days as future_due_focused", () => {
    expect(
      classifyCustomerCohort({
        monthsSinceLastVisit: 6,
        runningKmPerMonth: 900,
        daysToNextDue: 12,
      }),
    ).toBe("future_due_focused");
  });

  it("classifies high-usage vehicles (>= 1,500 km/month) outside the 30-day window as very_high_running", () => {
    expect(
      classifyCustomerCohort({
        monthsSinceLastVisit: 8,
        runningKmPerMonth: 1850,
        daysToNextDue: 45,
      }),
    ).toBe("very_high_running");
  });

  it("classifies regular 0-15 month vehicles as focused and 15-36 month vehicles as non_focused", () => {
    expect(
      classifyCustomerCohort({
        monthsSinceLastVisit: 11,
        runningKmPerMonth: 800,
        daysToNextDue: 60,
      }),
    ).toBe("focused");

    expect(
      classifyCustomerCohort({
        monthsSinceLastVisit: 22,
        runningKmPerMonth: 700,
        daysToNextDue: -90,
      }),
    ).toBe("non_focused");
  });
});

describe("computeActiveBaseWaterfall (IDEA-023)", () => {
  it("reconciles the rolling 54k-55.5k active customer base accurately", () => {
    const res = computeActiveBaseWaterfall(DEFAULT_WATERFALL_INPUT);
    expect(res.totalInflows).toBe(1840 + 490 + 215); // 2,545
    expect(res.totalOutflows).toBe(1680 + 410); // 2,090
    expect(res.netChange).toBe(455);
    expect(res.closingActiveBase).toBe(54875);
    expect(res.withinTargetBand).toBe(true);
  });

  it("flags when the active base drops below the 54,000 floor", () => {
    const low = computeActiveBaseWaterfall({
      ...DEFAULT_WATERFALL_INPUT,
      openingActiveBase: 53200,
      newFirstFreeEntries: 200,
      reactivatedFromNonFocused: 50,
      transferredInFromCluster: 0,
      lapsedBeyond15m: 900,
      movedToArchiveBeyond36m: 200,
    });
    expect(low.closingActiveBase).toBe(52350);
    expect(low.withinTargetBand).toBe(false);
  });
});

describe("computeDimensionUplift & scoreCustomerPriority (IDEA-022)", () => {
  it("separates high-uplift core dimensions from noisy secondary dimensions", () => {
    const uplift = computeDimensionUplift(SAMPLE_COHORT_CUSTOMERS);
    const recency = uplift.find((r) => r.key === "recency")!;
    const psf = uplift.find((r) => r.key === "psf_satisfaction")!;

    expect(recency.scoreSeparation).toBeGreaterThan(40);
    expect(recency.upliftPctPoints).toBeGreaterThan(50);
    expect(recency.noisy).toBe(false);

    // PSF in sample has higher score on non-converted dormant customers -> flagged noisy
    expect(psf.noisy).toBe(true);
    expect(psf.recommendedWeight).toBe(0);
  });

  it("enforces No-Pull-Down Protection so noisy dimensions never lower an urgent customer's score", () => {
    const urgentWithLowPsf = SAMPLE_COHORT_CUSTOMERS[0]; // recency 96, running 94, pms 92, psf 42, tat 38
    const scored = scoreCustomerPriority(urgentWithLowPsf);

    expect(scored.coreUrgencyScore).toBe(94.4);
    expect(scored.naiveAllDimensionAverage).toBe(67.8);
    expect(scored.finalPriorityScore).toBeGreaterThanOrEqual(scored.coreUrgencyScore);
    expect(scored.protectedFromPullDown).toBe(true);
  });

  it("ranks urgent active customers at the top and pushes >36m archive customers to the bottom", () => {
    const ranked = rankCallQueue(SAMPLE_COHORT_CUSTOMERS);
    expect(ranked[0].id).toBe("cust-001");
    expect(ranked[ranked.length - 1].cohort).toBe("archive_sales_lead");
    expect(ranked[ranked.length - 1].finalPriorityScore).toBeLessThanOrEqual(25);
  });
});

describe("computeNestedRetention & computePmsGainLoss (IDEA-021)", () => {
  it("keeps Self <= Parent W2 <= West Zone retention strictly nested and never sums them", () => {
    for (const row of NESTED_RETENTION_ROWS) {
      const r = computeNestedRetention(row);
      expect(r.selfRetentionPct).toBeLessThanOrEqual(r.parentW2RetentionPct);
      expect(r.parentW2RetentionPct).toBeLessThanOrEqual(r.westZoneRetentionPct);
      expect(r.westZoneRetentionPct).toBeLessThanOrEqual(100);
      expect(
        r.retainedAtSelfWorkshop +
          r.servicedAtSisterW2Workshop +
          r.leakedToCompetitorDealerInWest +
          r.lostOutsideZoneOrIndependent,
      ).toBe(r.totalEligibleVehicles);
    }
  });

  it("computes Month and YTD workshop PMS Gain/Loss waterfalls accurately", () => {
    const computed = WORKSHOP_PMS_ROWS.map(computePmsGainLoss);
    expect(computed.length).toBe(14); // 7 workshops x 2 periods (Month + YTD)
    const pmbMonth = computed.find((r) => r.workshopCode === "1913" && r.period.startsWith("Month"))!;
    expect(pmbMonth.grossGains).toBe(68 + 54 + 42); // 164
    expect(pmbMonth.grossLosses).toBe(51 + 94); // 145
    expect(pmbMonth.netPmsGainLoss).toBe(19);
    expect(pmbMonth.totalPmsDone).toBe(695 + 164); // 859
  });

  it("computes FR1/FR2/FR3 maturity conversion windows accurately", () => {
    expect(FR_MATURITY_ROWS).toHaveLength(4);
    const fr1 = computeFrMaturity("FR1 (2 Months)", 1000, 880, 60);
    expect(fr1.missedOrPending).toBe(60);
    expect(fr1.conversionPct).toBe(94);
  });
});
