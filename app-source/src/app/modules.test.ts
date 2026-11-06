import { describe, expect, it } from "vitest";
import { GROUPS, MODULES, countBy, moduleById, modulesOf } from "./modules";

// The one registry must stay honest: every group filled, ids unique, every module names its source and its next
// wiring step, and a WORKING / BUILT module always has a real screen to open.
describe("module registry (Ravi 23-10-2026, Daily Command point 5 + 02-11-2026 Unified Dealership App)", () => {
  it("has the 11 groups of the order, each with modules", () => {
    expect(GROUPS.map((g) => g.id)).toEqual([
      "retention", "crm", "insurance", "bodyshop", "workshop", "estimate", "parts", "reports", "truth", "whatsapp", "tenant",
    ]);
    for (const g of GROUPS) expect(modulesOf(g.id).length).toBeGreaterThan(0);
  });

  it("has unique ids and every module in a known group", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MODULES) expect(GROUPS.some((g) => g.id === m.group)).toBe(true);
  });

  it("names a source and a next step for every module", () => {
    for (const m of MODULES) {
      expect(m.source.trim().length, m.id).toBeGreaterThan(3);
      expect(m.next.trim().length, m.id).toBeGreaterThan(3);
    }
  });

  it("gives every WORKING or BUILT module a screen (the sign-in itself is the one exception)", () => {
    for (const m of MODULES.filter((x) => x.state !== "PLACEHOLDER" && x.id !== "tn-login")) expect(m.screen, m.id).toBeTruthy();
  });

  it("wires CRM (SMR & PSF), Insurance Calling (9 modules), and Vehicle History as WORKING", () => {
    for (const crmId of ["crm-pms-calling", "crm-smr", "crm-month", "crm-psf"]) {
      const m = moduleById(crmId);
      expect(m?.state, crmId).toBe("WORKING");
      expect(m?.screen, crmId).toBe("crm-pms");
    }
    for (const insId of [
      "ins-workbench",
      "ins-renewed",
      "ins-board",
      "ins-daily",
      "ins-coverage",
      "ins-ic-matrix",
      "ins-fields",
      "ins-portal",
      "ins-claims",
    ]) {
      const m = moduleById(insId);
      expect(m?.state, insId).toBe("WORKING");
      expect(m?.screen, insId).toBe("insurance");
    }
    expect(moduleById("ws-vehicle-history")?.state).toBe("WORKING");
    expect(moduleById("ws-vehicle-history")?.screen).toBe("vehicle-history");
  });

  it("keeps Sense on hold and never uses the word partial", () => {
    expect(MODULES.find((m) => m.id === "crm-sense")?.state).toBe("PLACEHOLDER");
    expect(MODULES.find((m) => m.id === "crm-sense")?.screen).toBeUndefined();
    expect(JSON.stringify(MODULES).toLowerCase()).not.toContain("partial");
    expect(countBy("WORKING") + countBy("BUILT") + countBy("PLACEHOLDER")).toBe(MODULES.length);
  });
});
