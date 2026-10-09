/**
 * Strict Curriculum V2 candidate parser (Codex P1-3).
 *
 * Generated JSON is untrusted. This is the security boundary, not TypeScript types and not
 * Phase A's validateLessonExperience:
 *   1. size bound before parsing;
 *   2. a deep key scan that rejects authority-bearing and assessment-secret keys at any depth;
 *   3. strict schemas (unknown keys rejected) with bounded strings and arrays;
 *   4. no URLs anywhere (asset references come only from governed media, never generation).
 * Authority (objectives' meaning, release identity, approval, lab release) is never read from
 * the candidate; assemble.ts constructs it from trusted authoring context.
 */
import { z } from "zod";
import { SCENE_TYPES } from "@/lib/learner-experience/types";
import {
  CANDIDATE_LESSON_V2_CONTRACT, FALLBACK_KINDS, INSTRUCTIONAL_PURPOSES, INTERACTION_KINDS, MEDIA_KINDS, MEDIA_REQUIREMENTS,
  OFFLINE_MODES, PEDAGOGY_STRATEGIES, REPRESENTATIONS, RESPONSE_TYPES, SCAFFOLD_LEVELS, V2_LIMITS, type CandidateLessonV2,
} from "./contract";

export class CandidateRejectedError extends Error {
  constructor(readonly code: string, readonly issues: readonly string[] = []) {
    super(issues.length ? `${code}: ${issues.slice(0, 5).join("; ")}` : code);
    this.name = "CandidateRejectedError";
  }
}

/** Keys that would let generated content assert governance, publication, learner state or authority. */
export const AUTHORITY_KEYS = Object.freeze([
  "approved", "approval", "approvalState", "approvalStatus", "approvedBy", "approvedAt", "approver",
  "released", "release", "releaseId", "releaseIdentity", "releaseStatus", "published", "publishedAt", "publication",
  "status", "state", "reviewState", "reviewStatus", "governance", "lifecycle", "lifecycleState",
  "moeApprovalState", "moeApproved", "authority", "curriculumAuthority", "provenance", "contextHash",
  "mastery", "masteryLevel", "masteryUpdate", "masteryMutation", "canonicalMasteryMutation",
  "nextLesson", "nextAction", "teacherOverride", "override", "learnerState", "studentEligible", "eligibility",
]);

/** Assessment secrets that must never be generated into a lesson artifact (keys go to the assessment authority). */
export const SECRET_KEYS = Object.freeze([
  "answer", "answers", "answerKey", "answerKeys", "correctIndex", "correctAnswer", "correctOption", "correct", "isCorrect",
  "solution", "solutions", "rubric", "scoring", "scoringRubric", "score", "points", "markScheme", "expectedAnswer",
  "explanationForTeacher", "teacherNotes", "teacherNote", "teacherGuide", "hiddenRubric",
]);

const AUTHORITY_SET = new Set(AUTHORITY_KEYS.map((key) => key.toLowerCase()));
const SECRET_SET = new Set(SECRET_KEYS.map((key) => key.toLowerCase()));
const URL_PATTERN = /\b(?:https?|ftp|data|javascript):/i;

/** Walks every key and string at every depth. */
export function scanCandidate(value: unknown, path = "$", issues: string[] = []): string[] {
  if (typeof value === "string") {
    if (URL_PATTERN.test(value)) issues.push(`url_forbidden:${path}`);
    return issues;
  }
  if (Array.isArray(value)) { value.forEach((entry, index) => scanCandidate(entry, `${path}[${index}]`, issues)); return issues; }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (AUTHORITY_SET.has(lower)) issues.push(`authority_field_forbidden:${path}.${key}`);
      if (SECRET_SET.has(lower)) issues.push(`secret_field_forbidden:${path}.${key}`);
      scanCandidate(entry, `${path}.${key}`, issues);
    }
  }
  return issues;
}

const S = (max: number = V2_LIMITS.stringChars) => z.string().trim().min(1).max(max);
const ID = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "id must be a lowercase slug");
const IDS = (max = 12) => z.array(ID).max(max);
const AGE_BANDS = ["EARLY_PRIMARY", "UPPER_PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"] as const;
const EVIDENCE_TYPES = ["LESSON_COMPLETION", "CLASSWORK", "HOMEWORK", "PRACTICE", "QUIZ", "DIAGNOSTIC", "EXAM_TEST", "PROJECT", "PRACTICAL", "LAB", "SIMULATION"] as const;
const OBJECTIVE_ID = z.string().regex(/^[a-z0-9][a-z0-9-]{2,160}$/);
const TOOL_ID = z.string().regex(/^[a-z0-9-]{2,48}$/);
const TOOLS = z.object({ requested: z.array(TOOL_ID).max(6), prohibited: z.array(TOOL_ID).max(12) }).strict();
const BODY = z.object({ body: S(), keyPoints: z.array(S(300)).max(V2_LIMITS.keyPoints).optional() }).strict();

const option = z.object({ id: ID, text: S(300), feedback: S(400) }).strict();
const interaction = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NONE") }).strict(),
  z.object({ kind: z.literal("DIAGRAM_REVEAL"), steps: z.array(z.object({ id: ID, label: S(120), description: S(400) }).strict()).min(2).max(V2_LIMITS.stepsPerDiagram) }).strict(),
  z.object({
    kind: z.literal("SINGLE_CHOICE"),
    items: z.array(z.object({ id: ID, prompt: S(500), options: z.array(option).min(2).max(V2_LIMITS.optionsPerItem), formativeKey: z.object({ expectedOptionId: ID }).strict() }).strict()).min(1).max(V2_LIMITS.itemsPerScene),
  }).strict(),
  z.object({ kind: z.literal("FREE_RESPONSE"), prompts: z.array(z.object({ id: ID, prompt: S(500), minLength: z.number().int().min(1).max(400) }).strict()).min(1).max(V2_LIMITS.itemsPerScene) }).strict(),
  z.object({ kind: z.literal("LAB_LAUNCH"), labCandidateId: ID }).strict(),
  z.object({ kind: z.literal("ASSESSMENT_HANDOFF"), assessmentRequestId: ID }).strict(),
  ...(["MULTI_SELECT", "NUMERIC", "MATCHING", "ORDERING", "DIAGRAM_LABELING", "DRAG_DROP", "SIMULATION_OBSERVATION"] as const).map((kind) =>
    z.object({ kind: z.literal(kind), prompt: S(500), elements: z.array(S(200)).min(1).max(12) }).strict()),
]);

const evidence = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NONE") }).strict(),
  z.object({
    kind: z.enum(["FORMATIVE_OBSERVATION", "LAB_OBSERVATION", "REFLECTION", "MASTERY_RESPONSE"]),
    evidenceType: z.enum(EVIDENCE_TYPES),
    responses: z.array(z.object({
      responseKey: ID, objectiveId: OBJECTIVE_ID, responseType: z.enum(RESPONSE_TYPES), scaffoldLevel: z.enum(SCAFFOLD_LEVELS), misconceptionId: ID.optional(),
    }).strict()).min(1).max(V2_LIMITS.itemsPerScene),
  }).strict(),
]);

const scene = z.object({
  id: ID,
  type: z.enum(SCENE_TYPES),
  title: S(140),
  purpose: z.enum(INSTRUCTIONAL_PURPOSES),
  objectiveIds: z.array(OBJECTIVE_ID).max(4),
  learnerAction: S(400),
  content: z.object({
    body: S(),
    keyPoints: z.array(S(300)).max(V2_LIMITS.keyPoints).optional(),
    ageVariants: z.object(Object.fromEntries(AGE_BANDS.map((band) => [band, BODY.optional()])) as Record<(typeof AGE_BANDS)[number], z.ZodOptional<typeof BODY>>).strict().optional(),
  }).strict(),
  interaction,
  fallback: z.object({ kind: z.enum(FALLBACK_KINDS), content: S(), objectivePreserved: z.boolean() }).strict().optional(),
  media: z.array(z.object({ id: ID, kind: z.enum(MEDIA_KINDS), requirement: z.enum(MEDIA_REQUIREMENTS), description: S(600), altText: S(600), transcript: S().optional() }).strict()).max(3).optional(),
  tools: TOOLS,
  expectedObservation: S(600).optional(),
  hints: z.array(S(400)).max(V2_LIMITS.hintsPerScene),
  feedback: z.object({ onSuccess: S(400), onStruggle: S(400) }).strict().optional(),
  misconceptionIds: IDS(),
  evidence,
  accessibility: z.object({ textAlternative: S(), keyboardPath: S(400), reducedMotion: z.enum(["NOT_APPLICABLE", "STATIC_EQUIVALENT"]), nonPointerAlternative: S(600).optional() }).strict(),
  offline: z.object({ mode: z.enum(OFFLINE_MODES), note: S(400) }).strict(),
  completion: z.enum(["VIEWED", "ALL_STEPS_REVEALED", "ALL_ANSWERED", "ALL_RESPONSES_WRITTEN", "LAB_RETURNED_OR_FALLBACK"]),
  pedagogy: z.object({ strategy: z.enum(PEDAGOGY_STRATEGIES), representation: z.enum(REPRESENTATIONS), scaffoldLevel: z.enum(SCAFFOLD_LEVELS) }).strict().optional(),
  dependsOn: IDS().optional(),
}).strict();

const CandidateSchema = z.object({
  contractVersion: z.literal(CANDIDATE_LESSON_V2_CONTRACT),
  title: S(140),
  estimatedMinutes: z.number().int().min(10).max(90),
  ageBand: z.enum(AGE_BANDS),
  pedagogy: z.object({ primaryStrategy: z.enum(PEDAGOGY_STRATEGIES), rationale: S(600) }).strict().optional(),
  prerequisiteAssumptions: z.array(S(300)).max(6),
  misconceptions: z.array(z.object({ id: ID, objectiveId: OBJECTIVE_ID, description: S(400), response: S(600) }).strict()).max(V2_LIMITS.misconceptions),
  scenes: z.array(scene).min(V2_LIMITS.scenes.min).max(V2_LIMITS.scenes.max),
  assessmentRequests: z.array(z.object({
    id: ID, objectiveIds: z.array(OBJECTIVE_ID).min(1).max(4), interaction: z.enum(INTERACTION_KINDS),
    evidenceType: z.enum(["QUIZ", "DIAGNOSTIC", "PRACTICE"]), difficulty: z.enum(["INTRO", "CORE", "STRETCH"]),
    misconceptionIds: IDS(), tools: TOOLS, offline: z.enum(OFFLINE_MODES),
  }).strict()).max(V2_LIMITS.assessmentRequests),
  labProposals: z.array(z.object({
    id: ID, labId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/), objectiveId: OBJECTIVE_ID, placementSceneId: ID,
    requirement: z.enum(["REQUIRED", "RECOMMENDED", "OPTIONAL"]), checkIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)).max(12), rationale: S(600),
  }).strict()).max(V2_LIMITS.labCandidates),
}).strict();

/** Parse untrusted generator output. Throws CandidateRejectedError; never returns a partial artifact. */
export function parseCandidateLessonV2(raw: unknown): CandidateLessonV2 {
  let value = raw;
  if (typeof raw === "string") {
    if (Buffer.byteLength(raw, "utf8") > V2_LIMITS.candidateBytes) throw new CandidateRejectedError("candidate_too_large");
    try { value = JSON.parse(raw); } catch { throw new CandidateRejectedError("candidate_not_json"); }
  } else if (Buffer.byteLength(JSON.stringify(raw ?? null), "utf8") > V2_LIMITS.candidateBytes) {
    throw new CandidateRejectedError("candidate_too_large");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CandidateRejectedError("candidate_not_object");
  const forbidden = scanCandidate(value);
  if (forbidden.length) throw new CandidateRejectedError(forbidden.some((issue) => issue.startsWith("authority")) ? "candidate_authority_injection" : forbidden.some((issue) => issue.startsWith("secret")) ? "candidate_secret_field" : "candidate_url_forbidden", forbidden);
  const parsed = CandidateSchema.safeParse(value);
  if (!parsed.success) throw new CandidateRejectedError("candidate_schema_invalid", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  return parsed.data as CandidateLessonV2;
}
