import { describe, expect, it } from "vitest";
import {
  anonymizeName,
  anonymizeEmail,
  anonymizePhone,
  generalizeDate,
  stripPiiFromRecord,
  anonymizeRows,
  suppress,
} from "@/lib/exports/anonymize";

describe("anonymize", () => {
  describe("anonymizeName", () => {
    it("returns a pseudonymous token", () => {
      const result = anonymizeName("John Doe");
      expect(result).toMatch(/^anon_[0-9a-f]{8}$/);
    });

    it("is stable for same input", () => {
      expect(anonymizeName("Alice")).toBe(anonymizeName("Alice"));
    });

    it("differs for different inputs", () => {
      expect(anonymizeName("Alice")).not.toBe(anonymizeName("Bob"));
    });

    it("returns null for null input", () => {
      expect(anonymizeName(null)).toBeNull();
    });
  });

  describe("anonymizeEmail", () => {
    it("returns redacted domain form", () => {
      const result = anonymizeEmail("john@example.com");
      expect(result).toMatch(/^anon_[0-9a-f]+@redacted$/);
    });

    it("returns null for null input", () => {
      expect(anonymizeEmail(null)).toBeNull();
    });
  });

  describe("anonymizePhone", () => {
    it("returns REDACTED", () => {
      expect(anonymizePhone("+231 555 1234")).toBe("REDACTED");
      expect(anonymizePhone(null)).toBe("REDACTED");
    });
  });

  describe("generalizeDate", () => {
    it("truncates to year-month", () => {
      expect(generalizeDate("2026-04-14")).toBe("2026-04");
    });

    it("handles Date objects", () => {
      expect(generalizeDate(new Date("2026-01-31"))).toBe("2026-01");
    });

    it("returns null for null/empty", () => {
      expect(generalizeDate(null)).toBeNull();
      expect(generalizeDate(undefined)).toBeNull();
    });

    it("returns null for invalid date", () => {
      expect(generalizeDate("not-a-date")).toBeNull();
    });
  });

  describe("suppress", () => {
    it("returns null for any value", () => {
      expect(suppress("sensitive")).toBeNull();
      expect(suppress(42)).toBeNull();
      expect(suppress(null)).toBeNull();
    });
  });

  describe("stripPiiFromRecord", () => {
    it("anonymizes name and email fields", () => {
      const result = stripPiiFromRecord({
        firstName: "Alice",
        email: "alice@school.edu",
        phone: "+231123456",
        score: 92,
        schoolId: "school-1",
      });
      expect(result.firstName).toMatch(/^anon_/);
      expect(result.email).toMatch(/^anon_.*@redacted$/);
      expect(result.phone).toBe("REDACTED");
      expect(result.score).toBe(92);
      expect(result.schoolId).toBe("school-1");
    });

    it("passes non-PII fields through unchanged", () => {
      const result = stripPiiFromRecord({ subject: "Math", grade: "A" });
      expect(result.subject).toBe("Math");
      expect(result.grade).toBe("A");
    });
  });

  describe("anonymizeRows", () => {
    it("anonymizes multiple rows", () => {
      const rows = [
        { name: "Alice", score: 90 },
        { name: "Bob", score: 85 },
      ];
      const result = anonymizeRows(rows);
      expect(result).toHaveLength(2);
      expect(result[0].name).toMatch(/^anon_/);
      expect(result[1].name).toMatch(/^anon_/);
      expect(result[0].score).toBe(90);
    });
  });
});
