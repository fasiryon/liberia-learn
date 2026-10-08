/**
 * Bounded migration adapter: a Grade 4 Math DRAFT_UNREVIEWED lesson (long-form payload) →
 * Curriculum V2 candidate (scene hierarchy level 2 → 1).
 *
 * It maps only structure the source already declares, records every section it maps or omits,
 * and pins the source revision by hash (Codex P2-3). It never infers objectives, labs or
 * authority (P2-4): the objective is the draft's own declared moeObjectiveId, which must match
 * the pinned context; no lab is proposed; answers and teacher material are omitted, never moved
 * into learner scenes. The result goes through the same parser, validator and review as any
 * generated candidate. This is not mass conversion: it runs one named lesson at a time.
 */
import { createHash } from "crypto";
import type { DraftLesson } from "@/lib/curriculum/authority/grade4Math";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { AuthoringContext } from "./authoringContext";
import { CANDIDATE_LESSON_V2_CONTRACT, type CandidateLessonV2, type CandidateScene, type CurriculumLessonV2 } from "./contract";

export const MIGRATION_ADAPTER_VERSION = "g4-math-draft-to-v2/1.0.0";

export function migrateDraftLesson(draft: DraftLesson, context: AuthoringContext): { candidate: CandidateLessonV2; migration: NonNullable<CurriculumLessonV2["provenance"]["migration"]> } {
  if (context.objectives.length !== 1 || context.objectives[0].id !== draft.moeObjectiveId) throw new Error("migration_objective_not_declared_by_source");
  const objectiveId = draft.moeObjectiveId;
  const payload = draft.payload;
  const tools = (context.interactions[objectiveId]?.tools ?? []).slice(0, 3);
  const offlineNote = payload.offline.slice(0, 400);
  const base = (id: string, type: CandidateScene["type"], title: string, purpose: CandidateScene["purpose"], learnerAction: string, body: string): Omit<CandidateScene, "interaction" | "evidence" | "completion"> => ({
    id, type, title, purpose, objectiveIds: [objectiveId], learnerAction, content: { body }, tools: { requested: type === "MASTERY_CHECK" ? [] : tools, prohibited: [] },
    hints: [], misconceptionIds: [], accessibility: { textAlternative: body.length >= 20 ? body.slice(0, 600) : `${title}: ${body}`, keyboardPath: "Read the text; use Tab and Space to answer.", reducedMotion: "NOT_APPLICABLE" },
    offline: { mode: "FULL_OFFLINE", note: offlineNote },
  });

  const quizItems = payload.quiz.map((item, index) => {
    const options = item.options.map((text, optionIndex) => ({ id: `o${optionIndex + 1}`, text, feedback: text === item.answer ? "Yes, that one fits. Check how the explanation shows it." : "Not yet. Look back at the explanation and the worked example, then try again." }));
    const expected = options.find((option) => option.text === item.answer);
    if (!expected) throw new Error(`migration_quiz_answer_not_an_option:${index}`);
    return { id: `quiz-${index + 1}`, prompt: item.prompt, options, formativeKey: { expectedOptionId: expected.id } };
  });

  const scenes: CandidateScene[] = [
    { ...base("learn", "EXPLANATION", payload.title, "EXPLAIN_CONCEPT", "Read the explanation and the examples.", payload.body), interaction: { kind: "NONE" }, evidence: { kind: "NONE" }, completion: "VIEWED" },
    { ...base("classwork", "GUIDED_EXAMPLE", "Work it out together", "GUIDED_PRACTICE", "Do the classroom activity with your group.", payload.activities.map((activity, index) => `${index + 1}. ${activity}`).join("\n")), interaction: { kind: "NONE" }, evidence: { kind: "NONE" }, completion: "VIEWED" },
    {
      ...base("quick-check", "CHECK_UNDERSTANDING", "Quick check", "CHECK_UNDERSTANDING", "Choose an answer for each question.", "Answer each question. You will see feedback straight away."),
      interaction: { kind: "SINGLE_CHOICE", items: quizItems },
      evidence: { kind: "FORMATIVE_OBSERVATION", evidenceType: "PRACTICE", responses: quizItems.map((item) => ({ responseKey: item.id, objectiveId, responseType: "SELECTED_OPTION" as const, scaffoldLevel: "PARTIAL" as const })) },
      completion: "ALL_ANSWERED",
    },
    {
      ...base("practice", "PRACTICE", "Practice on your own", "INDEPENDENT_PRACTICE", "Write your answer to each problem.", "Solve each problem in your own words or numbers."),
      interaction: { kind: "FREE_RESPONSE", prompts: payload.practice.map((problem, index) => ({ id: `practice-${index + 1}`, prompt: problem.prompt, minLength: 1 })) },
      evidence: { kind: "REFLECTION", evidenceType: "PRACTICE", responses: payload.practice.map((_, index) => ({ responseKey: `practice-${index + 1}`, objectiveId, responseType: "TEXT" as const, scaffoldLevel: "MINIMAL" as const })) },
      completion: "ALL_RESPONSES_WRITTEN",
    },
    {
      ...base("mastery", "MASTERY_CHECK", "Show what you know", "ASSESS_MASTERY", "Answer the final questions.", "Answer each question. Your answers are checked by the school's learning system."),
      interaction: { kind: "ASSESSMENT_HANDOFF", assessmentRequestId: "mastery-request" },
      evidence: { kind: "MASTERY_RESPONSE", evidenceType: "QUIZ", responses: [{ responseKey: "mastery-response", objectiveId, responseType: "ASSESSMENT_RESPONSE", scaffoldLevel: "NONE" }] },
      completion: "ALL_ANSWERED",
    },
  ];

  const candidate: CandidateLessonV2 = {
    contractVersion: CANDIDATE_LESSON_V2_CONTRACT,
    title: payload.title,
    estimatedMinutes: Math.min(90, Math.max(10, payload.durationMins)),
    ageBand: context.ageBand,
    prerequisiteAssumptions: [],
    misconceptions: [],
    scenes,
    assessmentRequests: [{ id: "mastery-request", objectiveIds: [objectiveId], interaction: "SINGLE_CHOICE", evidenceType: "QUIZ", difficulty: "CORE", misconceptionIds: [], tools: { requested: [], prohibited: [] }, offline: "FULL_OFFLINE" }],
    labProposals: [],
  };
  return {
    candidate,
    migration: {
      adapterVersion: MIGRATION_ADAPTER_VERSION,
      sourceContentId: draft.contentId,
      sourceVersion: draft.version,
      sourceSha256: createHash("sha256").update(canonicalizeJson(draft.payload)).digest("hex"),
      sectionMap: [
        { from: "body", toSceneId: "learn" },
        { from: "activities", toSceneId: "classwork" },
        { from: "quiz", toSceneId: "quick-check" },
        { from: "practice.prompt", toSceneId: "practice" },
        { from: "assessment.prompt", toSceneId: null },
        { from: "offline", toSceneId: null },
      ],
      omissions: [
        "practice.answer, homework.answer, assessment.answer, diagnosticCheck.answer: answer keys stay with the assessment authority, never in learner scenes",
        "teacherNotes: teacher-only",
        "homework: assigned outside the lesson player",
        "diagnosticCheck: pre-lesson diagnostic belongs to the governed diagnostic flow",
        "assessment: becomes an Assessment Player V2 request; the item itself is not copied",
        "materials: kept in the source; not a learner scene",
      ],
    },
  };
}
