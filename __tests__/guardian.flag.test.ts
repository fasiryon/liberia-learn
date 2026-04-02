// __tests__/guardian.flag.test.ts
// Verifies the guardian portal flag split — either env var enables the portal.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Isolate env for each test
const originalEnv = { ...process.env };

beforeEach(() => {
  // Clear both guardian portal flags before each test
  delete process.env.ENABLE_GUARDIAN_PORTAL;
  delete process.env.NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL;
});

afterEach(() => {
  // Restore original env
  process.env.ENABLE_GUARDIAN_PORTAL = originalEnv.ENABLE_GUARDIAN_PORTAL;
  process.env.NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL =
    originalEnv.NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL;
});

describe("isGuardianPortalEnabled flag split", () => {
  it("returns true when both vars are absent", async () => {
    const { isGuardianPortalEnabled } = await import("@/lib/serverFlags");
    expect(isGuardianPortalEnabled()).toBe(true);
  });

  it("returns true when ENABLE_GUARDIAN_PORTAL is 'true'", async () => {
    process.env.ENABLE_GUARDIAN_PORTAL = "true";
    const { isGuardianPortalEnabled } = await import("@/lib/serverFlags");
    expect(isGuardianPortalEnabled()).toBe(true);
  });

  it("returns true when NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL is 'true'", async () => {
    process.env.NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL = "true";
    const { isGuardianPortalEnabled } = await import("@/lib/serverFlags");
    expect(isGuardianPortalEnabled()).toBe(true);
  });

  it("returns false when vars are set to 'false'", async () => {
    process.env.ENABLE_GUARDIAN_PORTAL = "false";
    process.env.NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL = "false";
    const { isGuardianPortalEnabled } = await import("@/lib/serverFlags");
    expect(isGuardianPortalEnabled()).toBe(false);
  });

  it("returns true when both are 'true'", async () => {
    process.env.ENABLE_GUARDIAN_PORTAL = "true";
    process.env.NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL = "true";
    const { isGuardianPortalEnabled } = await import("@/lib/serverFlags");
    expect(isGuardianPortalEnabled()).toBe(true);
  });
});

describe("default-on flags", () => {
  it("isAdaptiveEngineEnabled returns true when ENABLE_ADAPTIVE_ENGINE is not set", async () => {
    delete process.env.ENABLE_ADAPTIVE_ENGINE;
    const { isAdaptiveEngineEnabled } = await import("@/lib/serverFlags");
    expect(isAdaptiveEngineEnabled()).toBe(true);
  });

  it("isAdaptiveEngineEnabled returns true when ENABLE_ADAPTIVE_ENGINE is 'true'", async () => {
    process.env.ENABLE_ADAPTIVE_ENGINE = "true";
    const { isAdaptiveEngineEnabled } = await import("@/lib/serverFlags");
    expect(isAdaptiveEngineEnabled()).toBe(true);
  });

  it("isInterventionEngineEnabled returns true when ENABLE_INTERVENTION_ENGINE is not set", async () => {
    delete process.env.ENABLE_INTERVENTION_ENGINE;
    const { isInterventionEngineEnabled } = await import("@/lib/serverFlags");
    expect(isInterventionEngineEnabled()).toBe(true);
  });

  it("isInterventionWorkflowEnabled returns true when ENABLE_INTERVENTION_WORKFLOW is not set", async () => {
    delete process.env.ENABLE_INTERVENTION_WORKFLOW;
    const { isInterventionWorkflowEnabled } = await import("@/lib/serverFlags");
    expect(isInterventionWorkflowEnabled()).toBe(true);
  });

  it("isTextbookCompilerEnabled returns true when ENABLE_TEXTBOOK_COMPILER is not set", async () => {
    delete process.env.ENABLE_TEXTBOOK_COMPILER;
    const { isTextbookCompilerEnabled } = await import("@/lib/serverFlags");
    expect(isTextbookCompilerEnabled()).toBe(true);
  });

  it("isAiAssignmentGenerationEnabled returns true when ENABLE_AI_ASSIGNMENT_GENERATION is not set", async () => {
    delete process.env.ENABLE_AI_ASSIGNMENT_GENERATION;
    const { isAiAssignmentGenerationEnabled } = await import("@/lib/serverFlags");
    expect(isAiAssignmentGenerationEnabled()).toBe(true);
  });

  it("isExamSystemEnabled returns false when ENABLE_EXAM_SYSTEM is not set", async () => {
    delete process.env.ENABLE_EXAM_SYSTEM;
    const { isExamSystemEnabled } = await import("@/lib/serverFlags");
    expect(isExamSystemEnabled()).toBe(false);
  });
});
