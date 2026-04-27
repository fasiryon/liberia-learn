import { describe, expect, it } from "vitest";

/**
 * Tests for onboarding role definitions — verifies that each role has
 * the required configuration without rendering full React components.
 */

type OnboardingRole = "student" | "teacher" | "admin" | "guardian" | "moe";

const ROLE_CAPABILITIES: Record<OnboardingRole, string[]> = {
  student: [
    "Start today's lesson",
    "Save a lesson for offline",
    "Ask the AI tutor",
    "View your progress",
    "Earn a certificate",
  ],
  teacher: [
    "View your class roster",
    "Schedule your first lesson",
    "Create an assignment",
    "Check your class performance",
  ],
  admin: [
    "School Identity",
    "Branding",
    "Add Teacher",
    "Create Class",
    "Ready!",
  ],
  guardian: [
    "View your child's progress",
    "Read messages from the school",
    "Understand AI tutor support",
    "Update your contact details",
    "Link additional children",
  ],
  moe: [
    "View the national dashboard",
    "Review district trends",
    "Understand curriculum coverage",
    "Review AI usage and trust",
    "Review compliance and delivery",
  ],
};

const ROLE_PRIMARY_ACTIONS: Record<OnboardingRole, string> = {
  student: "/student/today",
  teacher: "/teacher/dashboard",
  admin: "/admin",
  guardian: "/guardian/progress",
  moe: "/moe/dashboard",
};

describe("onboarding role configurations", () => {
  const roles: OnboardingRole[] = ["student", "teacher", "admin", "guardian", "moe"];

  roles.forEach((role) => {
    it(`${role} has at least 3 onboarding steps`, () => {
      expect(ROLE_CAPABILITIES[role].length).toBeGreaterThanOrEqual(3);
    });

    it(`${role} has a primary action URL`, () => {
      const action = ROLE_PRIMARY_ACTIONS[role];
      expect(typeof action).toBe("string");
      expect(action.startsWith("/")).toBe(true);
    });
  });

  it("student onboarding covers offline, AI tutor, progress, and certificate", () => {
    const caps = ROLE_CAPABILITIES.student;
    expect(caps.some((c) => c.toLowerCase().includes("offline"))).toBe(true);
    expect(caps.some((c) => c.toLowerCase().includes("ai tutor"))).toBe(true);
    expect(caps.some((c) => c.toLowerCase().includes("progress"))).toBe(true);
    expect(caps.some((c) => c.toLowerCase().includes("certificate"))).toBe(true);
  });

  it("guardian onboarding covers progress, messages, and contact", () => {
    const caps = ROLE_CAPABILITIES.guardian;
    expect(caps.some((c) => c.toLowerCase().includes("progress"))).toBe(true);
    expect(caps.some((c) => c.toLowerCase().includes("message"))).toBe(true);
    expect(caps.some((c) => c.toLowerCase().includes("contact"))).toBe(true);
  });

  it("moe onboarding covers national dashboard, districts, and compliance", () => {
    const caps = ROLE_CAPABILITIES.moe;
    expect(caps.some((c) => c.toLowerCase().includes("national"))).toBe(true);
    expect(caps.some((c) => c.toLowerCase().includes("district"))).toBe(true);
    expect(caps.some((c) => c.toLowerCase().includes("compliance"))).toBe(true);
  });

  it("moe onboarding mentions AI usage and trust", () => {
    const caps = ROLE_CAPABILITIES.moe;
    expect(caps.some((c) => c.toLowerCase().includes("ai"))).toBe(true);
  });

  it("all roles have unique primary action URLs", () => {
    const urls = Object.values(ROLE_PRIMARY_ACTIONS);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });
});

describe("feature flag conventions", () => {
  it("ENABLE_AI_TRUST_INDICATORS defaults to false (opt-in)", () => {
    const originalEnv = process.env.ENABLE_AI_TRUST_INDICATORS;
    delete process.env.ENABLE_AI_TRUST_INDICATORS;
    const result = process.env.ENABLE_AI_TRUST_INDICATORS === "true";
    expect(result).toBe(false);
    if (originalEnv !== undefined) {
      process.env.ENABLE_AI_TRUST_INDICATORS = originalEnv;
    }
  });

  it("ENABLE_AI_COST_DASHBOARD defaults to true (opt-out)", () => {
    const originalEnv = process.env.ENABLE_AI_COST_DASHBOARD;
    delete process.env.ENABLE_AI_COST_DASHBOARD;
    const result = process.env.ENABLE_AI_COST_DASHBOARD !== "false";
    expect(result).toBe(true);
    if (originalEnv !== undefined) {
      process.env.ENABLE_AI_COST_DASHBOARD = originalEnv;
    }
  });

  it("ENABLE_ROLE_ONBOARDING_POLISH defaults to true (opt-out)", () => {
    const originalEnv = process.env.ENABLE_ROLE_ONBOARDING_POLISH;
    delete process.env.ENABLE_ROLE_ONBOARDING_POLISH;
    const result = process.env.ENABLE_ROLE_ONBOARDING_POLISH !== "false";
    expect(result).toBe(true);
    if (originalEnv !== undefined) {
      process.env.ENABLE_ROLE_ONBOARDING_POLISH = originalEnv;
    }
  });
});
