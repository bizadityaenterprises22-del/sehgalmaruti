/*
  Distance helpers. PURE. The road route itself comes from api.routeKm (OSRM); this file
  is the fallback maths and the formatting, so it can be unit-tested without a network.
*/

export interface Point {
  lat: number;
  lng: number;
}

const R_EARTH_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversineKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Straight-line -> road estimate. Pune-region roads measured against OSRM run about
 * 1.25-1.35x the crow-flies distance; 1.3 is the honest middle. Used ONLY when the
 * router is unreachable, and the trip records distance_source = 'haversine' so
 * nobody mistakes an estimate for a measurement.
 */
export const ROAD_FACTOR = 1.3;
export function roadEstimateKm(a: Point, b: Point): number {
  return round1(haversineKm(a, b) * ROAD_FACTOR);
}

/** Sum of legs along a GPS track (start -> ... -> end). */
export function trackKm(points: Point[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return round1(km);
}

export const round1 = (v: number): number => Math.round(v * 10) / 10;

export function fmtKm(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)} km`;
}

export function isValidPoint(p: Partial<Point> | null | undefined): p is Point {
  return (
    !!p &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}
