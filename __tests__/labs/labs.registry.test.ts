import { describe, expect, it } from "vitest";
import { getLabDefinition, isValidLabId, labRegistry } from "@/lib/labs/registry";

describe("labs registry", () => {
  it("getLabDefinition throws on unknown labId", () => {
    expect(() => getLabDefinition("unknown-lab")).toThrow("Unknown lab id");
  });

  it("isValidLabId returns false for unknown ids", () => {
    expect(isValidLabId("unknown-lab")).toBe(false);
  });

  it("registers twelve complete labs", () => {
    expect(Object.keys(labRegistry).sort()).toEqual([
      "cell-division",
      "chemical-reaction",
      "ecosystem-balance",
      "electric-circuit",
      "gravity-explorer",
      "human-heart",
      "molecule-motion",
      "pendulum-lab",
      "periodic-table",
      "tectonic-plates",
      "wave-motion",
      "weather-system",
    ]);
    expect(labRegistry["cell-division"]?.partial).toBeUndefined();
    expect(labRegistry["chemical-reaction"]?.partial).toBeUndefined();
    expect(labRegistry["electric-circuit"]?.partial).toBeUndefined();
    expect(labRegistry["ecosystem-balance"]?.partial).toBeUndefined();
    expect(labRegistry["gravity-explorer"]?.partial).toBeUndefined();
    expect(labRegistry["pendulum-lab"]?.partial).toBeUndefined();
    expect(labRegistry["molecule-motion"]?.partial).toBeUndefined();
    expect(labRegistry["human-heart"]?.partial).toBeUndefined();
    expect(labRegistry["periodic-table"]?.partial).toBeUndefined();
    expect(labRegistry["tectonic-plates"]?.partial).toBeUndefined();
    expect(labRegistry["weather-system"]?.partial).toBeUndefined();
    expect(labRegistry["wave-motion"]?.partial).toBeUndefined();
  });
});
