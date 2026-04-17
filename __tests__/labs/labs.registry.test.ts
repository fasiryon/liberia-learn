import { describe, expect, it } from "vitest";
import { getLabDefinition, isValidLabId } from "@/lib/labs/registry";

describe("labs registry", () => {
  it("getLabDefinition throws on unknown labId", () => {
    expect(() => getLabDefinition("unknown-lab")).toThrow("Unknown lab id");
  });

  it("isValidLabId returns false for unknown ids", () => {
    expect(isValidLabId("unknown-lab")).toBe(false);
  });
});
