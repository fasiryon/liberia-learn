// Interactive Learning V4: the models every visual block and every formative key are computed from.
import { describe, expect, it } from "vitest";
import { compositePerimeter, isTriangle, rectangleArea, rectanglePerimeter, shapeArea, shapePerimeter, shapeProblems, triangleArea, triangleSides, type ShapeSpec } from "@/lib/learner-experience/teaching/models/geometry";
import { compare, diagnoseComparison, diagnoseShading, equivalent, simplify } from "@/lib/learner-experience/teaching/models/fractions";
import { areaModel, diagnosePartial, placeValueParts, repeatedAddition } from "@/lib/learner-experience/teaching/models/multiplication";
import { diagnoseNumeric, parseAnswer, parseUnit, type ResponsePart } from "@/lib/learner-experience/teaching/models/numericResponse";
import { particleBehaviour, seededRandom, stateOfWater } from "@/lib/learner-experience/teaching/models/matter";
import { LIBERIA_COUNTIES, countyById, directionBetween } from "@/lib/learner-experience/teaching/models/liberiaCounties";

const random = seededRandom(20261021);
const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

describe("geometry", () => {
  it("the field example: 90 m × 45 m", () => {
    expect(rectangleArea(90, 45)).toBe(4050);
    expect(rectanglePerimeter(90, 45)).toBe(270);
  });

  it("property: a rectangle's area is l × w and its perimeter 2(l + w), and a one-rectangle composite agrees", () => {
    for (let n = 0; n < 200; n++) {
      const length = int(1, 30), width = int(1, 30);
      const composite: ShapeSpec = { kind: "COMPOSITE", rects: [{ x: 0, y: 0, w: length, h: width }], unit: "m" };
      expect(shapeArea(composite)).toBe(length * width);
      expect(compositePerimeter(composite)).toBe(2 * (length + width));
    }
  });

  it("an L-shape's perimeter equals its bounding rectangle's, and its area the sum of its parts", () => {
    const garden: ShapeSpec = { kind: "COMPOSITE", rects: [{ x: 0, y: 0, w: 8, h: 4 }, { x: 0, y: 4, w: 3, h: 5 }], unit: "m" };
    expect(shapeArea(garden)).toBe(47);
    expect(shapePerimeter(garden)).toBe(34);
  });

  it("triangles: half of base × height; labelled sides must match the drawn geometry", () => {
    expect(triangleArea(14, 12)).toBe(84);
    expect(triangleSides({ kind: "TRIANGLE", base: 14, height: 12, apexOffset: 5, unit: "cm" })).toEqual([13, 15]);
    expect(shapePerimeter({ kind: "TRIANGLE", base: 14, height: 12, apexOffset: 5, unit: "cm", sideLabels: [13, 15] })).toBe(42);
    expect(shapeProblems({ kind: "TRIANGLE", base: 14, height: 12, apexOffset: 5, unit: "cm", sideLabels: [12, 15] })).toContain("triangle_side_labels_inconsistent");
    expect(isTriangle(1, 2, 5)).toBe(false);
  });

  it("property: a triangle never has more area than its bounding rectangle", () => {
    for (let n = 0; n < 200; n++) { const base = int(1, 40), height = int(1, 40); expect(triangleArea(base, height) * 2).toBe(base * height); }
  });

  it("rejects overlapping composite rectangles", () => {
    expect(shapeProblems({ kind: "COMPOSITE", rects: [{ x: 0, y: 0, w: 3, h: 3 }, { x: 2, y: 2, w: 3, h: 3 }], unit: "m" })).toContain("composite_rects_overlap");
  });
});

describe("fractions", () => {
  it("compares exactly and finds equivalents", () => {
    expect(compare({ numerator: 3, denominator: 4 }, { numerator: 5, denominator: 8 })).toBe(">");
    expect(compare({ numerator: 7, denominator: 12 }, { numerator: 2, denominator: 3 })).toBe("<");
    expect(equivalent({ numerator: 6, denominator: 8 }, { numerator: 3, denominator: 4 })).toBe(true);
    expect(simplify({ numerator: 12, denominator: 16 })).toEqual({ numerator: 3, denominator: 4 });
  });

  it("property: comparison agrees with the decimal value", () => {
    for (let n = 0; n < 500; n++) {
      const a = { numerator: int(0, 24), denominator: int(1, 12) }, b = { numerator: int(0, 24), denominator: int(1, 12) };
      const relation = compare(a, b);
      const difference = a.numerator / a.denominator - b.numerator / b.denominator;
      expect(relation).toBe(Math.abs(difference) < 1e-12 ? "=" : difference < 0 ? "<" : ">");
    }
  });

  it("diagnoses shading: equivalent partitions count, the complement and a wrong whole are named", () => {
    expect(diagnoseShading({ numerator: 2, denominator: 3 }, 3, 2).kind).toBe("MATCH");
    expect(diagnoseShading({ numerator: 2, denominator: 3 }, 6, 4).kind).toBe("EQUIVALENT");
    expect(diagnoseShading({ numerator: 3, denominator: 4 }, 4, 1).kind).toBe("COUNTED_UNSHADED");
    expect(diagnoseShading({ numerator: 2, denominator: 3 }, 5, 2).kind).toBe("WRONG_WHOLE");
  });

  it("names the larger-denominator misconception", () => {
    expect(diagnoseComparison({ numerator: 1, denominator: 8 }, { numerator: 1, denominator: 4 }, ">").misconception).toBe("LARGER_DENOMINATOR_IS_LARGER");
    expect(diagnoseComparison({ numerator: 1, denominator: 8 }, { numerator: 1, denominator: 4 }, "<").correct).toBe(true);
  });
});

describe("multiplication", () => {
  it("4 × 3 as repeated addition", () => expect(repeatedAddition(4, 3)).toBe("3 + 3 + 3 + 3"));

  it("property: an area model's partial products always add to the product", () => {
    for (let n = 0; n < 300; n++) {
      const a = int(2, 999), b = int(2, 99);
      expect(areaModel(placeValueParts(b), placeValueParts(a)).total).toBe(a * b);
    }
    expect(areaModel([10, 3], [20, 4]).cells.flat()).toEqual([200, 40, 60, 12]);
  });

  it("names the place-value and added-instead mistakes", () => {
    expect(diagnosePartial(20, 4, 8).kind).toBe("PLACE_VALUE_DROPPED");
    expect(diagnosePartial(20, 4, 24).kind).toBe("ADDED_INSTEAD");
    expect(diagnosePartial(20, 4, 80).kind).toBe("CORRECT");
  });
});

describe("numeric answers and their feedback", () => {
  const field: ShapeSpec = { kind: "RECTANGLE", length: 90, width: 45, unit: "m" };
  const area: ResponsePart = { id: "a", label: "Area", quantity: "AREA", unit: { kind: "AREA", base: "m" }, formativeKey: { value: 4050 }, misconceptions: [] };
  const perimeter: ResponsePart = { id: "p", label: "Perimeter", quantity: "PERIMETER", unit: { kind: "LENGTH", base: "m" }, formativeKey: { value: 270 }, misconceptions: [{ value: 135, feedback: "Half way.", misconceptionId: "m-half-perimeter" }] };

  it("reads numbers, separators, fractions and mixed numbers", () => {
    expect(parseAnswer("4,050 m²")).toEqual({ value: 4050, unit: "m²" });
    expect(parseAnswer("6/8")?.value).toBe(0.75);
    expect(parseAnswer("1 1/4")?.value).toBe(1.25);
    expect(parseUnit("sq m")).toEqual({ kind: "AREA", base: "m" });
    expect(parseUnit("m2")).toEqual({ kind: "AREA", base: "m" });
  });

  it("separates right answers, unit errors and area/perimeter confusion", () => {
    expect(diagnoseNumeric(area, "4050", "m²", field).result).toBe("right");
    expect(diagnoseNumeric(area, "4050", "m", field).code).toBe("UNIT_WRONG");
    expect(diagnoseNumeric(area, "4050", "", field).code).toBe("UNIT_MISSING");
    expect(diagnoseNumeric(area, "270", "m²", field).code).toBe("AREA_PERIMETER_SWAP");
    expect(diagnoseNumeric(perimeter, "4050", "m", field).code).toBe("AREA_PERIMETER_SWAP");
    expect(diagnoseNumeric(perimeter, "4,000", "m", field).code).toBe("NOT_YET");
  });

  it("names a half perimeter and keeps its misconception id", () => {
    const diagnosis = diagnoseNumeric(perimeter, "135", "m", field);
    expect(diagnosis.code).toBe("HALF_PERIMETER");
    expect(diagnosis.misconceptionId).toBe("m-half-perimeter");
  });

  it("names the forgotten half for a triangle", () => {
    const part: ResponsePart = { id: "a", label: "Area", quantity: "AREA", unit: { kind: "AREA", base: "m" }, formativeKey: { value: 60 }, misconceptions: [] };
    expect(diagnoseNumeric(part, "120", "m²", { kind: "TRIANGLE", base: 10, height: 12, apexOffset: 5, unit: "m", sideLabels: [13, 13] }).code).toBe("FORGOT_HALF");
  });

  it("accepts any equivalent fraction", () => {
    const part: ResponsePart = { id: "s", label: "Sum", quantity: "OTHER", unit: { kind: "NONE", base: "" }, formativeKey: { value: 0.75 }, misconceptions: [{ value: 0.333333333333, feedback: "Tops and bottoms.", misconceptionId: "ft07-m1" }] };
    expect(diagnoseNumeric(part, "3/4", "").result).toBe("right");
    expect(diagnoseNumeric(part, "6/8", "").result).toBe("right");
    expect(diagnoseNumeric(part, "2/6", "").misconceptionId).toBe("ft07-m1");
  });
});

describe("states of matter (pedagogical model of water at sea level)", () => {
  it("changes state at 0 °C and 100 °C", () => {
    expect([stateOfWater(-1), stateOfWater(0), stateOfWater(99), stateOfWater(100)]).toEqual(["SOLID", "LIQUID", "LIQUID", "GAS"]);
  });
  it("particles move faster and spread out as temperature rises; they never change size", () => {
    const [ice, water, steam] = [particleBehaviour(-20), particleBehaviour(25), particleBehaviour(120)];
    expect(ice.speed < water.speed && water.speed < steam.speed).toBe(true);
    expect(ice.spacing < water.spacing && water.spacing < steam.spacing).toBe(true);
  });
});

describe("Liberia counties (schematic map data)", () => {
  it("has the 15 counties with their capitals, including the corrected Nimba and Montserrado seats", () => {
    expect(LIBERIA_COUNTIES).toHaveLength(15);
    expect(new Set(LIBERIA_COUNTIES.map((county) => `${county.tile.col},${county.tile.row}`)).size).toBe(15);
    expect(countyById("nimba")?.capital).toBe("Sanniquellie");
    expect(countyById("montserrado")?.capital).toBe("Bensonville");
  });
  it("places Grand Kru between Sinoe and Maryland, and Lofa north-west of Bong", () => {
    const [sinoe, kru, maryland] = ["sinoe", "grand-kru", "maryland"].map((id) => countyById(id)!.tile);
    expect(sinoe.col < kru.col && kru.col < maryland.col).toBe(true);
    expect(directionBetween("bong", "lofa")).toBe("northwest");
  });
});
