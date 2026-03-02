/**
 * __tests__/moe-standards.test.ts
 *
 * Unit tests for prisma/seeds/moe-standards.ts (pure data — no DB required).
 *
 * Coverage:
 *  1. Overall catalogue structure (total count, unique codes)
 *  2. CS G1_3 foundational code (ACTION-4)
 *  3. CS G4_6 hardware code (ACTION-5)
 *  4. ENGINEERING codes present for all four grade bands (ACTION-2)
 *  5. Code format validation — all codes match LR-{SUBJECT}-{BAND}-{NN}
 *  6. No duplicate codes
 *  7. Required subjects all have at least one code
 */

import { describe, it, expect } from "vitest";
import { MOE_STANDARDS } from "../prisma/seeds/moe-standards";

// ─── 1. Overall structure ─────────────────────────────────────────────────────

describe("MOE_STANDARDS catalogue", () => {
  it("exports a non-empty array", () => {
    expect(Array.isArray(MOE_STANDARDS)).toBe(true);
    expect(MOE_STANDARDS.length).toBeGreaterThan(0);
  });

  it("has no duplicate codes", () => {
    const codes = MOE_STANDARDS.map((s) => s.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it("total count is at least 63 (53 original + 10 new)", () => {
    expect(MOE_STANDARDS.length).toBeGreaterThanOrEqual(63);
  });

  it("all entries have required fields: code, description, subject, band", () => {
    for (const s of MOE_STANDARDS) {
      expect(s.code).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.subject).toBeTruthy();
      expect(s.band).toBeTruthy();
    }
  });
});

// ─── 2. CS G1_3 foundational code (ACTION-4) ─────────────────────────────────

describe("CS G1_3 foundational code (ACTION-4)", () => {
  const csG1_3 = MOE_STANDARDS.filter(
    (s) => s.subject === "COMPUTER_SCIENCE" && s.band === "G1_3"
  );

  it("at least one CS G1_3 code exists", () => {
    expect(csG1_3.length).toBeGreaterThanOrEqual(1);
  });

  it("LR-CS-G1_3-01 is present", () => {
    expect(csG1_3.some((s) => s.code === "LR-CS-G1_3-01")).toBe(true);
  });

  it("CS G1_3 code has a non-empty description", () => {
    for (const s of csG1_3) {
      expect(s.description.trim().length).toBeGreaterThan(10);
    }
  });
});

// ─── 3. CS G4_6 hardware strand (ACTION-5) ───────────────────────────────────

describe("CS G4_6 hardware strand (ACTION-5)", () => {
  const csG4_6 = MOE_STANDARDS.filter(
    (s) => s.subject === "COMPUTER_SCIENCE" && s.band === "G4_6"
  );

  it("at least two CS G4_6 codes exist (components + hardware/software)", () => {
    expect(csG4_6.length).toBeGreaterThanOrEqual(2);
  });

  it("LR-CS-G4_6-01 (components) is present", () => {
    expect(csG4_6.some((s) => s.code === "LR-CS-G4_6-01")).toBe(true);
  });

  it("LR-CS-G4_6-02 (hardware/software integration) is present", () => {
    expect(csG4_6.some((s) => s.code === "LR-CS-G4_6-02")).toBe(true);
  });
});

// ─── 4. ENGINEERING codes across all grade bands (ACTION-2) ──────────────────

describe("ENGINEERING standard codes (ACTION-2)", () => {
  const eng = MOE_STANDARDS.filter((s) => s.subject === "ENGINEERING");
  const bands = ["G1_3", "G4_6", "G7_9", "G10_12"] as const;

  it("ENGINEERING codes exist (was 0 — ACTION-2 fix)", () => {
    expect(eng.length).toBeGreaterThan(0);
  });

  it("at least 2 ENGINEERING codes per grade band", () => {
    for (const band of bands) {
      const count = eng.filter((s) => s.band === band).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it("all four grade bands are covered", () => {
    const coveredBands = new Set(eng.map((s) => s.band));
    for (const band of bands) {
      expect(coveredBands.has(band)).toBe(true);
    }
  });

  it("ENGINEERING code format is LR-ENG-{BAND}-{NN}", () => {
    for (const s of eng) {
      expect(s.code).toMatch(/^LR-ENG-G\d+_\d+-\d{2}$/);
    }
  });
});

// ─── 5. Code format validation ────────────────────────────────────────────────

describe("code format", () => {
  const CODE_PATTERN = /^LR-[A-Z]+-G\d+_\d+-\d{2}$/;

  it("all codes match LR-{SUBJECT}-{BAND}-{NN} pattern", () => {
    for (const s of MOE_STANDARDS) {
      expect(s.code).toMatch(CODE_PATTERN);
    }
  });
});

// ─── 6. All core subjects covered ────────────────────────────────────────────

describe("subject coverage", () => {
  const subjects = [
    "MATH",
    "SCIENCE",
    "LITERACY",
    "CIVICS",
    "COMPUTER_SCIENCE",
    "ENGINEERING",
  ] as const;

  it.each(subjects)("subject %s has at least one code", (subject) => {
    const codes = MOE_STANDARDS.filter((s) => s.subject === subject);
    expect(codes.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 7. Migration file exists ────────────────────────────────────────────────

import { existsSync } from "fs";
import { resolve } from "path";

describe("engineering_cs_standards migration", () => {
  const migFile = resolve(
    __dirname,
    "../prisma/migrations/20260302_engineering_cs_standards/migration.sql"
  );

  it("migration file exists", () => {
    expect(existsSync(migFile)).toBe(true);
  });

  it("migration contains ENGINEERING codes", () => {
    const { readFileSync } = require("fs");
    const sql = readFileSync(migFile, "utf8");
    expect(sql).toContain("LR-ENG-G1_3-01");
    expect(sql).toContain("LR-ENG-G10_12-02");
  });

  it("migration contains CS G1_3 code", () => {
    const { readFileSync } = require("fs");
    const sql = readFileSync(migFile, "utf8");
    expect(sql).toContain("LR-CS-G1_3-01");
  });
});
