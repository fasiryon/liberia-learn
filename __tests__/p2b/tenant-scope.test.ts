import { describe, expect, it } from "vitest";
import { assertCurriculumSchoolScope, curriculumSchoolScopeWhere } from "@/lib/curriculum/review/tenantScope";

describe("P2-B tenant scope", () => {
  it("limits school administrators to their own school", () => {
    const where = curriculumSchoolScopeWhere({ role: "ADMIN", schoolId: "school-a" });
    expect(where).toEqual({ OR: [{ schoolId: "school-a" }, { schoolId: null, editedBy: { schoolId: "school-a" } }] });
    expect(() => assertCurriculumSchoolScope({ role: "ADMIN", schoolId: "school-a" }, { schoolId: "school-b" })).toThrow("Not found");
  });

  it("does not grant MOE district administrators decision scope", () => {
    expect(curriculumSchoolScopeWhere({ role: "MOE_DISTRICT_ADMIN" })).toEqual({ id: "__review_scope_denied__" });
  });

  it("allows explicitly higher national authority", () => {
    expect(curriculumSchoolScopeWhere({ role: "MOE_OFFICIAL" })).toEqual({});
    expect(curriculumSchoolScopeWhere({ role: "TEACHER", schoolId: "school-a" })).toEqual({ id: "__review_scope_denied__" });
  });
});
