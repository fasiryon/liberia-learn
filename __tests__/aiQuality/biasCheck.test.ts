import { describe, expect, it } from "vitest";
import { getBiasCheckMetric } from "@/lib/aiQuality/biasCheck";

describe("getBiasCheckMetric", () => {
  it("always reports not-measurable with an honest, specific reason", () => {
    const result = getBiasCheckMetric();

    expect(result.measurable).toBe(false);
    expect(result.reason).toMatch(/no defensible starting scope/i);
  });
});
