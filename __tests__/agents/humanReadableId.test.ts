import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateHumanReadableStudentId, createUniqueHumanReadableStudentId } from "@/lib/students/humanReadableId";

describe("generateHumanReadableStudentId", () => {
  it("generates a 7-character code", () => {
    expect(generateHumanReadableStudentId()).toHaveLength(7);
  });

  it("never contains ambiguous characters (O, 0, I, 1)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateHumanReadableStudentId();
      expect(code).not.toMatch(/[O0I1]/);
    }
  });

  it("always contains at least one letter and one digit", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateHumanReadableStudentId();
      expect(code).toMatch(/[A-Z]/);
      expect(code).toMatch(/[0-9]/);
    }
  });

  it("is uppercase", () => {
    const code = generateHumanReadableStudentId();
    expect(code).toBe(code.toUpperCase());
  });
});

describe("createUniqueHumanReadableStudentId", () => {
  it("returns the first generated candidate when it's unique", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const code = await createUniqueHumanReadableStudentId({ student: { findUnique } });
    expect(code).toHaveLength(7);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("retries on a collision until a unique code is found", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "taken-1" })
      .mockResolvedValueOnce({ id: "taken-2" })
      .mockResolvedValueOnce(null);
    const code = await createUniqueHumanReadableStudentId({ student: { findUnique } });
    expect(code).toHaveLength(7);
    expect(findUnique).toHaveBeenCalledTimes(3);
  });

  it("throws after 8 consecutive collisions rather than retrying forever", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "always-taken" });
    await expect(createUniqueHumanReadableStudentId({ student: { findUnique } })).rejects.toThrow(/8 attempts/);
    expect(findUnique).toHaveBeenCalledTimes(8);
  });
});
