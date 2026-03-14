import { describe, expect, it } from "vitest";
import { generateStudentId } from "@/lib/studentId";

describe("generateStudentId", () => {
  it("formats IDs as LBR-YYYY-CODE-SEQUENCE", () => {
    expect(generateStudentId({ schoolCode: "cha", year: 2026, sequence: 42 })).toBe("LBR-2026-CHA-0042");
  });

  it("limits school code to four uppercase characters", () => {
    expect(generateStudentId({ schoolCode: "cha-west", year: 2026, sequence: 7 })).toBe("LBR-2026-CHAW-0007");
  });

  it("is deterministic for the same inputs", () => {
    expect(generateStudentId({ schoolCode: "mcs", year: 2026, sequence: 15 })).toBe(
      generateStudentId({ schoolCode: "mcs", year: 2026, sequence: 15 })
    );
  });
});
