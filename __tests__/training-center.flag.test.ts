/**
 * __tests__/training-center.flag.test.ts
 *
 * Tests for the ENABLE_TRAINING_CENTER feature flag.
 *
 * Validates:
 *   • Flag is OFF by default.
 *   • Flag is enabled only by the exact string "true".
 *   • isFeatureEnabled() reflects live env var mutations (no module caching).
 *   • TRAINING_MODULES are accessible in SSR (node) context with no browser globals.
 */

import { describe, it, expect, afterEach } from "vitest";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { TRAINING_MODULES, MODULES_BY_LEVEL, getModuleById, LEVEL_LABELS } from "@/lib/training/modules";

// ── Shared cleanup ────────────────────────────────────────────────────────────

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER;
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ENABLE_TRAINING_CENTER feature flag", () => {
  it("is disabled by default when env var is absent", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER;
    expect(isFeatureEnabled("ENABLE_TRAINING_CENTER")).toBe(false);
  });

  it("is enabled when env var is exactly 'true'", () => {
    process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER = "true";
    expect(isFeatureEnabled("ENABLE_TRAINING_CENTER")).toBe(true);
  });

  it("is NOT enabled by '1'", () => {
    process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER = "1";
    expect(isFeatureEnabled("ENABLE_TRAINING_CENTER")).toBe(false);
  });

  it("is NOT enabled by 'yes'", () => {
    process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER = "yes";
    expect(isFeatureEnabled("ENABLE_TRAINING_CENTER")).toBe(false);
  });

  it("is NOT enabled by 'TRUE' (wrong case)", () => {
    process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER = "TRUE";
    expect(isFeatureEnabled("ENABLE_TRAINING_CENTER")).toBe(false);
  });

  it("returns false after env var is removed", () => {
    process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER = "true";
    expect(isFeatureEnabled("ENABLE_TRAINING_CENTER")).toBe(true);
    delete process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER;
    expect(isFeatureEnabled("ENABLE_TRAINING_CENTER")).toBe(false);
  });

  it("operates independently of ENABLE_GUIDED_ONBOARDING", () => {
    process.env.NEXT_PUBLIC_ENABLE_TRAINING_CENTER = "true";
    delete process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING;
    expect(isFeatureEnabled("ENABLE_TRAINING_CENTER")).toBe(true);
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("TRAINING_MODULES — SSR safety (node env, no browser globals)", () => {
  it("can be imported and accessed without window or document", () => {
    // If this runs without throwing, SSR safety is confirmed
    expect(typeof window).toBe("undefined");
    expect(TRAINING_MODULES).toBeDefined();
    expect(Array.isArray(TRAINING_MODULES)).toBe(true);
  });

  it("has exactly 8 modules", () => {
    expect(TRAINING_MODULES).toHaveLength(8);
  });

  it("has 2 Level 1 modules", () => {
    expect(MODULES_BY_LEVEL[1]).toHaveLength(2);
  });

  it("has 4 Level 2 modules", () => {
    expect(MODULES_BY_LEVEL[2]).toHaveLength(4);
  });

  it("has 2 Level 3 modules", () => {
    expect(MODULES_BY_LEVEL[3]).toHaveLength(2);
  });

  it("every module has an id, title, level, estimatedMinutes, and at least 3 steps", () => {
    for (const mod of TRAINING_MODULES) {
      expect(mod.id, `${mod.id} — missing id`).toBeTruthy();
      expect(mod.title, `${mod.id} — missing title`).toBeTruthy();
      expect([1, 2, 3], `${mod.id} — invalid level`).toContain(mod.level);
      expect(mod.estimatedMinutes, `${mod.id} — estimatedMinutes`).toBeGreaterThanOrEqual(5);
      expect(mod.steps.length, `${mod.id} — needs at least 3 steps`).toBeGreaterThanOrEqual(3);
    }
  });

  it("all step texts are non-empty strings", () => {
    for (const mod of TRAINING_MODULES) {
      for (const step of mod.steps) {
        expect(typeof step.text).toBe("string");
        expect(step.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("module IDs are unique", () => {
    const ids = TRAINING_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getModuleById returns the correct module", () => {
    const first = TRAINING_MODULES[0];
    expect(getModuleById(first.id)).toEqual(first);
  });

  it("getModuleById returns undefined for an unknown id", () => {
    expect(getModuleById("does-not-exist")).toBeUndefined();
  });

  it("LEVEL_LABELS covers all three levels", () => {
    expect(LEVEL_LABELS[1]).toContain("1");
    expect(LEVEL_LABELS[2]).toContain("2");
    expect(LEVEL_LABELS[3]).toContain("3");
  });

  it("Level 1 first module is 'Login & Navigation Basics'", () => {
    const l1 = MODULES_BY_LEVEL[1];
    expect(l1[0].title).toBe("Login & Navigation Basics");
  });

  it("Level 3 last module is 'Use Guided Onboarding & Accessibility Tools'", () => {
    const l3 = MODULES_BY_LEVEL[3];
    expect(l3[l3.length - 1].title).toBe("Use Guided Onboarding & Accessibility Tools");
  });
});
