import { describe, expect, it } from "vitest";
import type { VehicleHistoryReport, VhVisit } from "@/lib/vehicle-history/types";
import { holdupOf, overviewOf, rupees } from "./vehicleOverview";

// Invented data only - never a real customer or vehicle.
function visit(no: number, jc: VhVisit["jobcard"]): VhVisit {
  return { visit_no: no, customer: {}, vehicle: {}, jobcard: jc, demanded_repairs: [], parts: [], labour: [] };
}

const report: VehicleHistoryReport = {
  registration: "MH12AB1234",
  printed_at: "17-OCT-26 09:00 AM",
  release: "SEHGAL VH 1.0",
  scope: { mode: "consultant" },
  visits: [
    visit(4, { jobcard_date: "20/06/24", dealer_code: "XX01-01", dealer_name: "OTHER DEALER", service_type: "WASHING", psf: { cce: "Dissatisfied" } }),
    visit(3, { jobcard_date: "09/06/24 10:30", dealer_code: "XX01-01", dealer_name: "OTHER DEALER", service_type: "2ND FREE SERVICE", psf: { sa: "Satisfied" } }),
    visit(2, { jobcard_date: "15/03/24", dealer_code: "CGA1-01", dealer_name: "SEHGAL", service_type: "BODY REPAIR", mileage: "12345", total_amount: "8850.25", psf: { cce: "Satisfied" } }),
    visit(1, { jobcard_date: "12/03/24", dealer_code: "XX01-01", dealer_name: "OTHER DEALER", service_type: "WASHING", total_amount: "500" }),
  ],
};

describe("overviewOf", () => {
  const o = overviewOf(report);

  it("counts visits and reads first / last from the newest-first order", () => {
    expect(o.visits).toBe(4);
    expect(o.first).toBe("12/03/24");
    expect(o.last).toBe("20/06/24");
  });

  it("groups dealers with their newest visit date, busiest first", () => {
    expect(o.dealers).toEqual([
      { dealer: "OTHER DEALER", visits: 3, last: "20/06/24" },
      { dealer: "SEHGAL", visits: 1, last: "15/03/24" },
    ]);
  });

  it("counts service types, most common first", () => {
    expect(o.serviceTypes[0]).toEqual({ label: "WASHING", count: 2 });
    expect(o.serviceTypes).toHaveLength(3);
  });

  it("adds only the amounts we hold and says how many visits they cover", () => {
    expect(o.spent).toBe(9350.25);
    expect(o.spentOn).toBe(2);
  });

  it("takes the newest mileage we hold, with its date", () => {
    expect(o.mileage).toBe("12345");
    expect(o.mileageOn).toBe("15/03/24");
  });

  it("sorts PSF into satisfied / dissatisfied / none", () => {
    expect(o.psf).toEqual({ satisfied: 2, dissatisfied: 1, other: 0, none: 1 });
  });

  it("never invents a total when no visit has an amount", () => {
    const none = overviewOf({ ...report, visits: report.visits.map((v) => ({ ...v, jobcard: { ...v.jobcard, total_amount: undefined } })) });
    expect(none.spent).toBeNull();
    expect(none.spentOn).toBe(0);
  });

  it("copes with a report that has no visits", () => {
    const empty = overviewOf({ ...report, visits: [] });
    expect(empty.visits).toBe(0);
    expect(empty.first).toBe("");
    expect(empty.dealers).toEqual([]);
  });
});

describe("rupees", () => {
  it("uses the Indian grouping with two decimals", () => {
    expect(rupees(1234567.5)).toBe("₹12,34,567.50");
  });
});

describe("holdupOf (the holdup law: no invoice = in the workshop)", () => {
  const today = new Date(2026, 9, 27);
  const base = { ...report, visits: [] as VhVisit[] };

  it("shows the newest job card with no bill as holdup, with its days", () => {
    const r = { ...base, visits: [visit(2, { jobcard_number: "JC1", jobcard_date: "20/10/26 10:00", sa_name: "SA ONE" }), visit(1, { jobcard_date: "01/09/26", bill_number: "BR/1" })] };
    expect(holdupOf(r, today)).toMatchObject({ jobcard: "JC1", days: 7, sa: "SA ONE" });
  });

  it("is not holdup once the newest job card has a bill", () => {
    const r = { ...base, visits: [visit(1, { jobcard_number: "JC1", jobcard_date: "20/10/26", bill_date: "21/10/26" })] };
    expect(holdupOf(r, today)).toBeNull();
  });

  it("never paints an old unbilled visit red (older files miss bill numbers)", () => {
    const r = { ...base, visits: [visit(1, { jobcard_number: "JC0", jobcard_date: "27/10/20" })] };
    expect(holdupOf(r, today)).toBeNull();
  });

  it("looks only at the newest job card", () => {
    const r = { ...base, visits: [visit(2, { jobcard_date: "25/10/26", bill_number: "BR/9" }), visit(1, { jobcard_number: "JC1", jobcard_date: "10/10/26" })] };
    expect(holdupOf(r, today)).toBeNull();
  });
});
