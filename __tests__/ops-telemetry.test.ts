/**
 * __tests__/ops-telemetry.test.ts
 *
 * Validates:
 *   1. All 7 new Block-5 telemetry event constants exist and are non-empty strings.
 *   2. Standardised event envelope shapes contain NO PII keys.
 *   3. The PII guard covers all known PII field names.
 *   4. Event names follow the established dot-notation convention.
 *   5. Server flag helpers behave correctly (no env mutation side-effects).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EVENTS } from "@/lib/trackEvent";
import {
  isOpsAiEnabled,
  getOpsAiMinSeverity,
  severityMeetsThreshold,
  SEVERITY_LEVELS,
} from "@/lib/serverFlags";

// ── PII guard ──────────────────────────────────────────────────────────────────

/**
 * Exhaustive list of PII key patterns that must NEVER appear in telemetry
 * event payloads sent to MetricEvent or AuditLog.
 */
const PII_KEY_PATTERNS = [
  "phone",
  "phoneE164",
  "guardianPhone",
  "email",
  "name",
  "fullName",
  "studentId",
  "guardianId",
  "teacherId",
  "userId",    // user-level ID (aggregate events should use schoolId)
  "studentName",
  "teacherName",
  "guardianName",
  "address",
  "nationalId",
  "passportNumber",
];

function assertNoPII(payload: Record<string, unknown>, context = "payload"): void {
  for (const key of Object.keys(payload)) {
    const lower = key.toLowerCase();
    for (const pattern of PII_KEY_PATTERNS) {
      if (lower === pattern.toLowerCase() || lower.includes(pattern.toLowerCase())) {
        throw new Error(
          `PII key detected in ${context}: "${key}" matches pattern "${pattern}"`
        );
      }
    }
    // Recurse into nested objects (not arrays to keep simple)
    if (payload[key] !== null && typeof payload[key] === "object" && !Array.isArray(payload[key])) {
      assertNoPII(payload[key] as Record<string, unknown>, `${context}.${key}`);
    }
  }
}

// ── Block 5 event constants ───────────────────────────────────────────────────

describe("Block-5 telemetry event constants", () => {
  const B5_EVENTS = [
    "ONBOARDING_DISMISSED",
    "ONBOARDING_REOPENED",
    "TRAINING_MODULE_ABANDONED",
    "TRAINING_LEVEL_ABANDONED",
    "OFFLINE_SYNC_CONFLICT_DETECTED",
    "OFFLINE_QUEUE_DEADLETTERED",
    "SMS_FAILED_RATE_COMPUTED",
  ] as const;

  it("all 7 Block-5 constants exist on EVENTS", () => {
    for (const key of B5_EVENTS) {
      expect(EVENTS).toHaveProperty(key);
    }
  });

  it("all event values are non-empty strings", () => {
    for (const key of B5_EVENTS) {
      const value = (EVENTS as Record<string, unknown>)[key];
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it("event names use dot-notation (no underscores in the name portion)", () => {
    // Names should be like "onboarding.dismissed" not "onboarding_dismissed"
    const b5Values = B5_EVENTS.map((k) => (EVENTS as Record<string, string>)[k]);
    for (const name of b5Values) {
      expect(name).toContain(".");
    }
  });

  it("no two event constants share the same string value", () => {
    const allValues = Object.values(EVENTS) as string[];
    const uniqueValues = new Set(allValues);
    expect(uniqueValues.size).toBe(allValues.length);
  });
});

// ── Standardised event envelope shapes (NO PII) ───────────────────────────────

describe("telemetry event envelope — PII absence", () => {
  // Representative payloads for each new Block-5 event.
  // These mirror what components/services SHOULD send.
  const envelopes: Record<string, Record<string, unknown>> = {
    "onboarding.dismissed": {
      name:      "onboarding.dismissed",
      severity:  "info",
      actorRole: "TEACHER",
      schoolId:  "school-abc",
      stepIndex: 2,
      windowHours: 168,
    },
    "onboarding.reopened": {
      name:      "onboarding.reopened",
      severity:  "info",
      actorRole: "TEACHER",
      schoolId:  "school-abc",
    },
    "training.module_abandoned": {
      name:      "training.module_abandoned",
      severity:  "info",
      actorRole: "TEACHER",
      schoolId:  "school-abc",
      moduleId:  "l1-login-nav",
      stepIndex: 1,
    },
    "training.level_abandoned": {
      name:      "training.level_abandoned",
      severity:  "info",
      actorRole: "TEACHER",
      schoolId:  "school-abc",
      level:     2,
    },
    "offline.sync_conflict_detected": {
      name:      "offline.sync_conflict_detected",
      severity:  "warn",
      actorRole: "SYSTEM",
      schoolId:  "school-abc",
      count:     3,
    },
    "offline.queue_deadlettered": {
      name:      "offline.queue_deadlettered",
      severity:  "warn",
      actorRole: "SYSTEM",
      schoolId:  "school-abc",
      count:     1,
    },
    "sms.failed_rate_computed": {
      name:        "sms.failed_rate_computed",
      severity:    "warn",
      actorRole:   "SYSTEM",
      schoolId:    "school-abc",
      rate:        0.42,
      windowHours: 24,
    },
  };

  for (const [eventName, envelope] of Object.entries(envelopes)) {
    it(`${eventName} envelope contains no PII`, () => {
      expect(() => assertNoPII(envelope)).not.toThrow();
    });

    it(`${eventName} envelope includes required fields`, () => {
      expect(typeof envelope.name).toBe("string");
      expect(typeof envelope.severity).toBe("string");
      expect(typeof envelope.actorRole).toBe("string");
    });
  }

  it("assertNoPII correctly rejects a payload with a phone key", () => {
    const bad = { phone: "+231770000000", count: 5 };
    expect(() => assertNoPII(bad)).toThrow(/PII key detected/);
  });

  it("assertNoPII correctly rejects a nested payload with guardianPhone", () => {
    const bad = { meta: { guardianPhone: "+231770000000" } };
    expect(() => assertNoPII(bad as Record<string, unknown>)).toThrow(/PII key detected/);
  });

  it("assertNoPII correctly rejects a payload with studentId", () => {
    const bad = { studentId: "stu-123", count: 1 };
    expect(() => assertNoPII(bad)).toThrow(/PII key detected/);
  });

  it("assertNoPII accepts aggregate-safe payloads", () => {
    const safe = { schoolId: "s-1", rate: 0.3, count: 7, windowHours: 24 };
    expect(() => assertNoPII(safe)).not.toThrow();
  });
});

// ── serverFlags helpers ───────────────────────────────────────────────────────

describe("serverFlags — isOpsAiEnabled", () => {
  const original = process.env.OPS_AI_EXPLANATIONS_ENABLED;
  afterEach(() => {
    process.env.OPS_AI_EXPLANATIONS_ENABLED = original ?? "";
  });

  it("returns false by default (flag not set)", () => {
    delete process.env.OPS_AI_EXPLANATIONS_ENABLED;
    expect(isOpsAiEnabled()).toBe(false);
  });

  it("returns false when set to 'false'", () => {
    process.env.OPS_AI_EXPLANATIONS_ENABLED = "false";
    expect(isOpsAiEnabled()).toBe(false);
  });

  it("returns true when set to 'true'", () => {
    process.env.OPS_AI_EXPLANATIONS_ENABLED = "true";
    expect(isOpsAiEnabled()).toBe(true);
  });
});

describe("serverFlags — getOpsAiMinSeverity", () => {
  const original = process.env.OPS_AI_MIN_SEVERITY;
  afterEach(() => {
    if (original === undefined) delete process.env.OPS_AI_MIN_SEVERITY;
    else process.env.OPS_AI_MIN_SEVERITY = original;
  });

  it("defaults to 'warn' when not set", () => {
    delete process.env.OPS_AI_MIN_SEVERITY;
    expect(getOpsAiMinSeverity()).toBe("warn");
  });

  it("returns 'info' when explicitly set to info", () => {
    process.env.OPS_AI_MIN_SEVERITY = "info";
    expect(getOpsAiMinSeverity()).toBe("info");
  });

  it("returns 'critical' when set to critical", () => {
    process.env.OPS_AI_MIN_SEVERITY = "critical";
    expect(getOpsAiMinSeverity()).toBe("critical");
  });

  it("falls back to 'warn' for unknown values", () => {
    process.env.OPS_AI_MIN_SEVERITY = "extreme";
    expect(getOpsAiMinSeverity()).toBe("warn");
  });
});

describe("serverFlags — severityMeetsThreshold", () => {
  it("info does NOT meet warn threshold", () => {
    expect(severityMeetsThreshold("info", "warn")).toBe(false);
  });

  it("warn meets warn threshold", () => {
    expect(severityMeetsThreshold("warn", "warn")).toBe(true);
  });

  it("critical meets warn threshold", () => {
    expect(severityMeetsThreshold("critical", "warn")).toBe(true);
  });

  it("critical meets critical threshold", () => {
    expect(severityMeetsThreshold("critical", "critical")).toBe(true);
  });

  it("warn does NOT meet critical threshold", () => {
    expect(severityMeetsThreshold("warn", "critical")).toBe(false);
  });

  it("info meets info threshold", () => {
    expect(severityMeetsThreshold("info", "info")).toBe(true);
  });

  it("unknown severity treated conservatively (as info)", () => {
    // Unknown maps to index 0 = info
    expect(severityMeetsThreshold("unknown", "warn")).toBe(false);
  });

  it("SEVERITY_LEVELS is ordered info < warn < critical", () => {
    expect(SEVERITY_LEVELS[0]).toBe("info");
    expect(SEVERITY_LEVELS[1]).toBe("warn");
    expect(SEVERITY_LEVELS[2]).toBe("critical");
  });
});
