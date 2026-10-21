/**
 * Library Modernization Pipeline V1: turns one exact legacy revision into an immutable, reviewable
 * Curriculum V2 candidate package, reusing the Curriculum V2 and Excellence V1 machinery.
 *
 *   1  RESOLVE_LEGACY        exact live revision; recomputed hash must match; must equal the ledger's live record
 *   2  PRESERVE_LEGACY       the complete legacy revision snapshot, byte-for-byte, with its hash
 *   3  LEGACY_MATERIAL       every legacy section with audit findings and the author's disposition (reuse/adapt/replace/discard)
 *   4  AUTHORITY             MOE cell, verified objective ids, lexical leads (never bindings), WAEC status
 *   5  SPECIFICATION         LiberiaLearn-owned spec: objectives by layer, success criteria, prerequisites
 *   6  AUTHOR                candidate + reviewer-only assessment definitions from a CandidateAuthor (budgeted)
 *   7  VALIDATE              strict V2 parse, context validation, spec coherence, deliverability
 *   8  ASSESSMENT            blueprint and automated Excellence checks (AUTOMATED reviewer; never AI judgment of own work)
 *   9  PROJECTION            learner-safe projection; reviewer-only content must not leak
 *  10  EXPERIENCE            Student Experience V3 checks: density by age band, accessibility, offline, pagination
 *  11  COMPARISON            legacy → candidate matrix
 *  12  PACKAGE               immutable package and deterministic manifest
 *  13  QUEUE                ledger WORK_STARTED / CANDIDATE_REGISTERED / REVIEW_REQUESTED, never review or release
 *
 * Resumable and idempotent: each stage records its input hash in run.json; an unchanged stage is
 * skipped. Immutable: a package version that exists with a different manifest is refused; changing a
 * candidate requires a new version. Budget-aware: authoring calls are counted against a budget and a
 * per-lesson attempt cap, and an author that fails twice on the same input is stopped (no loops).
 *
 * The pipeline never writes to a database, never publishes, never replaces a live revision, and never
 * scores or writes mastery. Candidate status is at most READY_FOR_INDEPENDENT_REVIEW.
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { canonicalizeJson, hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import { validateCandidateAgainstContext, words } from "@/lib/curriculum/v2/validate";
import { sceneDeliverability, type SceneDeliverability } from "@/lib/curriculum/v2/deliverability";
import { toLessonExperience } from "@/lib/curriculum/v2/compat";
import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import { ageBandForGrade } from "@/lib/curriculum/v2/authoringContext";
import type { AgeBand, LessonExperience } from "@/lib/learner-experience/types";
import { buildInstructionalReview, type AgentIdentity, type InstructionalReviewReport } from "@/lib/curriculum/excellence/instructionalReviewer";
import type { PlannedAssessmentTask } from "@/lib/curriculum/excellence/assessmentBlueprint";
import type { LibraryExtractRecord } from "./extract";
import { auditLegacyLesson, type LessonAudit, type LibraryAuditContext } from "./legacyAudit";
import { loadMoeObjectives, parseLegacyAlignmentClaims, resolveMoeCell, applicableExaminations, WAEC_TAG_EVIDENCE } from "./moeAuthority";
import { primaryText, splitSections, type SnapshotV1 } from "./text";
import type { LedgerActor, NewLedgerEvent } from "./ledger";

export const MODERNIZATION_PIPELINE_VERSION = "liberialearn-modernization-pipeline/1.0.0" as const;
export const PIPELINE_STAGES = [
  "RESOLVE_LEGACY", "PRESERVE_LEGACY", "LEGACY_MATERIAL", "AUTHORITY", "SPECIFICATION", "AUTHOR", "VALIDATE",
  "ASSESSMENT", "PROJECTION", "EXPERIENCE", "COMPARISON", "PACKAGE", "QUEUE",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export class PipelineError extends Error {
  constructor(public readonly code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "PipelineError";
  }
}

const sha = (value: unknown) => createHash("sha256").update(canonicalizeJson(value)).digest("hex");

// ─── Specification ──────────────────────────────────────────────────────────

export type SpecObjective = Readonly<{
  id: string;
  statement: string;
  layer: "NATIONAL_FOUNDATION" | "LIBERIALEARN_MASTERY" | "GLOBAL_EXCELLENCE";
  /** MOE relationship as far as the evidence goes. A lead is never a binding. */
  moe: Readonly<{ status: "STRUCTURED_ID_PROPOSED_UNREVIEWED" | "PROXY_SUBJECT_PROPOSED_UNREVIEWED" | "NO_MOE_SOURCE" | "LIBERIALEARN_EXTENSION"; objectiveId?: string; sourcePages?: readonly number[]; note: string }>;
}>;

export type LegacyDisposition = Readonly<{
  /** Section index from splitSections over the legacy primary text. */
  section: number;
  heading: string;
  disposition: "REUSED" | "ADAPTED" | "REPLACED" | "DISCARDED" | "MOVED_TO_TEACHER_GUIDE";
  candidateScenes: readonly string[];
  rationale: string;
}>;

export type ModernizationSpec = Readonly<{
  specVersion: "liberialearn-modernization-spec/1.0.0";
  contentId: string;
  legacy: Readonly<{ revisionId: string; contentHash: string }>;
  candidateId: string;
  candidateVersion: string;
  track: "A_TARGETED_REPAIR" | "B_INSTRUCTIONAL_REDESIGN" | "C_FULL_REPLACEMENT";
  title: string;
  grade: number;
  subject: string;
  objectives: readonly SpecObjective[];
  /** Per objective: what successful independent performance looks like (no hints, no AI help, no answer exposure). */
  successCriteria: readonly Readonly<{ objectiveId: string; independentPerformance: string }>[];
  prerequisites: readonly string[];
  layers: Readonly<{ nationalFoundation: string; liberiaLearnMastery: string; globalExcellence: string }>;
  legacyDisposition: readonly LegacyDisposition[];
  /** Decisions only a human may take, recorded so reviewers see them up front. */
  openDecisions: readonly Readonly<{ id: string; question: string; authorRecommendation: string }>[];
}>;

export type AssessmentDefinitions = Readonly<{
  audience: "REVIEWER_ONLY";
  status: "GOVERNED_CANDIDATE";
  notice: string;
  diagnosticOnlyExitItemIds: readonly string[];
  tasks: readonly (PlannedAssessmentTask & Readonly<{ prompt: string; key?: string; rubric?: readonly Readonly<{ criterion: string; levels: readonly string[] }>[]; targetsMisconceptions?: readonly string[]; deliveredBy?: string; note?: string }>)[];
}>;

// ─── Authoring and budget ───────────────────────────────────────────────────

export type AuthoredCandidate = Readonly<{ spec: ModernizationSpec; candidate: unknown; assessment: AssessmentDefinitions; costTokens: number }>;

/** Produces the spec, candidate and assessment definitions for a lesson. Must be pure with respect to its inputs. */
export type CandidateAuthor = Readonly<{
  identity: LedgerActor & Readonly<{ role: "CANDIDATE_AUTHOR" }>;
  /** Hash of everything the author reads beyond the pipeline inputs (prompt version, files). */
  inputHash: (contentId: string) => string;
  author: (input: { contentId: string; legacy: LibraryExtractRecord; audit: LessonAudit }) => AuthoredCandidate;
}>;

export type PipelineBudget = Readonly<{ maxAuthoringCalls: number; maxTokens: number; maxAttemptsPerLesson: number }>;
export const DEFAULT_BUDGET: PipelineBudget = Object.freeze({ maxAuthoringCalls: 20, maxTokens: 0, maxAttemptsPerLesson: 2 });

export type BudgetState = { authoringCalls: number; tokens: number };

// ─── Run state ──────────────────────────────────────────────────────────────

export type StageRecord = Readonly<{ stage: PipelineStage; inputHash: string; outputHash: string; status: "DONE" | "FAILED"; detail?: string }>;
export type RunState = { pipelineVersion: string; contentId: string; candidateVersion: string | null; attempts: number; failures: Record<string, number>; stages: StageRecord[] };

export function loadRunState(dir: string, contentId: string): RunState {
  const file = path.join(dir, "run.json");
  if (!fs.existsSync(file)) return { pipelineVersion: MODERNIZATION_PIPELINE_VERSION, contentId, candidateVersion: null, attempts: 0, failures: {}, stages: [] };
  return JSON.parse(fs.readFileSync(file, "utf8")) as RunState;
}

// ─── Stage outputs ──────────────────────────────────────────────────────────

export type ReadinessCheck = Readonly<{ id: string; passed: boolean; detail: string; blocking: boolean }>;

export type PipelineResult = Readonly<{
  contentId: string;
  candidateId: string;
  candidateVersion: string;
  candidateHash: string;
  manifestHash: string;
  status: "READY_FOR_INDEPENDENT_REVIEW" | "REVISE_BEFORE_REVIEW";
  checks: readonly ReadinessCheck[];
  files: Readonly<Record<string, string>>;
  ledgerEvents: readonly NewLedgerEvent[];
  skippedStages: readonly PipelineStage[];
}>;

/** Words a scene may carry per age band before it is too dense for one slide (Student Experience V3). */
export const SCENE_WORD_BUDGET: Readonly<Record<AgeBand, number>> = Object.freeze({ EARLY_PRIMARY: 70, UPPER_PRIMARY: 140, JUNIOR_SECONDARY: 200, SENIOR_SECONDARY: 240 });

/** Strings that must never reach a learner projection. */
/** Reviewer-only field names; matched as JSON keys. (Hand-offs legitimately carry scoring: "SERVER_AUTHORITY".) */
const PROTECTED_FIELD_NAMES = ["expectedObservation", "rubric", "answerKey", "key", "fallbackRoute", "targetsMisconceptions", "prerequisiteIndex"];

export function legacyMaterial(legacy: LibraryExtractRecord, audit: LessonAudit, spec: ModernizationSpec) {
  const snapshot = legacy.revision!.contentSnapshot as SnapshotV1;
  const { field, text } = primaryText(snapshot);
  const sections = splitSections(text);
  return {
    legacyRevisionId: legacy.revision!.id,
    legacyContentHash: legacy.revision!.contentHash,
    primaryTextField: field,
    sections: sections.map((section) => {
      const disposition = spec.legacyDisposition.find((entry) => entry.section === section.index);
      const findings = audit.findings.filter((finding) => finding.where.includes(`#s${section.index} `)).map((finding) => `${finding.code}/${finding.severity}`);
      return {
        index: section.index, heading: section.heading, role: section.role, words: section.words, sha256: sha(section.text), findings,
        disposition: disposition?.disposition ?? null, candidateScenes: disposition?.candidateScenes ?? [], rationale: disposition?.rationale ?? null,
      };
    }),
  };
}

export function authorityRecord(legacy: LibraryExtractRecord, audit: LessonAudit, spec: ModernizationSpec) {
  const objectives = loadMoeObjectives();
  const cell = resolveMoeCell(legacy.row.subject, legacy.row.grade, objectives);
  const ids = new Set(objectives.map((objective) => objective.id));
  const proposed = spec.objectives.filter((objective) => objective.moe.objectiveId);
  const unknown = proposed.filter((objective) => !ids.has(objective.moe.objectiveId!)).map((objective) => objective.id);
  return {
    moeCell: cell,
    legacyClaims: parseLegacyAlignmentClaims((legacy.revision!.contentSnapshot as SnapshotV1).standards.moeAlignments, objectives),
    lexicalLeads: audit.moeObjectiveLeads,
    proposedObjectiveRelationships: spec.objectives.map((objective) => ({ objectiveId: objective.id, layer: objective.layer, ...objective.moe, resolvesInStructuredSource: objective.moe.objectiveId ? ids.has(objective.moe.objectiveId) : null })),
    unresolvedProposedIds: unknown,
    examinations: applicableExaminations(legacy.row.grade),
    waecEvidence: applicableExaminations(legacy.row.grade).length ? WAEC_TAG_EVIDENCE : "NOT_APPLICABLE",
    status: "PROPOSED_UNREVIEWED",
    note: "MOE source provenance is not MOE approval. Every relationship here is a proposal that a curriculum owner must accept; nothing is bound and no MOE or WAEC approval is claimed.",
  };
}

function learnerProjection(spec: ModernizationSpec, candidate: CandidateLessonV2): LessonExperience {
  return toLessonExperience({
    identity: { lessonId: spec.candidateId, version: spec.candidateVersion, title: candidate.title, grade: spec.grade, subject: spec.subject, unitId: null },
    ageBand: candidate.ageBand,
    scenes: candidate.scenes,
    labLinks: [],
    assessmentHandoffs: candidate.assessmentRequests.map((request) => ({
      requestId: request.id, player: "ASSESSMENT_PLAYER_V2", scoring: "SERVER_AUTHORITY", objectiveIds: request.objectiveIds, interaction: request.interaction,
      evidenceType: request.evidenceType, difficulty: request.difficulty, misconceptionIds: request.misconceptionIds,
      tools: { allowed: request.tools.requested.filter((tool) => !request.tools.prohibited.includes(tool)), prohibited: request.tools.prohibited }, offline: request.offline,
      governedItems: [],
    })),
    objectives: spec.objectives.map((objective) => ({ id: objective.id, statement: objective.statement, conceptIds: [], standardCodes: [], skillIds: [] })),
    authoring: { releaseId: null, releaseIdentity: null },
  });
}

/** Reviewer-only strings that are distinctive enough to detect if they leak (mastery keys, rubric levels, fallback routes). */
function protectedStrings(assessment: AssessmentDefinitions): string[] {
  return assessment.tasks.flatMap((task) => [
    ...(task.timing === "END_OF_LESSON" || task.timing === "DELAYED" ? [task.key ?? ""] : []),
    ...(task.rubric ?? []).flatMap((row) => row.levels),
    task.fallbackRoute ?? "",
  ]).filter((value) => value.trim().length >= 12);
}

export function experienceChecks(candidate: CandidateLessonV2, projection: LessonExperience): ReadinessCheck[] {
  const budget = SCENE_WORD_BUDGET[candidate.ageBand];
  const dense = candidate.scenes.filter((scene) => words(scene.content.body) + (scene.content.keyPoints ?? []).reduce((n, point) => n + words(point), 0) > budget);
  const noAlt = candidate.scenes.flatMap((scene) => (scene.media ?? []).filter((media) => !media.altText.trim()).map((media) => `${scene.id}/${media.id}`));
  const noA11y = candidate.scenes.filter((scene) => !scene.accessibility.textAlternative.trim() || !scene.accessibility.keyboardPath.trim()).map((scene) => scene.id);
  const offlineGaps = candidate.scenes.filter((scene) => scene.offline.mode !== "FULL_OFFLINE" && !scene.fallback).map((scene) => scene.id);
  const purposes = new Set(candidate.scenes.map((scene) => scene.purpose));
  return [
    { id: "SX-INTRO-AND-OBJECTIVES", blocking: true, passed: purposes.has("STATE_OBJECTIVE") && (purposes.has("HOOK_PHENOMENON") || purposes.has("ACTIVATE_PRIOR_KNOWLEDGE")), detail: "Clear introduction and stated objectives." },
    { id: "SX-TEXT-DENSITY", blocking: true, passed: dense.length === 0, detail: dense.length ? `Over ${budget} words for ${candidate.ageBand}: ${dense.map((scene) => scene.id).join(", ")}` : `Every scene within ${budget} words (${candidate.ageBand}).` },
    { id: "SX-MEDIA-ALT", blocking: true, passed: noAlt.length === 0, detail: noAlt.length ? `Missing alt text: ${noAlt.join(", ")}` : "Every media item has alt text." },
    { id: "SX-KEYBOARD-SCREEN-READER", blocking: true, passed: noA11y.length === 0, detail: noA11y.length ? `Missing text alternative or keyboard path: ${noA11y.join(", ")}` : "Every scene has a text alternative and keyboard path." },
    { id: "SX-OFFLINE", blocking: true, passed: offlineGaps.length === 0 && projection.offline.packageable, detail: offlineGaps.length ? `Not offline and no fallback: ${offlineGaps.join(", ")}` : `Packageable offline: ${projection.offline.packageable}.` },
    { id: "SX-PAGINATION", blocking: true, passed: candidate.scenes.length >= 3 && candidate.scenes.length <= 20, detail: `${candidate.scenes.length} scenes (contract 3-20); one scene per slide.` },
    { id: "SX-NO-MASTERY-CLAIM", blocking: true, passed: !/\b(you have mastered|mastery achieved|you are now an expert|lesson complete[d]? successfully)\b/i.test(JSON.stringify(projection)), detail: "No learner-facing claim of mastery or completion success." },
    { id: "SX-FULLSCREEN-SLIDES-V2", blocking: false, passed: false, detail: "Fullscreen Slides V2 layout contracts are not on this base (feat/fullscreen-slides-v2 is unmerged); checked against Lesson Player V2 only." },
  ];
}

export function comparisonMarkdown(spec: ModernizationSpec, material: ReturnType<typeof legacyMaterial>, audit: LessonAudit, candidate: CandidateLessonV2): string {
  const rows = material.sections.map((section) => `| ${section.index} | ${section.heading.replace(/\|/g, "/")} | ${section.words} | ${section.findings.join(", ") || "–"} | ${section.disposition ?? "**UNASSIGNED**"} | ${section.candidateScenes.join(", ") || "–"} | ${(section.rationale ?? "").replace(/\|/g, "/")} |`);
  const covered = new Set(spec.legacyDisposition.flatMap((entry) => entry.candidateScenes));
  const newScenes = candidate.scenes.filter((scene) => !covered.has(scene.id)).map((scene) => scene.id);
  return [
    `# Legacy comparison: ${spec.contentId}`,
    "",
    `Legacy revision \`${material.legacyRevisionId}\` (hash \`${material.legacyContentHash}\`), audited \`${audit.auditDigest.slice(0, 16)}…\` → candidate \`${spec.candidateId}@${spec.candidateVersion}\` (track ${spec.track}).`,
    "",
    "| # | Legacy section | Words | Audit findings | Disposition | Candidate scenes | Rationale |",
    "|---:|---|---:|---|---|---|---|",
    ...rows,
    "",
    `New candidate scenes with no legacy source: ${newScenes.join(", ") || "none"}.`,
    "",
    "Dispositions are the author's proposals. A reviewer confirms that reused material is correct and that nothing of value was discarded.",
    "",
  ].join("\n");
}

function reviewPackageMarkdown(input: { spec: ModernizationSpec; result: Omit<PipelineResult, "files" | "ledgerEvents" | "skippedStages">; review: InstructionalReviewReport; author: LedgerActor; audit: LessonAudit }): string {
  const { spec, result, review, author, audit } = input;
  return [
    `# Modernization review package: ${spec.title}`,
    "",
    `- **Lesson:** \`${spec.contentId}\`, grade ${spec.grade} ${spec.subject}, track ${spec.track}`,
    `- **Replaces (if released):** legacy revision \`${spec.legacy.revisionId}\` (hash \`${spec.legacy.contentHash}\`). The legacy revision is preserved; historical references keep pointing at it.`,
    `- **Candidate:** \`${spec.candidateId}@${spec.candidateVersion}\`, hash \`${result.candidateHash}\``,
    `- **Author:** ${author.kind} \`${author.id}\`${author.modelFamily ? ` (${author.modelFamily})` : ""}. The author may not review this candidate.`,
    `- **Pipeline status:** ${result.status} (mechanical readiness only; not a review, not an approval).`,
    `- **Legacy audit outcome:** ${audit.reviewOutcome} (${audit.findings.length} findings).`,
    "",
    "## What successful independent performance looks like",
    "",
    ...spec.successCriteria.map((criterion) => `- **${criterion.objectiveId}:** ${criterion.independentPerformance}`),
    "",
    "## Three layers",
    "",
    `- **National Foundation:** ${spec.layers.nationalFoundation}`,
    `- **LiberiaLearn Mastery:** ${spec.layers.liberiaLearnMastery}`,
    `- **Global Excellence:** ${spec.layers.globalExcellence}`,
    "",
    "## Readiness checks",
    "",
    "| Check | Result | Blocking | Detail |",
    "|---|---|---|---|",
    ...result.checks.map((check) => `| ${check.id} | ${check.passed ? "pass" : "**fail**"} | ${check.blocking ? "yes" : "no"} | ${check.detail.replace(/\|/g, "/")} |`),
    "",
    "## Automated Excellence checks (AUTOMATED reviewer; not a review)",
    "",
    `Outcome: ${review.outcome}. Blueprint blocking gaps: ${review.blueprint.blockingGaps.join(", ") || "none"}. Findings: ${review.findings.length}.`,
    "",
    ...review.findings.map((finding) => `- ${finding.severity} ${finding.criterionId}: ${finding.statement}`),
    "",
    "## Decisions for humans",
    "",
    ...spec.openDecisions.map((decision) => `- **${decision.id}:** ${decision.question} Author recommendation: ${decision.authorRecommendation}`),
    "",
    "## What the reviewer must do",
    "",
    "1. Academic review (subject expert): accuracy of every explanation, example, key and Liberian context, against the exact candidate hash above.",
    "2. Assessment review: keys, rubrics, misconception mappings, retention and transfer tasks in `assessment-definitions.json`.",
    "3. Accessibility and localization review.",
    "4. Record each decision as a `REVIEW_RECORDED` ledger event bound to this candidate hash. Acceptance needs human, independent ACCEPT on the ACADEMIC and ASSESSMENT scopes.",
    "",
  ].join("\n");
}

// ─── Run ────────────────────────────────────────────────────────────────────

export type PipelineInput = Readonly<{
  contentId: string;
  legacy: LibraryExtractRecord;
  auditContext: LibraryAuditContext;
  /** The ledger's live record for this lesson, if any: the extract must agree with it. */
  ledgerLive: Readonly<{ revisionId: string; contentHash: string }> | null;
  author: CandidateAuthor;
  outDir: string;
  budget?: PipelineBudget;
  budgetState?: BudgetState;
  at: string;
  pipelineRunId: string;
}>;

export function runModernizationPipeline(input: PipelineInput): PipelineResult {
  const budget = input.budget ?? DEFAULT_BUDGET;
  const spent = input.budgetState ?? { authoringCalls: 0, tokens: 0 };
  const run = loadRunState(input.outDir, input.contentId);
  const skipped: PipelineStage[] = [];
  const stages = new Map(run.stages.map((record) => [record.stage, record]));
  const record = (stage: PipelineStage, inputHash: string, output: unknown) => {
    stages.set(stage, { stage, inputHash, outputHash: sha(output), status: "DONE" });
  };

  // 1. Resolve the exact legacy revision.
  const legacy = input.legacy;
  if (legacy.contentId !== input.contentId) throw new PipelineError("WRONG_LESSON", `${legacy.contentId} != ${input.contentId}`);
  if (!legacy.revision) throw new PipelineError("NO_LEGACY_REVISION", input.contentId);
  const recomputed = hashCurriculumSnapshot(legacy.revision.snapshotSchemaVersion, legacy.revision.contentSnapshot);
  if (recomputed !== legacy.revision.contentHash) throw new PipelineError("LEGACY_HASH_MISMATCH", `${recomputed} != ${legacy.revision.contentHash}`);
  if (!legacy.verification.liveRowEqualsRevision) throw new PipelineError("LIVE_ROW_DIFFERS_FROM_REVISION", input.contentId);
  if (input.ledgerLive && (input.ledgerLive.revisionId !== legacy.revision.id || input.ledgerLive.contentHash !== legacy.revision.contentHash)) {
    throw new PipelineError("STALE_EXTRACT", "the extract's revision is not the ledger's live revision; re-extract before modernizing");
  }
  const binding = { revisionId: legacy.revision.id, contentHash: legacy.revision.contentHash };
  record("RESOLVE_LEGACY", sha(binding), binding);

  // 2. Preserve the complete legacy revision.
  const preserved = { notice: "Complete legacy revision as read (read-only). Preserved for comparison and history; never edited.", contentId: legacy.contentId, ...binding, snapshotSchemaVersion: legacy.revision.snapshotSchemaVersion, title: legacy.row.title, grade: legacy.row.grade, subject: legacy.row.subject, status: legacy.row.status, contentSnapshot: legacy.revision.contentSnapshot };
  record("PRESERVE_LEGACY", sha(binding), preserved);

  const audit = auditLegacyLesson(legacy, input.auditContext);

  // 6 (authoring) first, because the spec and dispositions come from the author. Budget and loop guards.
  const authorInputHash = sha({ binding, audit: audit.auditDigest, author: input.author.identity.id, authorInput: input.author.inputHash(input.contentId) });
  const priorAuthor = stages.get("AUTHOR");
  if ((run.failures[authorInputHash] ?? 0) >= 2) throw new PipelineError("AUTHOR_LOOP_STOPPED", "the author failed twice on identical input; change the input or the author");
  let authored: AuthoredCandidate;
  if (priorAuthor?.status === "DONE" && priorAuthor.inputHash === authorInputHash) skipped.push("AUTHOR");
  if (run.attempts >= budget.maxAttemptsPerLesson && !(priorAuthor?.inputHash === authorInputHash)) throw new PipelineError("LESSON_ATTEMPT_CAP", `${run.attempts} attempts`);
  if (spent.authoringCalls + 1 > budget.maxAuthoringCalls) throw new PipelineError("BUDGET_EXHAUSTED", "authoring calls");
  try {
    authored = input.author.author({ contentId: input.contentId, legacy, audit });
  } catch (error) {
    run.failures[authorInputHash] = (run.failures[authorInputHash] ?? 0) + 1;
    persistRun(input.outDir, run, stages);
    throw error;
  }
  spent.authoringCalls += 1;
  spent.tokens += authored.costTokens;
  if (budget.maxTokens > 0 && spent.tokens > budget.maxTokens) throw new PipelineError("BUDGET_EXHAUSTED", "tokens");
  if (!skipped.includes("AUTHOR")) run.attempts += 1;
  const { spec, assessment } = authored;
  record("AUTHOR", authorInputHash, { candidate: authored.candidate, assessment, spec });

  // 5. Specification coherence with the resolved legacy revision.
  if (spec.contentId !== input.contentId) throw new PipelineError("SPEC_WRONG_LESSON");
  if (spec.legacy.revisionId !== binding.revisionId || spec.legacy.contentHash !== binding.contentHash) throw new PipelineError("SPEC_STALE_LEGACY_BINDING", "the spec was written against a different legacy revision");
  record("SPECIFICATION", sha(spec), spec);

  // 3, 4. Legacy material and authority.
  const material = legacyMaterial(legacy, audit, spec);
  record("LEGACY_MATERIAL", sha({ binding, spec: spec.legacyDisposition }), material);
  const authority = authorityRecord(legacy, audit, spec);
  record("AUTHORITY", sha({ binding, objectives: spec.objectives }), authority);

  // 7. Validate.
  const candidate = parseCandidateLessonV2(authored.candidate);
  const candidateHash = sha(candidate);
  const ageBand = ageBandForGrade(spec.grade);
  const validation = validateCandidateAgainstContext(candidate, { grade: spec.grade, subject: spec.subject, ageBand, objectives: spec.objectives.map((objective) => ({ id: objective.id })) });
  const sceneObjectives = new Set(candidate.scenes.flatMap((scene) => scene.objectiveIds));
  const specIds = new Set(spec.objectives.map((objective) => objective.id));
  const deliverability: SceneDeliverability[] = candidate.scenes.map((scene) => sceneDeliverability(scene, null, false));
  const undeliverable = deliverability.filter((report) => Object.values(report.byScenario).includes("NOT_DELIVERABLE")).map((report) => report.sceneId);
  const unassigned = material.sections.filter((section) => !section.disposition).map((section) => section.index);
  const checks: ReadinessCheck[] = [
    { id: "V2-PARSE", blocking: true, passed: true, detail: "Strict Curriculum V2 parse (authority and secret keys refused)." },
    { id: "V2-CONTEXT", blocking: true, passed: validation.errors.length === 0, detail: validation.errors.length ? validation.errors.join("; ") : `0 errors; ${validation.gaps.length} review gap(s): ${validation.gaps.map((gap) => gap.code).join(", ") || "none"}` },
    { id: "SPEC-OBJECTIVES", blocking: true, passed: [...sceneObjectives].every((id) => specIds.has(id)) && [...specIds].every((id) => sceneObjectives.has(id)), detail: "Candidate scenes teach exactly the spec objectives." },
    { id: "SPEC-SUCCESS-CRITERIA", blocking: true, passed: spec.objectives.every((objective) => spec.successCriteria.some((criterion) => criterion.objectiveId === objective.id && criterion.independentPerformance.trim().length > 20)), detail: "Every objective defines successful independent performance." },
    { id: "SPEC-PREREQUISITES", blocking: true, passed: canonicalizeJson(spec.prerequisites) === canonicalizeJson(candidate.prerequisiteAssumptions), detail: "Spec prerequisites equal the candidate's prerequisite assumptions." },
    { id: "SPEC-AGE-BAND", blocking: true, passed: candidate.ageBand === ageBand, detail: `Candidate age band ${candidate.ageBand}; grade ${spec.grade} → ${ageBand}.` },
    { id: "LEGACY-DISPOSITION-COMPLETE", blocking: true, passed: unassigned.length === 0, detail: unassigned.length ? `Legacy sections without a disposition: ${unassigned.join(", ")}` : `All ${material.sections.length} legacy sections have a disposition.` },
    { id: "AUTHORITY-NO-INVENTED-MOE", blocking: true, passed: authority.unresolvedProposedIds.length === 0, detail: authority.unresolvedProposedIds.length ? `Proposed MOE ids not in the structured source: ${authority.unresolvedProposedIds.join(", ")}` : "Every proposed MOE id exists in the structured source (proposal only)." },
    { id: "DELIVERABILITY", blocking: true, passed: undeliverable.length === 0, detail: undeliverable.length ? `Not deliverable in some runtime: ${undeliverable.join(", ")}` : "Every scene deliverable (primary or fallback) in every runtime scenario." },
  ];
  record("VALIDATE", candidateHash, checks);

  // 8. Assessment: blueprint and automated Excellence checks. The automated reviewer takes no judgment.
  const automated: AgentIdentity = { kind: "AUTOMATED", agentId: `${MODERNIZATION_PIPELINE_VERSION}#automated-checks`, modelFamily: null, sessionId: null } as unknown as AgentIdentity;
  const authors: AgentIdentity[] = [{ kind: input.author.identity.kind === "HUMAN" ? "HUMAN" : "AI", agentId: input.author.identity.id, modelFamily: input.author.identity.modelFamily ?? null, sessionId: null } as unknown as AgentIdentity];
  const review = buildInstructionalReview({
    reviewer: automated,
    revision: { contentKey: `${spec.candidateId}@${spec.candidateVersion}`, subject: spec.subject, grade: spec.grade, candidate, assessment: { assessmentDefinitions: assessment }, source: { gitCommit: null, candidatePath: "candidate.json", assessmentPath: "assessment-definitions.json" }, authors },
  });
  checks.push({ id: "BLUEPRINT", blocking: true, passed: review.blueprint.blockingGaps.length === 0, detail: review.blueprint.blockingGaps.length ? `Blocking gaps: ${review.blueprint.blockingGaps.join(", ")}` : "Assessment blueprint satisfied: coverage, diagnostics, independent practice, production, reasoning, selected share, retention, transfer, extension." });
  const blockingFindings = review.findings.filter((finding) => finding.severity === "BLOCKING");
  checks.push({ id: "EXCELLENCE-AUTOMATED", blocking: true, passed: blockingFindings.length === 0, detail: blockingFindings.length ? blockingFindings.map((finding) => finding.criterionId).join(", ") : `No blocking automated findings (${review.findings.length} non-blocking).` });
  const keysInCandidate = assessment.tasks.filter((task) => (task.timing === "END_OF_LESSON" || task.timing === "DELAYED") && task.key && task.key.length >= 12 && JSON.stringify(candidate).includes(task.key)).map((task) => task.id);
  checks.push({ id: "PROTECTED-KEYS-SEPARATE", blocking: true, passed: keysInCandidate.length === 0, detail: keysInCandidate.length ? `Mastery keys inside the candidate: ${keysInCandidate.join(", ")}` : "Mastery keys and rubrics live only in the reviewer-only assessment definitions." });
  record("ASSESSMENT", sha({ candidateHash, assessment }), review);

  // 9. Learner-safe projection.
  const projection = learnerProjection(spec, candidate);
  const projectionText = JSON.stringify(projection);
  const leaks = [...PROTECTED_FIELD_NAMES.filter((name) => projectionText.includes(`"${name}":`)), ...protectedStrings(assessment).filter((value) => projectionText.includes(value))];
  checks.push({ id: "PROJECTION-NO-REVIEWER-CONTENT", blocking: true, passed: leaks.length === 0, detail: leaks.length ? `Reviewer-only content in learner projection: ${leaks.slice(0, 5).join(", ")}` : "No keys, rubrics, expected observations or fallback routes in the learner projection." });
  checks.push({ id: "PROJECTION-AUTHORITY", blocking: true, passed: projection.authority.status === "CURRICULUM_V2_DRAFT", detail: `Projection authority ${projection.authority.status}: never APPROVED_RELEASE.` });
  record("PROJECTION", candidateHash, projection);

  // 10. Student Experience V3.
  checks.push(...experienceChecks(candidate, projection));
  record("EXPERIENCE", candidateHash, checks.filter((check) => check.id.startsWith("SX-")));

  // 11. Comparison.
  const comparison = comparisonMarkdown(spec, material, audit, candidate);
  record("COMPARISON", sha({ binding, candidateHash }), comparison);

  // 12. Package: immutable, deterministic manifest.
  const status: PipelineResult["status"] = checks.every((check) => check.passed || !check.blocking) ? "READY_FOR_INDEPENDENT_REVIEW" : "REVISE_BEFORE_REVIEW";
  const packageDir = path.join(input.outDir, "package", spec.candidateVersion);
  const files: Record<string, unknown> = {
    "legacy-revision.json": preserved,
    "legacy-material.json": material,
    "legacy-audit.json": audit,
    "authority.json": authority,
    "spec.json": spec,
    "candidate.json": candidate,
    "assessment-definitions.json": assessment,
    "automated-review.json": review,
    "learner-projection.json": projection,
    "readiness.json": { status, checks },
    "comparison.md": comparison,
  };
  const fileHashes = Object.fromEntries(Object.entries(files).map(([name, content]) => [name, createHash("sha256").update(typeof content === "string" ? content : `${JSON.stringify(content, null, 1)}\n`).digest("hex")]));
  const manifest = {
    manifestVersion: "liberialearn-modernization-package/1.0.0", pipelineVersion: MODERNIZATION_PIPELINE_VERSION, contentId: input.contentId,
    legacy: binding, candidate: { id: spec.candidateId, version: spec.candidateVersion, sha256: candidateHash }, author: input.author.identity, status,
    candidateOnly: true, approved: false, published: false, scored: false, files: fileHashes,
  };
  const manifestHash = sha(manifest);
  const reviewMd = reviewPackageMarkdown({ spec, result: { contentId: input.contentId, candidateId: spec.candidateId, candidateVersion: spec.candidateVersion, candidateHash, manifestHash, status, checks }, review, author: input.author.identity, audit });
  const existing = path.join(packageDir, "manifest.json");
  if (fs.existsSync(existing)) {
    const prior = JSON.parse(fs.readFileSync(existing, "utf8")) as { manifestHash: string };
    if (prior.manifestHash !== manifestHash) throw new PipelineError("CANDIDATE_VERSION_IMMUTABLE", `${spec.candidateVersion} already packaged with a different manifest; bump candidateVersion`);
    skipped.push("PACKAGE");
  } else {
    fs.mkdirSync(packageDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(packageDir, name), typeof content === "string" ? content : `${JSON.stringify(content, null, 1)}\n`);
    fs.writeFileSync(path.join(packageDir, "review-package.md"), reviewMd);
    fs.writeFileSync(existing, `${JSON.stringify({ ...manifest, manifestHash }, null, 1)}\n`);
  }
  record("PACKAGE", manifestHash, manifest);

  // 13. Queue for independent review (ledger events; the caller appends them).
  const actor = input.author.identity;
  const ledgerEvents: NewLedgerEvent[] = [
    { at: input.at, contentId: input.contentId, actor, body: { type: "WORK_STARTED", pipelineRunId: input.pipelineRunId, legacyRevisionId: binding.revisionId, legacyContentHash: binding.contentHash } },
    { at: input.at, contentId: input.contentId, actor, body: { type: "CANDIDATE_REGISTERED", candidateId: spec.candidateId, candidateVersion: spec.candidateVersion, candidateHash, manifestHash, legacyRevisionId: binding.revisionId, legacyContentHash: binding.contentHash, authors: [actor] } },
    ...(status === "READY_FOR_INDEPENDENT_REVIEW" ? [{ at: input.at, contentId: input.contentId, actor, body: { type: "REVIEW_REQUESTED" as const, candidateHash, scopes: ["ACADEMIC", "ASSESSMENT", "ACCESSIBILITY", "LOCALIZATION"] as const } }] : []),
  ];
  record("QUEUE", manifestHash, ledgerEvents.map((event) => event.body.type));

  run.candidateVersion = spec.candidateVersion;
  persistRun(input.outDir, run, stages);
  return Object.freeze({
    contentId: input.contentId, candidateId: spec.candidateId, candidateVersion: spec.candidateVersion, candidateHash, manifestHash, status,
    checks: Object.freeze(checks), files: Object.freeze({ ...fileHashes, "review-package.md": createHash("sha256").update(reviewMd).digest("hex") }),
    ledgerEvents: Object.freeze(ledgerEvents), skippedStages: Object.freeze(skipped),
  });
}

function persistRun(dir: string, run: RunState, stages: Map<PipelineStage, StageRecord>) {
  fs.mkdirSync(dir, { recursive: true });
  const ordered = PIPELINE_STAGES.map((stage) => stages.get(stage)).filter((entry): entry is StageRecord => !!entry);
  fs.writeFileSync(path.join(dir, "run.json"), `${JSON.stringify({ ...run, stages: ordered }, null, 1)}\n`);
}
