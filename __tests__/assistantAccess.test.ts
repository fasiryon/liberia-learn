import { describe, expect, it } from "vitest";
import {
  getAssistantRoleConfig,
  resolveAllowedMode,
} from "@/lib/ai/rag/assistantAccess";

describe("assistantAccess", () => {
  it("returns assistant config for teacher/admin/student/guardian", () => {
    expect(getAssistantRoleConfig("TEACHER")?.allowedModes).toEqual([
      "classroom",
      "policy",
      "mixed",
    ]);
    expect(getAssistantRoleConfig("ADMIN")?.allowedModes).toEqual([
      "classroom",
      "policy",
      "mixed",
    ]);
    expect(getAssistantRoleConfig("STUDENT")?.allowedModes).toEqual(["classroom"]);
    expect(getAssistantRoleConfig("GUARDIAN")?.allowedModes).toEqual(["classroom"]);
  });

  it("rejects unsupported roles", () => {
    expect(getAssistantRoleConfig("MOE_OFFICIAL")).toBeNull();
    expect(resolveAllowedMode("MOE_OFFICIAL", "mixed")).toBeNull();
  });

  it("enforces classroom-only mode for student and guardian", () => {
    expect(resolveAllowedMode("STUDENT", "policy")).toBe("classroom");
    expect(resolveAllowedMode("GUARDIAN", "mixed")).toBe("classroom");
  });
});
