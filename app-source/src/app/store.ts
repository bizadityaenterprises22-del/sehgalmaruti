import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MarMe } from "./types";

/*
  CLIENT STATE ONLY: theme, the signed-in person (as the server described them), the
  chosen workshop. Everything that lives in a table lives in TanStack Query.
*/
type Theme = "dark" | "light";
type Status = "unknown" | "signed-out" | "signing-in" | "signed-in";

interface UiState {
  theme: Theme;
  toggleTheme: () => void;
  status: Status;
  error: string | null;
  me: MarMe | null;
  locationId: string | null;
  setStatus: (s: Status, error?: string | null) => void;
  setMe: (me: MarMe | null) => void;
  setLocation: (id: string | null) => void;
  reset: () => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      status: "unknown",
      error: null,
      me: null,
      locationId: null,
      setStatus: (status, error = null) => set({ status, error }),
      setMe: (me) => set({ me }),
      setLocation: (locationId) => set({ locationId }),
      // Never back to 'unknown' after a sign-out - that is a spinner with no exit.
      reset: () => set({ status: "signed-out", me: null, error: null }),
    }),
    { name: "sehgal-maruti-ui", partialize: (s) => ({ theme: s.theme, locationId: s.locationId }) },
  ),
);
