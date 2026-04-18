import { describe, expect, it } from "vitest";
import { ELEMENTS } from "@/lib/labs/periodic-table/data";

describe("periodic table data", () => {
  it("contains all 118 elements", () => {
    expect(ELEMENTS).toHaveLength(118);
  });

  it("has atomic numbers only from 1 to 118", () => {
    expect(ELEMENTS.every((element) => element.atomicNumber >= 1 && element.atomicNumber <= 118)).toBe(true);
  });

  it("has no duplicate atomic numbers", () => {
    const atomicNumbers = ELEMENTS.map((element) => element.atomicNumber);
    expect(new Set(atomicNumbers).size).toBe(118);
  });

  it("has required fields present on every element", () => {
    for (const element of ELEMENTS) {
      expect(element.symbol).toEqual(expect.any(String));
      expect(element.name).toEqual(expect.any(String));
      expect(element.atomicNumber).toEqual(expect.any(Number));
      expect(element.atomicMass).toEqual(expect.any(Number));
      expect(element.period).toEqual(expect.any(Number));
      expect(["s", "p", "d", "f"]).toContain(element.block);
      expect(element.category).toEqual(expect.any(String));
      expect(Array.isArray(element.shells)).toBe(true);
      expect(element.electronConfig).toEqual(expect.any(String));
      expect("group" in element).toBe(true);
      expect("electronegativity" in element).toBe(true);
      expect("meltingPoint" in element).toBe(true);
      expect("boilingPoint" in element).toBe(true);
    }
  });

  it("has expected reference elements", () => {
    expect(ELEMENTS.find((element) => element.atomicNumber === 1)).toMatchObject({
      atomicNumber: 1,
      symbol: "H",
      shells: [1],
    });
    expect(ELEMENTS.find((element) => element.atomicNumber === 6)).toMatchObject({
      atomicNumber: 6,
      symbol: "C",
      shells: [2, 4],
    });
    expect(ELEMENTS.find((element) => element.atomicNumber === 79)).toMatchObject({
      atomicNumber: 79,
      symbol: "Au",
    });
    expect(ELEMENTS.find((element) => element.atomicNumber === 118)).toMatchObject({
      atomicNumber: 118,
      symbol: "Og",
    });
  });
});
