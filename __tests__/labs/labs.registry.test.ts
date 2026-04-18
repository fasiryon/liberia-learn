import { describe, expect, it } from "vitest";
import { getLabDefinition, isValidLabId, labRegistry } from "@/lib/labs/registry";

describe("labs registry", () => {
  it("getLabDefinition throws on unknown labId", () => {
    expect(() => getLabDefinition("unknown-lab")).toThrow("Unknown lab id");
  });

  it("isValidLabId returns false for unknown ids", () => {
    expect(isValidLabId("unknown-lab")).toBe(false);
  });

  it("registers gravity plus three partial labs", () => {
    expect(Object.keys(labRegistry).sort()).toEqual([
      "gravity-explorer",
      "human-heart",
      "molecule-motion",
      "pendulum-lab",
    ]);
    expect(labRegistry["gravity-explorer"]?.partial).toBeUndefined();
    expect(labRegistry["pendulum-lab"]?.partial).toBe(true);
    expect(labRegistry["molecule-motion"]?.partial).toBe(true);
    expect(labRegistry["human-heart"]?.partial).toBe(true);
  });
});
