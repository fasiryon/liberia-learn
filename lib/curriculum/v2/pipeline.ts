/**
 * Curriculum V2 generation pipeline.
 *
 *   governed curriculum source → objective/ontology retrieval (authoringContext)
 *   → generation brief → structured candidate generation (LLM or author)
 *   → strict parse → deterministic validation → assembly (server authority)
 *   → curriculum review package → HUMAN REVIEW → governed approval → release → Lesson Player V2
 *
 * AI stops at "structured candidate generation". Everything after it is deterministic server
 * code, and approval/release are governed human decisions outside this module: the pipeline
 * returns a DRAFT artifact or a rejection, never a persisted, approved or published lesson.
 */
import { buildPrompt } from "@/lib/ai/promptRegistry";
import type { RouterOptions, RouterResult } from "@/lib/ai/routedCompletion";
import { curriculumV2LessonArchive, curriculumV2PromptHash } from "@/lib/ai/prompts/archive/curriculum.v2.lesson/1.0.0";
import { listLabExperiences, isGradeAppropriate } from "@/lib/learner-experience/labExperience";
import { assembleCurriculumLessonV2, type AssemblyOutcome } from "./assemble";
import type { AuthoringContext } from "./authoringContext";
import { RENDERABLE_FALLBACKS, RENDERABLE_INTERACTIONS } from "./deliverability";
import { CandidateRejectedError, parseCandidateLessonV2 } from "./parse";
import { canonicalToolIds, toolFitsContext } from "./tools";

export type CompletionFn = (options: RouterOptions) => Promise<Pick<RouterResult, "content" | "model">>;

/** The only facts a generator sees: built from the pinned context, never from the candidate. */
export function buildGenerationBrief(context: AuthoringContext): Record<string, unknown> {
  const objectiveIds = new Set(context.objectives.map((objective) => objective.id));
  return {
    grade: context.grade,
    subject: context.subject,
    ageBand: context.ageBand,
    objectives: context.objectives.map((objective) => ({ id: objective.id, statement: objective.statement, conceptIds: objective.conceptIds, sourceConfidence: objective.sourceConfidence })),
    interactionGuidance: context.objectives.map((objective) => {
      const spec = context.interactions[objective.id];
      return { objectiveId: objective.id, need: spec?.need ?? "NONE", rationale: spec?.rationale ?? "", offlineFallback: spec?.offlineFallback ?? null, plannedEnhancementGap: spec?.plannedEnhancement?.gapCode ?? null };
    }),
    prerequisiteConceptIds: context.prerequisiteConceptIds,
    tools: canonicalToolIds().filter((tool) => toolFitsContext(tool, { grade: context.grade, subject: context.subject, lessonType: "lesson" }) || toolFitsContext(tool, { grade: context.grade, subject: context.subject, lessonType: "practice" })),
    labs: listLabExperiences().filter((lab) => lab.objectiveIds.some((id) => objectiveIds.has(id)) && isGradeAppropriate(lab, context.grade)).map((lab) => ({ labId: lab.labId, objectiveIds: lab.objectiveIds.filter((id) => objectiveIds.has(id)), released: lab.release.status === "RELEASED" })),
    supportedInteractions: [...RENDERABLE_INTERACTIONS],
    supportedFallbacks: [...RENDERABLE_FALLBACKS],
    mediaRendering: "No media renderer: any MEDIA_REQUIRED item needs an objective-preserving fallback.",
  };
}

export async function generateCurriculumLessonV2(input: { context: AuthoringContext; complete: CompletionFn; now?: () => Date }): Promise<AssemblyOutcome> {
  const brief = JSON.stringify(buildGenerationBrief(input.context));
  const messages: RouterOptions["messages"] = [
    { role: "system", content: buildPrompt(curriculumV2LessonArchive.systemKey) },
    { role: "user", content: buildPrompt(curriculumV2LessonArchive.userKey, { brief }) },
  ];
  const result = await input.complete({
    messages,
    responseFormat: "json",
    forceSmartTier: true,
    aiUsage: {
      route: "curriculum-v2-generation",
      feature: "curriculum",
      requestType: "curriculum_v2_lesson",
      subject: input.context.subject,
      promptKey: curriculumV2LessonArchive.key,
      promptVersion: curriculumV2LessonArchive.version,
      promptHash: curriculumV2PromptHash,
    },
  });
  try {
    const candidate = parseCandidateLessonV2(result.content);
    return assembleCurriculumLessonV2({
      candidate,
      context: input.context,
      generation: { origin: "AI_GENERATED", promptKey: curriculumV2LessonArchive.key, promptVersion: curriculumV2LessonArchive.version, promptHash: curriculumV2PromptHash, model: result.model, generatedAt: (input.now?.() ?? new Date()).toISOString() },
    });
  } catch (error) {
    if (error instanceof CandidateRejectedError) return { status: "REJECTED", errors: [error.code, ...error.issues], gaps: [] };
    throw error;
  }
}
