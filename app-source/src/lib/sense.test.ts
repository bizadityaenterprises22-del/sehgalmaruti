import { describe, expect, it } from "vitest";
import { extract, spokenRupees, suggestFollowUps } from "./sense";

describe("spokenRupees", () => {
  it("reads lakh and hazaar as spoken", () => {
    expect(spokenRupees("on road 7.5 lakh")).toBe(750000);
    expect(spokenRupees("7 lakh 20 hazaar")).toBe(720000);
    expect(spokenRupees("saat lakh")).toBe(700000);
    expect(spokenRupees("EMI 14 thousand")).toBe(14000);
    expect(spokenRupees("₹ 7,50,000")).toBe(750000);
    expect(spokenRupees("no money here")).toBeNull();
  });
});

describe("extract", () => {
  const talk =
    "Good morning sir. Brezza ZXI automatic petrol chahiye. On road price kitna padega, 13 lakh? " +
    "Loan 5 saal ka, EMI around 18 thousand, interest 9.5 percent. Purani gaadi exchange karni hai. " +
    "My son plays cricket on Sunday. Test drive kal karenge.";
  const r = extract(talk);

  it("keeps car sentences and drops the rest", () => {
    expect(r.relevant.some((s) => s.includes("cricket"))).toBe(false);
    expect(r.dropped).toBeGreaterThanOrEqual(1);
  });
  it("drafts fields with the sentence they came from", () => {
    const get = (k: string) => r.fields.filter((f) => f.key === k).map((f) => f.value);
    expect(get("model")).toContain("Brezza");
    expect(get("variant")).toContain("ZXI");
    expect(get("transmission")).toContain("AUTOMATIC");
    expect(get("on_road_as_spoken")).toContain("₹13,00,000");
    expect(get("emi_as_spoken")).toContain("₹18,000");
    expect(get("interest_as_spoken")).toContain("9.5%");
    for (const f of r.fields) expect(f.excerpt.length).toBeGreaterThan(0);
  });
  it("suggests follow-ups only as drafts", () => {
    const s = suggestFollowUps(r);
    expect(s.join(" ")).toMatch(/test drive/i);
    expect(s.join(" ")).toMatch(/exchange/i);
  });
  it("service talk", () => {
    const x = extract("Gaadi me brake se awaaz aa rahi hai. Estimate 4500 rupees, approval chahiye. Extended warranty hai kya?");
    expect(x.topics).toEqual(expect.arrayContaining(["service", "labour", "warranty"]));
    expect(x.fields.find((f) => f.key === "estimate_as_spoken")?.value).toBe("₹4,500");
  });
});
