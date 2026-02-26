import { describe, expect, it } from "vitest";
import {
  applyPercentToBase,
  backspaceDisplay,
  clearDisplay,
  computeBasicOperation,
  formatDisplayNumber,
} from "@/components/toolkit/tools/BasicCalculator";

describe("toolkit basic calculator", () => {
  it("2 + 2 = 4", () => {
    expect(computeBasicOperation(2, 2, "+")).toBe(4);
  });

  it("10 / 0 -> Error", () => {
    expect(() => computeBasicOperation(10, 0, "/")).toThrowError();
  });

  it("0.1 + 0.2 rounds to 10 decimals", () => {
    expect(formatDisplayNumber(computeBasicOperation(0.1, 0.2, "+"))).toBe("0.3");
  });

  it("max digits does not overflow", () => {
    expect(formatDisplayNumber(999999999999)).toHaveLength(12);
  });

  it("clear resets display", () => {
    expect(clearDisplay()).toBe("0");
  });

  it("backspace removes last character", () => {
    expect(backspaceDisplay("1234")).toBe("123");
  });

  it("percent operation: 50% of 200 = 100", () => {
    expect(applyPercentToBase(200, 50)).toBe(100);
  });
});
