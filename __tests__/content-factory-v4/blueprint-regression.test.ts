import { V4_INSTRUCTION_STANDARD as V4_INSTRUCTION_STANDARD_ID } from "@/lib/learner-experience/teaching/instruction";
// Interactive Learning V4 in Content Factory V2: a unit-blueprint/2.2.0 unit holds every LESSON it produces to the
// V4 standard (candidate-lesson-v2/1.1.0, registered blocks, the subject pattern, independence); 2.0.0/2.1.0 units and
// the packages pinned to them are unchanged.
import { describe, expect, it } from "vitest";
import { ASSESSMENT_EVIDENCE_KINDS } from "@/lib/curriculum/excellence/assessmentBlueprint";
import { blueprintHash, blueprintRef, parseBlueprint, UNIT_BLUEPRINT_V4_VERSION, type UnitBlueprint } from "@/lib/content-factory/v2/blueprint";
import { artifactHash, validateArtifact } from "@/lib/content-factory/v2/quality";
import type { FactoryArtifact } from "@/lib/content-factory/v2/types";
import { candidateText, findV4Lesson } from "@/lib/curriculum/v4/candidates";

const sha = "a".repeat(64);
const pin = { id: "src-1", version: "1.0.0", sha256: sha, sourceRef: "fixture" };
const objectives = ["ll-g7-math-ap-rectangles", "ll-g7-math-ap-triangles"];

function blueprint(schemaVersion: UnitBlueprint["schemaVersion"], v4: boolean): UnitBlueprint {
  const body = {
    schemaVersion, blueprintId: "bp-g7-area-perimeter", version: "4.0.0", grade: 7, subject: "MATH", unitId: "g7-area-perimeter", title: "Area and perimeter",
    repositoryCommit: "b".repeat(40), sources: [pin],
    objectives: objectives.map((id) => ({ id, kind: "NATIONAL" as const, statement: id, sourceId: "src-1", sourcePointer: "p1", scope: "REQUIRED" as const, mapping: "PROPOSED" as const })),
    outcomes: [{ id: "out-1", objectiveIds: objectives, demonstration: "Finds areas and perimeters." }],
    prerequisites: [], misconceptions: [],
    sequence: [{ resourceId: "lesson", dependsOn: [], objectiveIds: objectives, scaffold: "FULL" as const }],
    resources: [{ id: "lesson", kind: "LESSON" as const, role: "LESSON_AUTHOR" as const, objectiveIds: objectives, dependsOn: [], audience: "LEARNER" as const }],
    assessmentPlan: [{ id: "t1", resourceId: "lesson", itemIds: [], kind: ASSESSMENT_EVIDENCE_KINDS[0], objectiveIds: objectives, scaffold: "NONE" as const, timing: "END_OF_LESSON" as const, context: "NEW" as const, scoring: "KEYED" as const, source: "EXCELLENCE_PLAN" as const, ref: "plan-1" }],
    support: { differentiation: ["Grid paper."], accessibility: ["Text alternatives."], offline: { mode: "TEXT_PAPER_CAPTURE_ONLY" as const, requirements: ["Paper."], maxBytes: 1000 } },
    provenance: [pin], legacy: [], unresolved: [],
    ...(v4 ? { instructionStandard: V4_INSTRUCTION_STANDARD_ID } : {}),
  };
  return { ...body, contentHash: blueprintHash(body as UnitBlueprint) } as UnitBlueprint;
}

function lessonArtifact(unit: UnitBlueprint, candidate: unknown): FactoryArtifact {
  const draft = { id: "lesson", version: "4.0.0", payload: { kind: "LESSON", candidate }, blueprint: blueprintRef(unit), role: "LESSON_AUTHOR", author: { kind: "AI", agentId: "factory-test:LESSON_AUTHOR", modelFamily: "deterministic-local", sessionId: "test" }, dependencies: [] } as unknown as FactoryArtifact;
  return { ...draft, contentHash: artifactHash(draft) };
}

const geometry = () => JSON.parse(candidateText(findV4Lesson("g7-math-area-perimeter")!));
const v4Failures = (failures: string[]) => failures.filter((failure) => failure.startsWith("v4_"));

describe("Content Factory V4 (unit-blueprint/2.2.0)", () => {
  it("only a 2.2.0 blueprint may declare the V4 standard, and a 2.2.0 blueprint must", () => {
    expect(() => parseBlueprint(blueprint("unit-blueprint/2.1.0", true))).toThrow(/instruction_standard_requires_blueprint_2_2/);
    expect(() => parseBlueprint(blueprint(UNIT_BLUEPRINT_V4_VERSION, false))).toThrow(/instruction_standard_requires_blueprint_2_2/);
  });

  it("accepts the V4 geometry reference lesson", () => {
    const unit = blueprint(UNIT_BLUEPRINT_V4_VERSION, true);
    expect(validateArtifact(unit, lessonArtifact(unit, geometry()))).toEqual([]);
  });

  it("returns a V4 lesson for revision when it breaks independence or loses its worked examples", () => {
    const unit = blueprint(UNIT_BLUEPRINT_V4_VERSION, true);
    const hinted = geometry();
    hinted.scenes.find((scene: { id: string }) => scene.id === "alone-roof").hints = ["Use half of base times height."];
    expect(validateArtifact(unit, lessonArtifact(unit, hinted)).join(" ")).toMatch(/v4_hints_in_independent_phase/);
    const textOnly = geometry();
    for (const scene of textOnly.scenes) if (scene.teaching && scene.teaching.phase !== "ASSESS") scene.teaching.blocks = [];
    for (const scene of textOnly.scenes) if (scene.teaching) delete scene.teaching.visual;
    expect(v4Failures(validateArtifact(unit, lessonArtifact(unit, textOnly)))).toEqual(expect.arrayContaining(["v4_standard_v4_text_only_scene:lesson", "v4_standard_v4_math_practice_short:lesson"]));
  });

  it("requires the 1.1.0 lesson contract under a V4 unit", () => {
    const unit = blueprint(UNIT_BLUEPRINT_V4_VERSION, true);
    const legacy = JSON.parse((require("fs") as typeof import("fs")).readFileSync("curriculum/v2/g4-math/candidates/equivalent-fractions.json", "utf8"));
    expect(validateArtifact(unit, lessonArtifact(unit, legacy))).toContain("v4_lesson_contract_required:lesson");
  });

  it("leaves 2.1.0 units exactly as before: no V4 checks", () => {
    const unit = blueprint("unit-blueprint/2.1.0", false);
    expect(v4Failures(validateArtifact(unit, lessonArtifact(unit, geometry())))).toEqual([]);
  });
});
