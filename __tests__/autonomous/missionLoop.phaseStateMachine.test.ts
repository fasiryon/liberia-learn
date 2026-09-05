import { describe, expect, it } from "vitest";
import {
  IllegalPhaseTransitionError,
  assertLegalPhaseTransition,
  deriveMissionStatus,
} from "@/lib/autonomous/missionLoop/phaseStateMachine";
import type { PhaseStatus } from "@/lib/autonomous/missionLoop/types";

describe("assertLegalPhaseTransition", () => {
  const legalPairs: Array<[PhaseStatus, PhaseStatus]> = [
    ["NOT_STARTED", "IN_PROGRESS"],
    ["IN_PROGRESS", "BLOCKED"],
    ["IN_PROGRESS", "VERIFYING"],
    ["IN_PROGRESS", "FAILED"],
    ["BLOCKED", "IN_PROGRESS"],
    ["BLOCKED", "FAILED"],
    ["VERIFYING", "COMPLETE"],
    ["VERIFYING", "IN_PROGRESS"],
    ["VERIFYING", "FAILED"],
  ];

  it.each(legalPairs)("allows %s -> %s", (from, to) => {
    expect(() => assertLegalPhaseTransition(from, to)).not.toThrow();
  });

  const illegalPairs: Array<[PhaseStatus, PhaseStatus]> = [
    ["NOT_STARTED", "COMPLETE"],
    ["NOT_STARTED", "VERIFYING"],
    ["COMPLETE", "IN_PROGRESS"],
    ["FAILED", "IN_PROGRESS"],
    ["IN_PROGRESS", "NOT_STARTED"],
    ["BLOCKED", "COMPLETE"],
    ["BLOCKED", "VERIFYING"],
    ["VERIFYING", "BLOCKED"],
  ];

  it.each(illegalPairs)("rejects %s -> %s", (from, to) => {
    expect(() => assertLegalPhaseTransition(from, to)).toThrow(IllegalPhaseTransitionError);
  });
});

describe("deriveMissionStatus", () => {
  it("returns NOT_STARTED for an empty phase list", () => {
    expect(deriveMissionStatus([])).toBe("NOT_STARTED");
  });

  it("returns NOT_STARTED when every phase is NOT_STARTED", () => {
    expect(deriveMissionStatus(["NOT_STARTED", "NOT_STARTED"])).toBe("NOT_STARTED");
  });

  it("returns COMPLETE when every phase is COMPLETE", () => {
    expect(deriveMissionStatus(["COMPLETE", "COMPLETE"])).toBe("COMPLETE");
  });

  it("returns FAILED when any phase is FAILED, even if others are COMPLETE", () => {
    expect(deriveMissionStatus(["COMPLETE", "FAILED"])).toBe("FAILED");
  });

  it("returns IN_PROGRESS when phases are mixed and none FAILED", () => {
    expect(deriveMissionStatus(["COMPLETE", "IN_PROGRESS"])).toBe("IN_PROGRESS");
    expect(deriveMissionStatus(["NOT_STARTED", "VERIFYING"])).toBe("IN_PROGRESS");
  });
});
