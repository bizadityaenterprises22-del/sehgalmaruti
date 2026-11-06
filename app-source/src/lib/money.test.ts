import { describe, expect, it } from "vitest";
import { computeAmount, inr, isNight } from "./money";

const std = {
  per_km: 12,
  base_fare: 50,
  min_charge: 150,
  waiting_per_hour: 60,
  night_pct: 20,
  night_from: "22:00",
  night_to: "06:00",
  round_trip_factor: 1.8,
};

describe("computeAmount", () => {
  it("charges base + per-km", () => {
    const b = computeAmount(std, 10);
    expect(b.distance_charge).toBe(120);
    expect(b.amount).toBe(170);
    expect(b.min_applied).toBe(false);
  });
  it("applies the minimum charge on a short hop", () => {
    const b = computeAmount(std, 2);
    expect(b.amount).toBe(150);
    expect(b.min_applied).toBe(true);
  });
  it("adds waiting time and the round-trip factor", () => {
    const b = computeAmount(std, 10, { waitingMinutes: 30, kind: "round" });
    expect(b.distance_charge).toBe(216); // 12 x 10 x 1.8
    expect(b.waiting_charge).toBe(30);
    expect(b.amount).toBe(296);
  });
  it("adds the night percentage when the trip starts in the night window", () => {
    const b = computeAmount(std, 10, { startClock: "23:15" });
    expect(b.night).toBe(true);
    expect(b.amount).toBe(204); // 170 x 1.2
    expect(computeAmount(std, 10, { startClock: "12:00" }).night).toBe(false);
  });
  it("never goes negative or NaN on bad inputs", () => {
    const b = computeAmount({ per_km: Number.NaN, min_charge: -5 }, -3);
    expect(b.amount).toBe(0);
  });
});

describe("isNight", () => {
  it("wraps midnight", () => {
    expect(isNight("05:59", "22:00", "06:00")).toBe(true);
    expect(isNight("06:00", "22:00", "06:00")).toBe(false);
    expect(isNight("21:59", "22:00", "06:00")).toBe(false);
  });
});

describe("inr", () => {
  it("formats Indian grouping", () => {
    expect(inr(1234567.5)).toBe("₹12,34,567.50");
    expect(inr(null)).toBe("—");
  });
});
