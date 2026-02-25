/**
 * __tests__/intervention.engine.test.ts — Block 12B
 *
 * Tests for lib/signals/interventions/interventionEngine.ts (pure layer):
 *   - empty dataset → empty alerts, no crash
 *   - classes below MIN_CLASS_PROFILES are skipped
 *   - low_mastery_persistence: warning at ≥50%, critical at ≥75%
 *   - negative_growth: warning for small dip, critical for large (≤-5pp)
 *   - low_proficiency_rate: only fires when masteryDelta ≤ 0
 *   - stagnation: requires ≥10 profiles and small positive delta (< 2pp)
 *   - multiple signals from one class
 *   - no student identifiers in any alert field
 *   - sorted critical → warning → info, then alphabetical by scopeName
 *   - deterministic: same inputs → same output
 */

import { describe, it, expect } from "vitest";

import {
  computeInterventionAlerts,
  type ClassAggregate,
} from "@/lib/signals/interventions/interventionEngine";

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeClass(overrides: Partial<ClassAggregate> = {}): ClassAggregate {
  return {
    classId: "class-001",
    className: "Grade 7A",
    profileCount: 20,
    lowMasteryFraction: 0.1,
    meanGrowthDelta: 0.05,
    proficiencyRate: 0.8,
    masteryDelta: 0.05,
    ...overrides,
  };
}

// ─── Empty dataset ────────────────────────────────────────────────────────────

describe("computeInterventionAlerts() — empty dataset", () => {
  it("returns empty array for empty input", () => {
    expect(computeInterventionAlerts([])).toEqual([]);
  });
});

// ─── MIN_CLASS_PROFILES guard ─────────────────────────────────────────────────

describe("computeInterventionAlerts() — MIN_CLASS_PROFILES guard", () => {
  it("skips classes with fewer than 3 profiles even with extreme values", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ profileCount: 2, lowMasteryFraction: 1.0, meanGrowthDelta: -0.5 }),
    ]);
    expect(alerts).toHaveLength(0);
  });

  it("includes classes with exactly 3 profiles", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ profileCount: 3, lowMasteryFraction: 0.75 }),
    ]);
    expect(alerts.some((a) => a.type === "low_mastery_persistence")).toBe(true);
  });
});

// ─── low_mastery_persistence ──────────────────────────────────────────────────

describe("computeInterventionAlerts() — low_mastery_persistence", () => {
  it("emits warning at exactly 50% low mastery fraction", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ lowMasteryFraction: 0.50 }),
    ]);
    const alert = alerts.find((a) => a.type === "low_mastery_persistence");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("warning");
  });

  it("emits critical at exactly 75% low mastery fraction", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ lowMasteryFraction: 0.75 }),
    ]);
    const alert = alerts.find((a) => a.type === "low_mastery_persistence");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("critical");
  });

  it("emits critical above 75% threshold", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ lowMasteryFraction: 0.9 }),
    ]);
    expect(alerts.find((a) => a.type === "low_mastery_persistence")!.severity).toBe("critical");
  });

  it("does not emit below 50% threshold", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ lowMasteryFraction: 0.49 }),
    ]);
    expect(alerts.find((a) => a.type === "low_mastery_persistence")).toBeUndefined();
  });

  it("alert scope is 'class' and scopeId matches classId", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ classId: "class-xyz", className: "7B", lowMasteryFraction: 0.6 }),
    ]);
    const alert = alerts.find((a) => a.type === "low_mastery_persistence");
    expect(alert!.scope).toBe("class");
    expect(alert!.scopeId).toBe("class-xyz");
    expect(alert!.scopeName).toBe("7B");
  });
});

// ─── negative_growth ──────────────────────────────────────────────────────────

describe("computeInterventionAlerts() — negative_growth", () => {
  it("emits warning for small negative growth (> -5pp)", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ meanGrowthDelta: -0.03 }),
    ]);
    const alert = alerts.find((a) => a.type === "negative_growth");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("warning");
  });

  it("emits critical for large negative growth (≤ -5pp)", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ meanGrowthDelta: -0.06 }),
    ]);
    const alert = alerts.find((a) => a.type === "negative_growth");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("critical");
  });

  it("emits warning at exactly -5pp (threshold is strict <, not <=)", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ meanGrowthDelta: -0.05 }),
    ]);
    expect(alerts.find((a) => a.type === "negative_growth")!.severity).toBe("warning");
  });

  it("does not emit for zero growth", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ meanGrowthDelta: 0 }),
    ]);
    expect(alerts.find((a) => a.type === "negative_growth")).toBeUndefined();
  });

  it("does not emit for positive growth", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ meanGrowthDelta: 0.1 }),
    ]);
    expect(alerts.find((a) => a.type === "negative_growth")).toBeUndefined();
  });
});

// ─── low_proficiency_rate ─────────────────────────────────────────────────────

describe("computeInterventionAlerts() — low_proficiency_rate", () => {
  it("emits info when rate < 50% and masteryDelta = 0", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ proficiencyRate: 0.4, masteryDelta: 0 }),
    ]);
    const alert = alerts.find((a) => a.type === "low_proficiency_rate");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("info");
  });

  it("emits critical when rate < 25% and masteryDelta is negative", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ proficiencyRate: 0.2, masteryDelta: -0.01 }),
    ]);
    const alert = alerts.find((a) => a.type === "low_proficiency_rate");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("critical");
  });

  it("does not emit when rate < 50% but masteryDelta is positive (improvement detected)", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ proficiencyRate: 0.4, masteryDelta: 0.03 }),
    ]);
    expect(alerts.find((a) => a.type === "low_proficiency_rate")).toBeUndefined();
  });

  it("does not emit when proficiency rate meets threshold exactly (50%)", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ proficiencyRate: 0.50, masteryDelta: 0 }),
    ]);
    expect(alerts.find((a) => a.type === "low_proficiency_rate")).toBeUndefined();
  });
});

// ─── stagnation ───────────────────────────────────────────────────────────────

describe("computeInterventionAlerts() — stagnation", () => {
  it("emits stagnation when profileCount ≥ 10 and masteryDelta < 2pp (positive)", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ profileCount: 10, masteryDelta: 0.01, meanGrowthDelta: 0.01 }),
    ]);
    const alert = alerts.find((a) => a.type === "stagnation");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("info");
  });

  it("emits stagnation at masteryDelta = 0 with sufficient sample", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ profileCount: 15, masteryDelta: 0.0 }),
    ]);
    expect(alerts.find((a) => a.type === "stagnation")).toBeDefined();
  });

  it("does not emit stagnation when profileCount < 10", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ profileCount: 9, masteryDelta: 0.01 }),
    ]);
    expect(alerts.find((a) => a.type === "stagnation")).toBeUndefined();
  });

  it("does not emit stagnation when masteryDelta meets threshold (≥ 2pp)", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ profileCount: 10, masteryDelta: 0.02 }),
    ]);
    expect(alerts.find((a) => a.type === "stagnation")).toBeUndefined();
  });

  it("does not emit stagnation when masteryDelta is negative (negative_growth handles that)", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ profileCount: 10, masteryDelta: -0.01 }),
    ]);
    expect(alerts.find((a) => a.type === "stagnation")).toBeUndefined();
  });
});

// ─── No student identifiers ───────────────────────────────────────────────────

describe("computeInterventionAlerts() — no student identifiers", () => {
  it("all alerts are class-scoped, never student-scoped", () => {
    const alerts = computeInterventionAlerts([
      makeClass({
        classId: "class-111",
        lowMasteryFraction: 0.8,
        meanGrowthDelta: -0.1,
        proficiencyRate: 0.2,
        masteryDelta: -0.05,
      }),
    ]);
    for (const alert of alerts) {
      expect(alert.scope).toBe("class");
      expect(alert.scopeId).not.toMatch(/^student-/);
    }
  });

  it("alert messages do not contain student ID patterns", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ lowMasteryFraction: 0.8, meanGrowthDelta: -0.1 }),
    ]);
    for (const alert of alerts) {
      expect(alert.message).not.toMatch(/student.*id/i);
      expect(alert.message).not.toMatch(/\bstudent-\w+/);
    }
  });

  it("triggerValue is an aggregate metric, not a count of students", () => {
    const cls = makeClass({ lowMasteryFraction: 0.6 });
    const alerts = computeInterventionAlerts([cls]);
    const alert = alerts.find((a) => a.type === "low_mastery_persistence");
    // triggerValue is a fraction (0–1), not a raw student count
    expect(alert!.triggerValue).toBeGreaterThanOrEqual(0);
    expect(alert!.triggerValue).toBeLessThanOrEqual(1);
  });
});

// ─── Sort order ───────────────────────────────────────────────────────────────

describe("computeInterventionAlerts() — sort order", () => {
  it("critical alerts appear before warning and info in output", () => {
    const alerts = computeInterventionAlerts([
      makeClass({
        lowMasteryFraction: 0.51,  // warning
        meanGrowthDelta: -0.08,    // critical
        proficiencyRate: 0.8,
        masteryDelta: 0.1,
      }),
    ]);
    const severities = alerts.map((a) => a.severity);
    let lastCritIdx = -1;
    let firstWarnIdx = Infinity;
    for (let i = 0; i < severities.length; i++) {
      if (severities[i] === "critical") lastCritIdx = i;
      if (severities[i] === "warning" && firstWarnIdx === Infinity) firstWarnIdx = i;
    }
    if (lastCritIdx >= 0 && firstWarnIdx < Infinity) {
      expect(lastCritIdx).toBeLessThan(firstWarnIdx);
    }
  });

  it("within same severity, alerts are sorted alphabetically by scopeName", () => {
    const alerts = computeInterventionAlerts([
      makeClass({ classId: "c1", className: "ZClass", lowMasteryFraction: 0.6 }),
      makeClass({ classId: "c2", className: "AClass", lowMasteryFraction: 0.6 }),
    ]);
    const sameType = alerts.filter((a) => a.type === "low_mastery_persistence");
    if (sameType.length >= 2) {
      expect(sameType[0].scopeName.localeCompare(sameType[1].scopeName)).toBeLessThanOrEqual(0);
    }
  });

  it("returns deterministic order for identical inputs", () => {
    const input = [
      makeClass({ classId: "c1", className: "ZClass", lowMasteryFraction: 0.6 }),
      makeClass({ classId: "c2", className: "AClass", lowMasteryFraction: 0.6 }),
    ];
    const r1 = computeInterventionAlerts(input);
    const r2 = computeInterventionAlerts(input);
    expect(r1.map((a) => a.scopeId)).toEqual(r2.map((a) => a.scopeId));
  });
});

// ─── Multiple signals from one class ─────────────────────────────────────────

describe("computeInterventionAlerts() — multiple signals from one class", () => {
  it("emits multiple alert types for a class with several issues", () => {
    const alerts = computeInterventionAlerts([
      makeClass({
        lowMasteryFraction: 0.8,  // critical low_mastery_persistence
        meanGrowthDelta: -0.07,   // critical negative_growth
        proficiencyRate: 0.2,     // critical low_proficiency_rate (masteryDelta < 0)
        masteryDelta: -0.05,      // negative (no stagnation)
      }),
    ]);
    const types = new Set(alerts.map((a) => a.type));
    expect(types.has("low_mastery_persistence")).toBe(true);
    expect(types.has("negative_growth")).toBe(true);
    expect(types.has("low_proficiency_rate")).toBe(true);
  });

  it("does not emit stagnation when other negative signals are present", () => {
    // stagnation requires non-negative masteryDelta
    const alerts = computeInterventionAlerts([
      makeClass({
        profileCount: 15,
        masteryDelta: -0.01,       // negative → stagnation rule skipped
        meanGrowthDelta: -0.01,
      }),
    ]);
    expect(alerts.find((a) => a.type === "stagnation")).toBeUndefined();
  });
});

// ─── Healthy class emits no alerts ───────────────────────────────────────────

describe("computeInterventionAlerts() — healthy class", () => {
  it("emits no alerts for a class with good metrics", () => {
    const alerts = computeInterventionAlerts([
      makeClass({
        profileCount: 25,
        lowMasteryFraction: 0.1,
        meanGrowthDelta: 0.08,
        proficiencyRate: 0.85,
        masteryDelta: 0.08,
      }),
    ]);
    expect(alerts).toHaveLength(0);
  });
});
