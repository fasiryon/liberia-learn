import { describe, it, expect } from "vitest";
import { computeFieldDiff } from "@/lib/audit-diff";

describe("computeFieldDiff", () => {
  it("returns only changed fields", () => {
    const before = { status: "ACTIVE", pilotStatus: null, pilotCohort: "2026-A" };
    const after = { status: "ACTIVE", pilotStatus: "PILOT", pilotCohort: "2026-A" };
    const diff = computeFieldDiff(before, after, ["status", "pilotStatus", "pilotCohort"]);

    expect(diff).toEqual({
      pilotStatus: { from: null, to: "PILOT" },
    });
  });

  it("normalizes dates and undefined values", () => {
    const date = new Date("2026-02-19T12:00:00.000Z");
    const before = { pilotStartDate: undefined };
    const after = { pilotStartDate: date };
    const diff = computeFieldDiff(before, after, ["pilotStartDate"]);

    expect(diff).toEqual({
      pilotStartDate: { from: null, to: "2026-02-19T12:00:00.000Z" },
    });
  });
});
