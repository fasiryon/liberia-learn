import { describe, expect, it } from "vitest";
import { getLabDefinition, isValidLabId, labRegistry } from "@/lib/labs/registry";

describe("labs registry", () => {
  it("getLabDefinition throws on unknown labId", () => {
    expect(() => getLabDefinition("unknown-lab")).toThrow("Unknown lab id");
  });

  it("isValidLabId returns false for unknown ids", () => {
    expect(isValidLabId("unknown-lab")).toBe(false);
  });

  it("registers eight complete labs", () => {
    expect(Object.keys(labRegistry).sort()).toEqual([
      "cell-division",
      "ecosystem-balance",
      "electric-circuit",
      "gravity-explorer",
      "human-heart",
      "molecule-motion",
      "pendulum-lab",
      "wave-motion",
    ]);
    expect(labRegistry["cell-division"]?.partial).toBeUndefined();
    expect(labRegistry["electric-circuit"]?.partial).toBeUndefined();
    expect(labRegistry["ecosystem-balance"]?.partial).toBeUndefined();
    expect(labRegistry["gravity-explorer"]?.partial).toBeUndefined();
    expect(labRegistry["pendulum-lab"]?.partial).toBeUndefined();
    expect(labRegistry["molecule-motion"]?.partial).toBeUndefined();
    expect(labRegistry["human-heart"]?.partial).toBeUndefined();
    expect(labRegistry["wave-motion"]?.partial).toBeUndefined();
  });
});
