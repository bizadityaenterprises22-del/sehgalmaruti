import { createContext, useContext } from "react";

/*
  PLAN MODE - the same group screens and Wiring board, opened WITHOUT signing in, showing only the plan:
  module names, states, planned columns / filters / actions and data sources. No data screen opens and no
  database call is made in plan mode (the registry text is already public inside the app's JavaScript).
  `base` is the path prefix: "" inside the signed-in app, "/plan" before sign-in.
*/
export interface PlanMode {
  planOnly: boolean;
  base: string;
}

export const PlanContext = createContext<PlanMode>({ planOnly: false, base: "" });
export const usePlan = () => useContext(PlanContext);
