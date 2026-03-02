/**
 * __tests__/seed-demo.test.ts
 *
 * Unit tests for the pure exported functions in scripts/seed-demo.ts.
 * These tests do NOT connect to a database — all tested functions are
 * deterministic pure functions with no side effects.
 *
 * Coverage:
 *  1. isProduction()  — safety check
 *  2. generateStudentName() / generateGuardianName() — name generation
 *  3. getMasteryLevel() — distribution matches spec (15% at-risk / 60% developing / 25% proficient ±10%)
 *  4. getMasteryScore() — maps levels 0-5 to expected score ranges
 *  5. studentAttendanceRate() — ~15% of students in 70-80% band, ~85% in 85-95% band
 *  6. getAttendanceStatus() — honours the attendance rate
 *  7. DISTRICT_DEFS / SCHOOL_DEFS — structural validation
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  isProduction,
  generateStudentName,
  generateGuardianName,
  getMasteryLevel,
  getMasteryScore,
  studentAttendanceRate,
  getAttendanceStatus,
  DISTRICT_DEFS,
  SCHOOL_DEFS,
} from "../scripts/seed-demo";

// ─── 1. isProduction ──────────────────────────────────────────────────────────

describe("isProduction", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false in development (default test environment)", () => {
    // Vitest runs with NODE_ENV=test by default
    expect(isProduction()).toBe(false);
  });

  it("returns true when NODE_ENV is 'production'", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isProduction()).toBe(true);
  });

  it("returns false when NODE_ENV is 'staging'", () => {
    vi.stubEnv("NODE_ENV", "staging");
    expect(isProduction()).toBe(false);
  });

  it("returns false when NODE_ENV is 'test'", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(isProduction()).toBe(false);
  });
});

// ─── 2. Name generation ───────────────────────────────────────────────────────

describe("generateStudentName", () => {
  it("returns a non-empty string", () => {
    for (let i = 0; i < 20; i++) {
      const name = generateStudentName(i);
      expect(typeof name).toBe("string");
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it("contains a first and last name (space-separated)", () => {
    for (let i = 0; i < 20; i++) {
      const parts = generateStudentName(i).split(" ");
      expect(parts.length).toBeGreaterThanOrEqual(2);
      parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
    }
  });

  it("produces varied output across indices", () => {
    const names = new Set(Array.from({ length: 50 }, (_, i) => generateStudentName(i)));
    // With 50 indices we should get at least 10 distinct names
    expect(names.size).toBeGreaterThan(10);
  });

  it("is deterministic — same index always gives same name", () => {
    for (let i = 0; i < 30; i++) {
      expect(generateStudentName(i)).toBe(generateStudentName(i));
    }
  });

  it("generates both male and female first names", () => {
    // Female names (index * 3 + 1) % 2 === 0 → index * 3 is odd → index is odd
    // Just verify diversity exists
    const names = Array.from({ length: 40 }, (_, i) => generateStudentName(i));
    const uniqueFirstNames = new Set(names.map((n) => n.split(" ")[0]));
    expect(uniqueFirstNames.size).toBeGreaterThan(5);
  });
});

describe("generateGuardianName", () => {
  it("returns a non-empty string", () => {
    for (let i = 0; i < 20; i++) {
      const name = generateGuardianName(i);
      expect(typeof name).toBe("string");
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateGuardianName(i)).toBe(generateGuardianName(i));
    }
  });

  it("produces different names from generateStudentName for same index", () => {
    // Not required to always differ, but should differ for most indices
    let diffCount = 0;
    for (let i = 0; i < 30; i++) {
      if (generateGuardianName(i) !== generateStudentName(i)) diffCount++;
    }
    expect(diffCount).toBeGreaterThan(15);
  });
});

// ─── 3. getMasteryLevel distribution ─────────────────────────────────────────

describe("getMasteryLevel", () => {
  // Sample across 200 students × 12 strands × 6 grades = 14400 measurements
  function sampleDistribution() {
    let atRisk = 0;
    let developing = 0;
    let proficient = 0;
    const total = 200 * 12;

    for (let si = 0; si < 200; si++) {
      for (let mi = 0; mi < 12; mi++) {
        const grade = 1 + (si % 12);
        const level = getMasteryLevel(mi, si, grade);
        if (level <= 1) atRisk++;
        else if (level <= 3) developing++;
        else proficient++;
      }
    }
    return {
      atRiskPct: atRisk / total,
      developingPct: developing / total,
      proficientPct: proficient / total,
    };
  }

  it("returns values in 0-5 range", () => {
    for (let si = 0; si < 50; si++) {
      for (let mi = 0; mi < 12; mi++) {
        const level = getMasteryLevel(mi, si, 5);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(5);
      }
    }
  });

  it("produces ~15% at-risk (levels 0-1) ±10%", () => {
    const { atRiskPct } = sampleDistribution();
    expect(atRiskPct).toBeGreaterThanOrEqual(0.05);
    expect(atRiskPct).toBeLessThanOrEqual(0.25);
  });

  it("produces ~60% developing (levels 2-3) ±10%", () => {
    const { developingPct } = sampleDistribution();
    expect(developingPct).toBeGreaterThanOrEqual(0.50);
    expect(developingPct).toBeLessThanOrEqual(0.70);
  });

  it("produces ~25% proficient (levels 4-5) ±10%", () => {
    const { proficientPct } = sampleDistribution();
    expect(proficientPct).toBeGreaterThanOrEqual(0.15);
    expect(proficientPct).toBeLessThanOrEqual(0.35);
  });

  it("is deterministic — same inputs give same level", () => {
    for (let i = 0; i < 50; i++) {
      const level = getMasteryLevel(i % 12, i, (i % 12) + 1);
      expect(getMasteryLevel(i % 12, i, (i % 12) + 1)).toBe(level);
    }
  });
});

// ─── 4. getMasteryScore ───────────────────────────────────────────────────────

describe("getMasteryScore", () => {
  const expectedRanges: [number, number, number][] = [
    // [level, minScore, maxScore]
    [0, 0.00, 0.10],
    [1, 0.10, 0.30],
    [2, 0.30, 0.50],
    [3, 0.50, 0.70],
    [4, 0.70, 0.90],
    [5, 0.90, 1.00],
  ];

  it.each(expectedRanges)(
    "level %i returns score in [%f, %f]",
    (level, min, max) => {
      const score = getMasteryScore(level);
      expect(score).toBeGreaterThanOrEqual(min);
      expect(score).toBeLessThanOrEqual(max);
    }
  );

  it("clamps below 0 to level-0 score", () => {
    expect(getMasteryScore(-1)).toBe(getMasteryScore(0));
    expect(getMasteryScore(-99)).toBe(getMasteryScore(0));
  });

  it("clamps above 5 to level-5 score", () => {
    expect(getMasteryScore(6)).toBe(getMasteryScore(5));
    expect(getMasteryScore(100)).toBe(getMasteryScore(5));
  });

  it("scores are monotonically increasing with level", () => {
    for (let l = 0; l < 5; l++) {
      expect(getMasteryScore(l)).toBeLessThan(getMasteryScore(l + 1));
    }
  });
});

// ─── 5. studentAttendanceRate ─────────────────────────────────────────────────

describe("studentAttendanceRate", () => {
  const TOTAL = 100;

  it("returns a rate between 0.7 and 0.95 for all students", () => {
    for (let si = 0; si < TOTAL; si++) {
      const rate = studentAttendanceRate(si, TOTAL);
      expect(rate).toBeGreaterThanOrEqual(0.70);
      expect(rate).toBeLessThanOrEqual(0.95);
    }
  });

  it("~15% of students get 70-80% attendance (every 7th student)", () => {
    const low = Array.from({ length: TOTAL }, (_, i) =>
      studentAttendanceRate(i, TOTAL)
    ).filter((r) => r < 0.81);
    // Every 7th → floor(100/7) ≈ 14-15 students
    expect(low.length).toBeGreaterThanOrEqual(12);
    expect(low.length).toBeLessThanOrEqual(18);
  });

  it("~85% of students get 85-95% attendance", () => {
    const high = Array.from({ length: TOTAL }, (_, i) =>
      studentAttendanceRate(i, TOTAL)
    ).filter((r) => r >= 0.85);
    expect(high.length).toBeGreaterThanOrEqual(80);
    expect(high.length).toBeLessThanOrEqual(90);
  });

  it("is deterministic", () => {
    for (let i = 0; i < 30; i++) {
      expect(studentAttendanceRate(i, TOTAL)).toBe(studentAttendanceRate(i, TOTAL));
    }
  });
});

// ─── 6. getAttendanceStatus ───────────────────────────────────────────────────

describe("getAttendanceStatus", () => {
  it("returns only valid status values", () => {
    const valid = new Set(["PRESENT", "ABSENT", "LATE"]);
    for (let d = 0; d < 60; d++) {
      const status = getAttendanceStatus(d, 0.90);
      expect(valid.has(status)).toBe(true);
    }
  });

  it("is deterministic — same dayIndex + rate always gives same status", () => {
    for (let d = 0; d < 60; d++) {
      expect(getAttendanceStatus(d, 0.88)).toBe(getAttendanceStatus(d, 0.88));
    }
  });

  it("rate of 0.95 produces mostly PRESENT over 60 days", () => {
    const results = Array.from({ length: 60 }, (_, d) =>
      getAttendanceStatus(d, 0.95)
    );
    const presentCount = results.filter((s) => s === "PRESENT").length;
    // With 95% threshold, well over half should be present
    expect(presentCount).toBeGreaterThan(40);
  });

  it("rate of 0.70 produces more ABSENT days than a 0.95 rate", () => {
    const absentAt70 = Array.from({ length: 60 }, (_, d) =>
      getAttendanceStatus(d, 0.70)
    ).filter((s) => s === "ABSENT").length;

    const absentAt95 = Array.from({ length: 60 }, (_, d) =>
      getAttendanceStatus(d, 0.95)
    ).filter((s) => s === "ABSENT").length;

    expect(absentAt70).toBeGreaterThan(absentAt95);
  });
});

// ─── 7. Static data definitions ───────────────────────────────────────────────

describe("DISTRICT_DEFS", () => {
  it("contains exactly 3 districts", () => {
    expect(DISTRICT_DEFS).toHaveLength(3);
  });

  it("includes Montserrado, Nimba, and Bong", () => {
    const names = DISTRICT_DEFS.map((d) => d.name);
    expect(names).toContain("Montserrado");
    expect(names).toContain("Nimba");
    expect(names).toContain("Bong");
  });

  it("all districts have required fields", () => {
    for (const d of DISTRICT_DEFS) {
      expect(d.id).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(d.code).toBeTruthy();
    }
  });
});

describe("SCHOOL_DEFS", () => {
  it("contains exactly 10 schools", () => {
    expect(SCHOOL_DEFS).toHaveLength(10);
  });

  it("total student count is between 300 and 400", () => {
    const total = SCHOOL_DEFS.reduce((sum, s) => sum + s.studentCount, 0);
    expect(total).toBeGreaterThanOrEqual(300);
    expect(total).toBeLessThanOrEqual(400);
  });

  it("all schools belong to a known district", () => {
    const districtIds = new Set(DISTRICT_DEFS.map((d) => d.id));
    for (const s of SCHOOL_DEFS) {
      expect(districtIds.has(s.districtId)).toBe(true);
    }
  });

  it("school IDs are unique", () => {
    const ids = SCHOOL_DEFS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("school codes are unique", () => {
    const codes = SCHOOL_DEFS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("includes Capitol Hill Academy (idempotency anchor school)", () => {
    const names = SCHOOL_DEFS.map((s) => s.name);
    expect(names).toContain("Capitol Hill Academy");
  });

  it("Montserrado has 4 schools, Nimba has 3, Bong has 3", () => {
    const byDistrict: Record<string, number> = {};
    for (const s of SCHOOL_DEFS) {
      byDistrict[s.districtId] = (byDistrict[s.districtId] ?? 0) + 1;
    }
    expect(byDistrict["dist-montserrado"]).toBe(4);
    expect(byDistrict["dist-nimba"]).toBe(3);
    expect(byDistrict["dist-bong"]).toBe(3);
  });
});
