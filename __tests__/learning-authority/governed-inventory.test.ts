import { describe, expect, it } from "vitest";
import { buildGovernedCellInventory, GOVERNED_CELL_INVENTORY_VERSION } from "@/lib/learning-authority/governedInventory";
import { GRADE4_MATH_TEMPLATE_CELL } from "@/lib/learning-authority/cells/grade4Math";
import { deterministicReleaseIdentity, GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";
import type { TemplateCell } from "@/lib/learning-authority/templateCell";

describe("governed cell inventory contract", () => {
  const inventory = buildGovernedCellInventory(GRADE4_MATH_TEMPLATE_CELL, GRADE4_MATH_ONTOLOGY_RELEASE);

  it("pins the contract and release identity", () => {
    expect(inventory.contractVersion).toBe(GOVERNED_CELL_INVENTORY_VERSION);
    expect(inventory.releaseId).toBe("lr-moe-g4-math-fractions-2026.1");
    expect(inventory.releaseIdentity).toBe(deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE));
    expect(inventory.moeApprovalState).toBe("NOT_CLAIMED");
  });

  it("exposes only released items as activities, each resolving to one objective", () => {
    expect(inventory.activities.map((a) => `${a.activityId}@${a.activityVersion}:${a.evidenceType}:${a.objectiveId}`)).toEqual([
      "g4-frac-diagnostic-compare@1.0.0:DIAGNOSTIC:LIBERIALEARN_EXTENSION:g4-fractions-compare",
      "g4-frac-diagnostic-equal-parts@1.0.0:DIAGNOSTIC:moe-math-g4-s1-p3-number-theory-and-fraction-obj4",
      "g4-frac-practice-equivalence@1.0.0:PRACTICE:moe-math-g4-s1-p3-number-theory-and-fraction-obj5",
    ]);
  });

  it("never includes draft lessons as resources", () => {
    const draftIds = new Set(GRADE4_MATH_DRAFT_LESSONS.map((l) => l.contentId));
    expect(inventory.lessons.map((l) => l.contentId)).toEqual(["ll-g4-math-fractions-equal-parts-2026.1"]);
    expect(inventory.lessons.some((l) => draftIds.has(l.contentId))).toBe(false);
    expect(inventory.excluded.draftLessons).toBe(43);
    expect(JSON.stringify(inventory)).not.toContain("DRAFT_UNREVIEWED\",\"contentId");
  });

  it("lists every MOE objective without a governed concept so the orchestrator can return NO_VALID_RESOURCE", () => {
    expect(inventory.uncoveredObjectiveIds).toHaveLength(42);
    expect(inventory.uncoveredObjectiveIds).not.toContain("moe-math-g4-s1-p3-number-theory-and-fraction-obj4");
  });

  it("refuses a draft promoted into the governed inventory without release binding, and MOE claims", () => {
    const promoted: TemplateCell = { ...GRADE4_MATH_TEMPLATE_CELL, units: GRADE4_MATH_TEMPLATE_CELL.units.map((unit) => ({
      ...unit, lessons: unit.lessons.map((lesson) => lesson.contentId === "ll-g4-math-equivalent-fractions-2026.1" ? { ...lesson, authority: "GOVERNED" as const } : lesson),
    })) };
    expect(() => buildGovernedCellInventory(promoted, GRADE4_MATH_ONTOLOGY_RELEASE)).toThrow("inventory_governed_lesson_not_released:ll-g4-math-equivalent-fractions-2026.1");
    const claimed = { ...GRADE4_MATH_TEMPLATE_CELL, authority: { ...GRADE4_MATH_TEMPLATE_CELL.authority, moeApprovalState: "APPROVED" } } as unknown as TemplateCell;
    expect(() => buildGovernedCellInventory(claimed, GRADE4_MATH_ONTOLOGY_RELEASE)).toThrow("inventory_moe_claim_without_evidence");
  });
});
