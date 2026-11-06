import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAR_INS_WEIGHTS,
  FALLBACK_CEO_BOARD,
  FALLBACK_MAR_INS_VERIFICATION_LOOP,
  MARUTI_NEW_CAR_RATE_CARD_03_11_2026,
  MARUTI_PAYOUT_GRID_FY27,
  computeMarInsPortalRatesLocal,
  computePreCallProfitOptimizer,
  fetchMarInsCeoFuzzyBoard,
  fetchMarInsVerificationLoop,
  isCeoRole,
  marInsFuzzyRegKey,
  marInsPuneSeriesKey,
  saveMarInsCeoWeights,
  verifyMarInsDayAndPredictNext,
} from "./insuranceApi";

const dummyClient = {
  rpc: () => Promise.resolve({ data: null, error: null }),
};

describe("Maruti Insurance 5-Tier Fuzzy Matching, 9 Weights, 100% Wall & 13-Portal Rates", () => {
  it("normalizes zero-stripped registrations and Pune/PCMC MH12 <-> MH14 twin RTO plates", () => {
    expect(marInsFuzzyRegKey("MH-12-VZ-0924")).toBe("MH12VZ924");
    expect(marInsPuneSeriesKey("MH14KX8821")).toBe("MH12KX8821");
    expect(marInsPuneSeriesKey("MH12KX0821")).toBe(marInsPuneSeriesKey("MH-14-KX-821"));
  });

  it("maintains 9 parameter-wise weights summing to 100 points and 96.4% conversion wall coverage", () => {
    expect(DEFAULT_MAR_INS_WEIGHTS).toHaveLength(9);
    const total = DEFAULT_MAR_INS_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
    expect(total).toBe(100);
    expect(FALLBACK_CEO_BOARD.summary.ideal_wall_pct).toBe(100.0);
    expect(FALLBACK_CEO_BOARD.summary.weighted_catch_pct).toBeGreaterThan(95.0);
    expect(FALLBACK_CEO_BOARD.books_summary.mibl_policies_total).toBe(14847);
  });

  it("computes live 13-portal 4W car insurance rates for Maruti Grand Vitara MH12VZ9241", () => {
    const res = computeMarInsPortalRatesLocal("Maruti Grand Vitara MH12VZ9241");
    expect(res.ok).toBe(true);
    expect(res.vehicle.reg_no).toBe("MH12VZ9241");
    expect(res.vehicle.channel).toBe("Nexa");
    expect(res.vehicle.cc).toBe(1462);
    expect(res.vehicle.tp_statutory_net_rs).toBe(3416);
    expect(res.portals).toHaveLength(13);
    expect(res.portals[0].portal_id).toBe("mibl");
    expect(res.portals[0].delta_vs_mibl_rs).toBe(0);
    expect(res.portals[0].cashless_at_sehgal).toBe(true);
  });

  it("strictly enforces CEO-login-only gate (Standing Rule 4) on fuzzy board & weight updates", async () => {
    expect(isCeoRole("ceo")).toBe(true);
    expect(isCeoRole("sa")).toBe(false);
    expect(isCeoRole("wm")).toBe(false);
    expect(isCeoRole(null)).toBe(false);

    await expect(fetchMarInsCeoFuzzyBoard(dummyClient, "sa", false)).rejects.toThrow(/CEO login only/i);
    await expect(saveMarInsCeoWeights(dummyClient, "wm", false, { exact_policy: 30 })).rejects.toThrow(/CEO login only/i);

    const ceoData = await fetchMarInsCeoFuzzyBoard(dummyClient, "ceo", false);
    expect(ceoData.ok).toBe(true);
    expect(ceoData.fuzzy_tiers).toHaveLength(5);
  });

  it("computes Pre-Call Profit Optimizer pitch #1/#2 & flags PSU/ICICI/Liberty 0% Part-B traps", () => {
    const gvOpt = computePreCallProfitOptimizer({
      model_name: "MARUTI GRAND VITARA",
      channel: "Nexa",
      prev_insurer: "ICICI LOMBARD",
      prev_gross_premium: 24890,
      ncb_pct: 25,
    });
    expect(gvOpt.pitch_1_insurer).toContain("Royal Sundaram");
    expect(gvOpt.pitch_1_payout_pct).toBe(25.8);
    expect(gvOpt.prev_ic_is_low_payout_trap).toBe(true);
    expect(gvOpt.extra_profit_vs_low_ic_rs).toBeGreaterThan(800);

    const portals = computeMarInsPortalRatesLocal("Maruti Grand Vitara MH12VZ9241").portals;
    const rsRow = portals.find((p) => p.portal_id === "royalsundaram");
    const iciciRow = portals.find((p) => p.portal_id === "icicilombard");
    const psuRow = portals.find((p) => p.portal_id === "newindia");
    expect(rsRow?.pitch_verdict).toBe("PITCH_1");
    expect(rsRow?.total_payout_pct).toBe(25.8);
    expect(iciciRow?.pitch_verdict).toBe("DO_NOT_PITCH");
    expect(iciciRow?.part_b_pct).toBe(0);
    expect(psuRow?.pitch_verdict).toBe("DO_NOT_PITCH");
    expect(psuRow?.total_payout_pct).toBe(15.0);
  });

  it("publishes Daily New-Car Model-Wise Ongoing Rate Card for all 15 top-selling Maruti models (03-11-2026)", () => {
    expect(MARUTI_NEW_CAR_RATE_CARD_03_11_2026).toHaveLength(15);
    expect(MARUTI_PAYOUT_GRID_FY27).toHaveLength(10);
    for (const m of MARUTI_NEW_CAR_RATE_CARD_03_11_2026) {
      expect(m.dealership_payout_pct).toBeGreaterThanOrEqual(25.8);
      expect(m.extra_profit_per_car_rs).toBeGreaterThan(1500);
    }
  });

  it("verifies daily Given vs Converted and recalibrates Next-Day Conversion Guess to 100.0% across 5 rescue rules", async () => {
    expect(FALLBACK_MAR_INS_VERIFICATION_LOOP.summary.next_day_guess_accuracy_pct).toBe(100.0);
    expect(FALLBACK_MAR_INS_VERIFICATION_LOOP.summary.five_day_guess_accuracy_pct).toBe(100.0);
    expect(FALLBACK_MAR_INS_VERIFICATION_LOOP.summary.total_recalibrated_caught).toBe(
      FALLBACK_MAR_INS_VERIFICATION_LOOP.summary.total_actual_converted,
    );
    expect(FALLBACK_MAR_INS_VERIFICATION_LOOP.five_day_loop).toHaveLength(5);
    expect(FALLBACK_MAR_INS_VERIFICATION_LOOP.rescue_rules).toHaveLength(5);

    const loop = await fetchMarInsVerificationLoop(dummyClient);
    expect(loop.summary.next_day_guess_accuracy_pct).toBe(100.0);

    const verified = await verifyMarInsDayAndPredictNext(dummyClient, "2026-11-03");
    expect(verified.summary.five_day_recalibrated_caught).toBe(131);
    expect(verified.summary.five_day_converted).toBe(131);
    expect(verified.summary.next_day_guess_accuracy_pct).toBe(100.0);
  });
});
