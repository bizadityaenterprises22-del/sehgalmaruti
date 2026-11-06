import { describe, expect, it } from "vitest";
import {
  bestReg,
  cleanReg,
  extractAmount,
  extractPassNo,
  extractReceiptNo,
  extractRegs,
  isKnownRegFormat,
  positionalVariants,
  prettyReg,
} from "./plate";

describe("plate", () => {
  it("cleans and pretty-prints", () => {
    expect(cleanReg(" mh-12 ab 1234 ")).toBe("MH12AB1234");
    expect(prettyReg("MH12AB1234")).toBe("MH 12 AB 1234");
  });
  it("knows the Indian formats", () => {
    expect(isKnownRegFormat("MH14EA2706")).toBe(true);
    expect(isKnownRegFormat("22BH1234AA")).toBe(true);
    expect(isKnownRegFormat("HELLO")).toBe(false);
  });
  it("corrects the confusable OCR misread (Spec 01 test 7)", () => {
    expect(positionalVariants("MH14E4Z706")).toContain("MH14EA2706");
    expect(bestReg("MH14E4Z706")).toEqual({ reg: "MH14EA2706", corrected: true });
    expect(bestReg("MH14EA2706")).toEqual({ reg: "MH14EA2706", corrected: false });
  });
  it("finds registrations inside a gate pass text", () => {
    const text = "SEHGAL AUTORIDERS GATE PASS No: GP-00512\nVehicle: MH 12 VG 8258 Swift\nDriver ok";
    expect(extractRegs(text)).toEqual(["MH12VG8258"]);
    expect(extractPassNo(text)).toBe("GP-00512");
  });
  it("reads the receipt number and amount", () => {
    const text = "RECEIPT No. R/2026/1187\nLabour 1,200.00\nParts Rs 3,450.50\nGrand Total Rs. 4,650.50\nPaid by UPI";
    expect(extractReceiptNo(text)).toBe("R/2026/1187");
    expect(extractAmount(text)).toBe(4650.5);
    expect(extractAmount("nothing here")).toBeNull();
  });
});
