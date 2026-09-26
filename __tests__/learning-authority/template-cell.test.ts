import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { GRADE4_MATH_TEMPLATE_CELL } from "@/lib/learning-authority/cells/grade4Math";
import { certifyTemplateCell, liveCertificationChecklist, type CertificationInput, type TemplateCell } from "@/lib/learning-authority/templateCell";
import { GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";
import { GRADE4_FRACTIONS_LESSON } from "@/lib/curriculum/authority/grade4FractionsLesson";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";
import type { StructuredCurriculumItem } from "@/lib/learning-authority/structuredCurriculumAuthority";

const structured = JSON.parse(fs.readFileSync("curriculum/structured/moe-structured-v1.json", "utf8")) as { items: StructuredCurriculumItem[] };
const g4Items = structured.items.filter((item) => item.grade === 4 && item.subject === "MATH");

const base = (): CertificationInput => ({
  cell: GRADE4_MATH_TEMPLATE_CELL,
  structuredItems: g4Items,
  release: GRADE4_MATH_ONTOLOGY_RELEASE,
  repoLessons: [
    { contentId: GRADE4_FRACTIONS_LESSON.contentId, version: GRADE4_FRACTIONS_LESSON.version, grade: 4, subject: "MATH", authority: "GOVERNED", payload: GRADE4_FRACTIONS_LESSON.payload },
    ...GRADE4_MATH_DRAFT_LESSONS.map((l) => ({ contentId: l.contentId, version: l.version, grade: 4, subject: "MATH", authority: "DRAFT_UNREVIEWED" as const, payload: l.payload })),
  ],
  toolIds: new Set(["fraction-visualizer", "number-line", "digital-ruler", "multiplication-table", "basic-calculator"]),
  releaseToolKeyMap: { fraction_strips: "fraction-visualizer", number_line: "number-line", calculator: "basic-calculator" },
  labIds: new Set(["pendulum-lab"]),
});

const withCell = (mutate: (cell: TemplateCell) => TemplateCell): CertificationInput => ({ ...base(), cell: mutate(structuredClone(GRADE4_MATH_TEMPLATE_CELL) as TemplateCell) });
const mapUnits = (cell: TemplateCell, fn: (unit: TemplateCell["units"][number]) => TemplateCell["units"][number]): TemplateCell => ({ ...cell, units: cell.units.map(fn) });

describe("governed template cell certification", () => {
  it("certifies the Grade 4 Math cell as internally executable with all 44 MOE objectives placed", () => {
    const report = certifyTemplateCell(base());
    expect(report.errors).toEqual([]);
    expect(report.internallyExecutable).toBe(true);
    expect(report.summary.moeObjectives).toBe(44);
    expect(g4Items.filter((item) => item.kind === "OBJECTIVE")).toHaveLength(44);
    expect(report.objectives.every((objective) => objective.text && objective.pages.length)).toBe(true);
    expect(report.summary.interaction.VIRTUAL_LAB).toBe(0);
    expect(report.live.checked).toBe(false);
  });

  it("fails when an MOE objective is not placed or is placed in the wrong unit", () => {
    const dropped = certifyTemplateCell(withCell((cell) => mapUnits(cell, (unit) => ({ ...unit, objectives: unit.objectives.filter((o) => !o.moeItemId.endsWith("p1-numeration-addition-and-subtraction-obj1")) }))));
    expect(dropped.errors).toContain("objective_unplaced:moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1");
    const moved = certifyTemplateCell(withCell((cell) => mapUnits(cell, (unit) => unit.sequence === 2 ? { ...unit, objectives: [...unit.objectives, cell.units[0]!.objectives[0]!] } : unit)));
    expect(moved.errors).toEqual(expect.arrayContaining([expect.stringMatching(/^objective_wrong_unit:/), expect.stringMatching(/^objective_placed_twice:/)]));
  });

  it("rejects invented objectives and interaction claims without real tools or evidence", () => {
    const report = certifyTemplateCell(withCell((cell) => mapUnits(cell, (unit) => unit.sequence !== 6 ? unit : {
      ...unit,
      objectives: [
        ...unit.objectives.map((o) => o.interaction.need !== "THREE_D" ? o : { ...o, interaction: { ...o.interaction, rationale: "Looks impressive.", evidence: "NONE" as const } }),
        { moeItemId: "moe-math-g4-invented-obj1", conceptIds: [], interaction: { need: "VIRTUAL_LAB" as const, rationale: "x", tools: ["hologram"], labId: null, evidence: "NONE" as const, offlineFallback: null, safety: null } },
      ],
    })));
    expect(report.errors).toEqual(expect.arrayContaining([
      "objective_missing:moe-math-g4-invented-obj1",
      "interaction_evidence_required:moe-math-g4-s2-p6-geometry-and-statistics-obj5",
      "three_d_rationale_not_spatial:moe-math-g4-s2-p6-geometry-and-statistics-obj5",
    ]));
  });

  it("requires offline fallback for manipulatives and safety for practicals", () => {
    const report = certifyTemplateCell(withCell((cell) => mapUnits(cell, (unit) => ({
      ...unit, objectives: unit.objectives.map((o) => o.interaction.need === "NONE" ? o : { ...o, interaction: { ...o.interaction, offlineFallback: null, safety: null } }),
    }))));
    expect(report.errors).toContain("interaction_offline_fallback_required:moe-math-g4-s1-p3-number-theory-and-fraction-obj5");
    expect(report.errors).toContain("practical_safety_required:moe-math-g4-s2-p5-measurement-obj4");
  });

  it("rejects an MOE approval claim and a concept with no link", () => {
    const report = certifyTemplateCell(withCell((cell) => ({
      ...cell, authority: { ...cell.authority, moeApprovalState: "APPROVED" as never }, conceptLinks: cell.conceptLinks.filter((l) => l.conceptId !== "g4-fractions-compare"),
    })));
    expect(report.errors).toEqual(expect.arrayContaining(["moe_approval_claimed_without_evidence", "concept_unlinked:g4-fractions-compare"]));
  });

  it("requires release lessons to be bound in the cell and lesson components to resolve", () => {
    const noLesson = certifyTemplateCell(withCell((cell) => mapUnits(cell, (unit) => ({ ...unit, lessons: unit.lessons.filter((l) => l.authority !== "GOVERNED") }))));
    expect(noLesson.errors).toContain("release_lesson_not_in_cell:ll-g4-math-fractions-equal-parts-2026.1");
    const badComponent = certifyTemplateCell(withCell((cell) => mapUnits(cell, (unit) => ({
      ...unit, lessons: unit.lessons.map((lesson) => lesson.authority !== "GOVERNED" ? lesson : ({ ...lesson, components: [...lesson.components,
        { kind: "QUIZ" as const, source: "LESSON_PAYLOAD" as const, ref: "quiz" },
        { kind: "PRACTICE" as const, source: "GOVERNED_ITEM" as const, ref: "g4-frac-diagnostic-compare" }] })),
    }))));
    expect(badComponent.errors).toEqual(expect.arrayContaining([
      "component_payload_missing:ll-g4-math-fractions-equal-parts-2026.1:quiz",
      "component_item_concept_mismatch:ll-g4-math-fractions-equal-parts-2026.1:g4-frac-diagnostic-compare",
      "component_item_context_mismatch:ll-g4-math-fractions-equal-parts-2026.1:g4-frac-diagnostic-compare",
    ]));
    const stale = certifyTemplateCell({ ...base(), repoLessons: base().repoLessons.filter((l) => l.authority !== "GOVERNED") });
    expect(stale.errors).toContain("lesson_missing:ll-g4-math-fractions-equal-parts-2026.1");
  });

  it("never lets a draft lesson act as governed authority", () => {
    const report = certifyTemplateCell(withCell((cell) => mapUnits(cell, (unit) => ({
      ...unit, lessons: unit.lessons.map((lesson) => lesson.authority !== "DRAFT_UNREVIEWED" || !lesson.contentId.includes("equivalent-fractions") ? lesson
        : { ...lesson, conceptIds: ["g4-fractions-equivalence"], components: [...lesson.components, { kind: "PRACTICE" as const, source: "GOVERNED_ITEM" as const, ref: "g4-frac-practice-equivalence" }] }),
    }))));
    expect(report.errors).toEqual(expect.arrayContaining([
      "draft_lesson_claims_concepts:ll-g4-math-equivalent-fractions-2026.1",
      "draft_lesson_uses_governed_item:ll-g4-math-equivalent-fractions-2026.1",
    ]));
    const clean = certifyTemplateCell(base());
    expect(clean.summary.objectivesWithGovernedLesson).toBe(1);
    expect(clean.summary.objectivesWithDraftLessonOnly).toBe(43);
    expect(clean.summary.componentCoverage.QUIZ).toBe(0);
    expect(clean.summary.draftComponentCoverage.QUIZ).toBe(43);
  });

  it("live gate fails until every objective has governed lessons and live references resolve", () => {
    const gate = liveCertificationChecklist(certifyTemplateCell({ ...base(), live: {
      capturedAt: "2026-09-26T00:00:00Z", lessonContentIds: new Set(), learningTargetCodes: new Set(),
      standardCodes: new Set(["LR-MATH-G4_6-02"]), skillIds: new Set(["placement-skill-MATH-G4_6"]), unitIds: [],
    } }));
    const byId = Object.fromEntries(gate.map((g) => [g.id, g.pass]));
    expect(byId).toMatchObject({ "governed-lessons": false, "instruction-bindings": false, "assessment-bindings": false, "release-live": false,
      "evidence-bindings": true, "tool-policies": true, interaction: true, offline: true, "no-draft-as-governed": true, "no-moe-claim": true, internal: true });
    expect(gate.find((g) => g.id === "governed-lessons")!.detail).toMatch(/^43 failing/);
    const unchecked = liveCertificationChecklist(certifyTemplateCell(base()));
    expect(unchecked.find((g) => g.id === "release-live")!.pass).toBe(false);
  });

  it("requires every ToolPolicy key to map to an enabled toolkit tool", () => {
    const report = certifyTemplateCell({ ...base(), releaseToolKeyMap: { fraction_strips: "fraction-visualizer", calculator: "basic-calculator" }, toolIds: new Set(["number-line"]) });
    expect(report.errors).toEqual(expect.arrayContaining([
      "tool_policy_key_unmapped:g4-math-instruction-tools:number_line",
      "tool_policy_tool_missing:g4-math-instruction-tools:fraction_strips->fraction-visualizer",
    ]));
  });

  it("reports live gaps separately from internal executability", () => {
    const report = certifyTemplateCell({ ...base(), live: {
      capturedAt: "2026-09-26T00:00:00Z", lessonContentIds: new Set(), learningTargetCodes: new Set(),
      standardCodes: new Set(["LR-MATH-G4_6-02"]), skillIds: new Set(["placement-skill-MATH-G4_6"]), unitIds: ["yearmap-g4-math-u01"],
    } });
    expect(report.internallyExecutable).toBe(true);
    expect(report.live.liveExecutable).toBe(false);
    expect(report.live.missing).toEqual(["learningTarget:LR-MATH-G4_6-02", "lesson:ll-g4-math-fractions-equal-parts-2026.1"]);
    expect(report.live.productionUnitsNotInCell).toEqual(["yearmap-g4-math-u01"]);
  });
});
