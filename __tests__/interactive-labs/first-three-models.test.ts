import { describe, expect, it } from "vitest";
import { waterState, fractionValue, splitFraction, combineFractions, commonDenominator } from "@/lib/interactive-labs/v2/definitions/firstThree/models";
import map from "@/lib/interactive-labs/v2/definitions/firstThree/map-data.json";

describe("first-three scientific and mathematical invariants", () => {
  it.each([[0,-20],[42,0],[209,0],[376,0],[585,50],[794,100],[1924,100],[3054,100],[3094,120]])("maps energy %s J/g to %s C without inventing phase-change heating", (energy, temperature) => {
    expect(waterState(energy).temperature).toBeCloseTo(temperature, 8);
  });
  it("conserves phase fractions and exactly reverses the ideal equilibrium curve", () => {
    let previous = -21;
    for (let energy=0; energy<=3094; energy+=7) {
      const state=waterState(energy);
      expect(state.solid+state.liquid+state.gas).toBeCloseTo(1);
      expect(state.temperature).toBeGreaterThanOrEqual(previous);
      expect(waterState(energy)).toEqual(state);
      previous=state.temperature;
    }
    expect(waterState(209)).toMatchObject({ solid:0.5, liquid:0.5, gas:0 });
    expect(waterState(1924)).toMatchObject({ solid:0, liquid:0.5, gas:0.5 });
  });
  it("subdivides half into quarters and eighths without changing quantity", () => {
    const quarters=splitFraction(2,1,2)!;
    expect(quarters).toEqual({ denominator:4, mask:3 });
    const eighths=splitFraction(quarters.denominator,quarters.mask,2)!;
    expect(fractionValue(2,1)).toBe(0.5);
    expect(fractionValue(quarters.denominator,quarters.mask)).toBe(0.5);
    expect(fractionValue(eighths.denominator,eighths.mask)).toBe(0.5);
    expect(splitFraction(8,15,2)).toBeNull();
  });
  it("represents improper fractions and composes/removes exact pieces", () => {
    expect(fractionValue(4,31)).toBe(1.25);
    expect(combineFractions({ denominator:4,mask:1 }, { denominator:4,mask:1 },1)).toEqual({ denominator:4,mask:3 });
    expect(combineFractions({ denominator:4,mask:3 }, { denominator:4,mask:1 },-1)).toEqual({ denominator:4,mask:1 });
    expect(combineFractions({ denominator:4,mask:1 }, { denominator:4,mask:3 },-1)).toBeNull();
  });
  it("never silently caps a common denominator", () => {
    expect(commonDenominator(5,2)).toBe(10);
    expect(commonDenominator(4,3)).toBe(12);
    expect(commonDenominator(5,7)).toBeNull();
  });
  it("uses all 15 pinned, connected county outlines and symmetric shared-segment adjacency", () => {
    expect(map.counties).toHaveLength(15);
    expect(map.sourceSvgSha256).toBe("08cf9d8271658aaf95f3111bd13d98538feaa4214b8e717836292062b2464746");
    const reached=new Set([map.counties[0].id]);
    for(let pass=0;pass<15;pass++)for(const c of map.counties)if(reached.has(c.id))c.neighbours.forEach(n=>reached.add(n));
    expect(reached.size).toBe(15);
    for(const c of map.counties)for(const n of c.neighbours)expect(map.counties.find(o=>o.id===n)?.neighbours).toContain(c.id);
    expect(map.counties.find(c=>c.id==="nimba")?.capital).toBe("Sanniquellie");
    expect(map.counties.find(c=>c.id==="montserrado")?.capital).toBe("Bensonville (Bentol)");
  });
});
