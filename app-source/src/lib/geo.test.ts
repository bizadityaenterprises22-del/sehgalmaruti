import { describe, expect, it } from "vitest";
import { haversineKm, roadEstimateKm, trackKm, isValidPoint } from "./geo";

const bavdhan = { lat: 18.5135, lng: 73.771 };
const manjri = { lat: 18.5284, lng: 73.9782 };

describe("geo", () => {
  it("measures Bavdhan -> Manjri about 22 km crow-flies", () => {
    const km = haversineKm(bavdhan, manjri);
    expect(km).toBeGreaterThan(21);
    expect(km).toBeLessThan(23);
  });
  it("road estimate applies the factor", () => {
    expect(roadEstimateKm(bavdhan, manjri)).toBeCloseTo(haversineKm(bavdhan, manjri) * 1.3, 0);
  });
  it("sums a track", () => {
    expect(trackKm([bavdhan, manjri, bavdhan])).toBeCloseTo(2 * haversineKm(bavdhan, manjri), 0);
    expect(trackKm([bavdhan])).toBe(0);
  });
  it("validates points", () => {
    expect(isValidPoint(bavdhan)).toBe(true);
    expect(isValidPoint({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidPoint(null)).toBe(false);
  });
});
