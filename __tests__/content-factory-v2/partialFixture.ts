/** Reuses existing deterministic SYNTHETIC fixtures. No real cohort ID or lesson content is generated. */
import { tenLessonFixture } from "@/lib/content-factory/v2/batchFixture";
import { createAuthoringTemplate, validateAuthoringInput, type AuthoringInput, type AuthoringRequirements } from "@/lib/content-factory/v2/authoringInput";
import { parseBlueprint } from "@/lib/content-factory/v2/blueprint";
import { inventoryLegacy } from "@/lib/content-factory/v2/inventory";
import { parseResourceDraft } from "@/lib/content-factory/v2/quality";
import type { AuthoringCohort } from "@/lib/content-factory/v2/partialBatch";

export async function partialFixture() {
  const fixture = await tenLessonFixture();
  const rows = inventoryLegacy(fixture.inventory).rows;
  const drafts = Object.values(JSON.parse(fixture.generationBytes.toString("utf8"))).flat().map(parseResourceDraft);
  const context: AuthoringRequirements = { baselineCommit: "a".repeat(40), lessons: fixture.contract.lessons.map(entry => {
    const b = parseBlueprint(entry.blueprint);
    return { key: entry.candidateId, source: entry.source, grade: b.grade, subject: b.subject,
      objectiveIds: b.objectives.filter(o => o.scope === "REQUIRED").map(o => o.id),
      misconceptions: b.misconceptions.map(m => ({ id: m.id, description: m.description, probe: "SYNTHETIC fixture probe", feedback: "SYNTHETIC fixture feedback" })),
      mediaSpecifications: [], retention: { delayDays: 7, items: ["SYNTHETIC fixture retention binding"] },
      assessmentTasks: b.assessmentPlan.filter(t => t.resourceId === "summative").map(t => ({ id: t.id, objectiveIds: t.objectiveIds, scoring: t.scoring,
        kind: t.kind === "EXTENDED_REASONING" ? "REASONING_TASK" : "PRODUCED_ANSWER", task: "SYNTHETIC fixture task reference" })),
    };
  }) };
  const packages: AuthoringInput[] = fixture.contract.lessons.map(entry => {
    const b = parseBlueprint(entry.blueprint);
    const p = createAuthoringTemplate(b, context); p.inputState = "AUTHORED_DRAFT";
    for (const resource of p.resources) { resource.payload = structuredClone(drafts.find(d => d.id === resource.id)!.payload); p.authors[resource.role] = fixture.actors[resource.role]; }
    for (const binding of p.misconceptionBindings) {
      const m = b.misconceptions.find(m => m.id === binding.id)!;
      const lesson = drafts.find(d => d.id === m.instructionResourceId)!.payload;
      const assessment = drafts.find(d => d.id === m.assessmentResourceId)!.payload;
      if (lesson.kind !== "LESSON" || assessment.kind !== "ASSESSMENT") throw new Error("fixture_owner_mismatch");
      const scene = lesson.candidate.scenes.find(s => s.misconceptionIds.includes(m.id))!;
      const spec = assessment.specs.find(s => s.misconceptionSignals.some(signal => signal.misconceptionId === m.id))!;
      Object.assign(binding, { objectiveId: m.objectiveId, instructionSceneId: scene.id, assessmentResourceId: m.assessmentResourceId, itemId: spec.itemId, responsePattern: m.responsePattern });
    }
    for (const binding of p.rubricBindings) {
      const task = b.assessmentPlan.find(t => t.id === binding.taskId)!;
      const assessment = drafts.find(d => d.id === binding.resourceId)!.payload;
      if (assessment.kind !== "ASSESSMENT") throw new Error("fixture_owner_mismatch");
      const spec = assessment.specs.find(s => task.itemIds.includes(s.itemId))!;
      if (spec.key.kind !== "RUBRIC") throw new Error("fixture_rubric_missing");
      Object.assign(binding, { itemId: spec.itemId, rubricId: spec.key.rubric.rubricId, scoringVersion: spec.scoringVersion });
    }
    p.retentionChecks.items[0].itemIds = b.assessmentPlan.find(t => t.kind === "DELAYED_RETRIEVAL")!.itemIds;
    const checked = validateAuthoringInput(p, "authored", context);
    if (!checked.valid) throw new Error(JSON.stringify(checked));
    return p;
  });
  const cohort: AuthoringCohort = { evidence: "SYNTHETIC_FIXTURE", sources: rows, requirements: context,
    manifest: { sourceCommit: context.baselineCommit, specSha256: fixture.contract.curriculumContract.sha256, extractSha256: fixture.contract.inventoryHash,
      notice: "SYNTHETIC regression manifest only", lessons: context.lessons.map(l => ({ key: l.key, ...l.source, grade: l.grade, subject: l.subject })),
    },
  };
  return { cohort, packages };
}
