import { describe, expect, it } from "vitest";
import {
  CORE_SUBJECTS,
  getCanonicalSubjectCode,
  getStorageSubject,
  normalizeSubject,
} from "@/lib/curriculum/subjectTaxonomy";

describe("curriculum subject taxonomy", () => {
  it("normalizes aliases without breaking existing labels", () => {
    expect(getCanonicalSubjectCode("english")).toBe("LITERACY");
    expect(getCanonicalSubjectCode("LITERACY")).toBe("LITERACY");
    expect(getCanonicalSubjectCode("social studies")).toBe("SOCIAL_STUDIES");
    expect(getCanonicalSubjectCode("ict")).toBe("COMPUTER_SCIENCE");
    expect(getStorageSubject("english")).toBe("LITERACY");
    expect(getStorageSubject("social studies")).toBe("SOCIAL_STUDIES");
    expect(getStorageSubject("civics")).toBe("CIVICS");
  });

  it("keeps the core K12 set explicitly available", () => {
    const coreCodes = CORE_SUBJECTS.map((subject) => subject.code);
    expect(coreCodes).toEqual(["MATH", "LITERACY", "SCIENCE", "SOCIAL_STUDIES", "CIVICS"]);
    expect(normalizeSubject("unknown subject")).toBeNull();
  });
});
