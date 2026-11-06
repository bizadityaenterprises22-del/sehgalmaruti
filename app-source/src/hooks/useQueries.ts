import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/app/api";
import type { TripStatus } from "@/app/types";
import { todayIst } from "@/lib/dates";

/*
  Server state, one hook per table. Keys are arrays, most-general first, so
  ['trips'] invalidates every trip list and ['trips', {..}] one of them.
*/
export const keys = {
  locations: ["locations"] as const,
  designations: ["designations"] as const,
  rates: ["rates"] as const,
  drivers: (loc: string | null) => ["drivers", loc] as const,
  driverChanges: ["driver-changes"] as const,
  trips: (f: object) => ["trips", f] as const,
  gateIn: (f: object) => ["gate-in", f] as const,
  gateOut: (f: object) => ["gate-out", f] as const,
  stats: (loc: string | null, day: string) => ["stats", loc, day] as const,
  users: ["users"] as const,
};

const MASTER = 30 * 60_000; // masters change when Ravi edits them, not while a car is at the gate

export const useLocations = () => useQuery({ queryKey: keys.locations, queryFn: api.listLocations, staleTime: MASTER });
export const useDesignations = () => useQuery({ queryKey: keys.designations, queryFn: api.listDesignations, staleTime: MASTER });
export const useRateCards = () => useQuery({ queryKey: keys.rates, queryFn: api.listRateCards, staleTime: 5 * 60_000 });
export const useDrivers = (loc: string | null, includeInactive = false) =>
  useQuery({ queryKey: [...keys.drivers(loc), includeInactive], queryFn: () => api.listDrivers(loc, includeInactive), staleTime: 60_000 });
export const useDriverChanges = () => useQuery({ queryKey: keys.driverChanges, queryFn: () => api.listDriverChanges(50) });

export const useTrips = (f: { locationId?: string | null; day?: string; status?: TripStatus[] }) =>
  useQuery({ queryKey: keys.trips(f), queryFn: () => api.listTrips(f), refetchInterval: 20_000 });
export const useGateIn = (f: { locationId?: string | null; day?: string; openOnly?: boolean }) =>
  useQuery({ queryKey: keys.gateIn(f), queryFn: () => api.listGateIn(f), refetchInterval: 30_000 });
export const useGateOut = (f: { locationId?: string | null; day?: string }) =>
  useQuery({ queryKey: keys.gateOut(f), queryFn: () => api.listGateOut(f), refetchInterval: 30_000 });
export const useDayStats = (loc: string | null, day = todayIst()) =>
  useQuery({ queryKey: keys.stats(loc, day), queryFn: () => api.dayStats(loc, day), refetchInterval: 30_000 });
export const useUsers = (enabled: boolean) => useQuery({ queryKey: keys.users, queryFn: api.adminListUsers, enabled });

// master app (0204)
export const useStaff = (loc: string | null) => useQuery({ queryKey: ["staff", loc], queryFn: () => api.listStaff(loc), staleTime: 5 * 60_000 });
export const useVisits = (f: { locationId?: string | null; day?: string; assignedTo?: string | null; open?: boolean }) =>
  useQuery({ queryKey: ["visits", f], queryFn: () => api.listVisits(f), refetchInterval: 15_000 });
export const useCustomers = (f: { locationId?: string | null; search?: string; mine?: string | null }) =>
  useQuery({ queryKey: ["customers", f], queryFn: () => api.listCustomers(f) });
export const useInteractions = (f: { visitId?: string; customerId?: string; mineOpen?: string | null }, enabled = true) =>
  useQuery({ queryKey: ["interactions", f], queryFn: () => api.listInteractions(f), enabled });
export const useAttendance = (profileId: string | null, day = todayIst()) =>
  useQuery({ queryKey: ["attendance", profileId, day], queryFn: () => api.listAttendance(profileId!, day), enabled: !!profileId, refetchInterval: 60_000 });
export const useAttendanceDay = (profileId: string | null, day = todayIst()) =>
  useQuery({ queryKey: ["attendance-day", profileId, day], queryFn: () => api.attendanceDay(profileId!, day), enabled: !!profileId, refetchInterval: 60_000 });
export const useMyDriverTrips = () => useQuery({ queryKey: ["trips", "mine"], queryFn: api.myDriverTrips, refetchInterval: 20_000 });

type Group =
  | "trips"
  | "gate-in"
  | "gate-out"
  | "drivers"
  | "rates"
  | "locations"
  | "users"
  | "stats"
  | "driver-changes"
  | "visits"
  | "customers"
  | "interactions"
  | "attendance"
  | "attendance-day";

/** Invalidate everything that a write could have moved. Cheap, and never stale. */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...groups: Group[]) => {
    const g: Group[] = groups.length
      ? groups
      : ["trips", "gate-in", "gate-out", "drivers", "rates", "locations", "users", "stats", "driver-changes", "visits", "customers", "interactions", "attendance", "attendance-day"];
    for (const k of g) void qc.invalidateQueries({ queryKey: [k] });
  };
}

export function useAction<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, after?: (r: TResult) => void) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      invalidate();
      after?.(r);
    },
  });
}
