/**
 * Independent AI instructional reviewer (Curriculum Excellence Standard V1).
 *
 * Produces evidence-backed findings against one exact content revision. It is advisory:
 *
 *   - Every finding cites JSON pointers into the reviewed documents, and each pointer's value hash
 *     is recorded, so a finding can be re-checked and is void for any other revision.
 *   - AI judgment findings must quote the content they rely on; a quote that is not in the
 *     revision is rejected, not softened.
 *   - The reviewer never approves, publishes, certifies or claims human qualification. Its outcome
 *     can only be REVISE_BEFORE_HUMAN_REVIEW or READY_FOR_QUALIFIED_HUMAN_REVIEW, and statements
 *     that claim approval or qualification are refused.
 *   - It may not review a revision it authored (including fixes it proposed). Same-model-family
 *     review is allowed as advice but is recorded as NOT independent.
 *
 * Approval of native curriculum stays with lib/curriculum/v2/governance.ts (qualified human, exact
 * revision). This module imports no database, governance writer or release code.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import {
  CURRICULUM_EXCELLENCE_RUBRIC_VERSION, CURRICULUM_EXCELLENCE_STANDARD_VERSION, criterionById,
  type ExcellenceDimension, type ExcellenceLayer,
} from "./standard";
import {
  ASSESSMENT_BLUEPRINT_VERSION, deriveCandidateTasks, evaluateAssessmentBlueprint,
  type BlueprintEvaluation, type ExitItemRecord, type PlannedAssessmentTask,
} from "./assessmentBlueprint";
import { explainDistractor, type ErrorModel, type ItemVerification } from "./misconceptionErrorModels";

export const AI_INSTRUCTIONAL_REVIEWER_VERSION = "liberialearn-ai-instructional-reviewer/1.0.0" as const;
export const REVIEW_REPORT_VERSION = "liberialearn-instructional-review-report/1.0.0" as const;

export class InstructionalReviewError extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "InstructionalReviewError";
  }
}

export const sha256 = (value: unknown) => createHash("sha256").update(canonicalizeJson(value)).digest("hex");

// ─── Identities and independence ───────────────────────────────────────────

export type AgentIdentity = Readonly<{
  kind: "AI" | "HUMAN";
  /** Stable id of the agent or person (e.g. a session-scoped agent id). */
  agentId: string;
  /** For AI: provider/model family, used to detect correlated review. */
  modelFamily?: string | null;
  modelId?: string | null;
  sessionId?: string | null;
}>;

export type ReviewerIndependence = Readonly<{
  selfAuthored: boolean;
  independent: boolean;
  reasons: readonly string[];
  /** Only an independent review may be counted toward an independent-review requirement. */
  countsAsIndependentReview: boolean;
}>;

export function assessReviewerIndependence(reviewer: AgentIdentity, authors: readonly AgentIdentity[]): ReviewerIndependence {
  if (reviewer.kind !== "AI") throw new InstructionalReviewError("AI_REVIEWER_ONLY");
  if (authors.length === 0) throw new InstructionalReviewError("AUTHORSHIP_UNKNOWN", "a revision with unknown authorship cannot be reviewed for independence");
  const reasons: string[] = [];
  let selfAuthored = false;
  for (const author of authors) {
    if (author.agentId === reviewer.agentId) { selfAuthored = true; reasons.push(`SAME_AGENT:${author.agentId}`); }
    if (author.sessionId && reviewer.sessionId && author.sessionId === reviewer.sessionId) { selfAuthored = true; reasons.push(`SAME_SESSION:${author.sessionId}`); }
    if (author.kind === "AI" && author.modelFamily && reviewer.modelFamily && author.modelFamily === reviewer.modelFamily) {
      reasons.push(`SAME_MODEL_FAMILY:${author.modelFamily}`);
    }
  }
  const independent = reasons.length === 0;
  return Object.freeze({ selfAuthored, independent, reasons: Object.freeze(Array.from(new Set(reasons))), countsAsIndependentReview: independent });
}

// ─── Revision binding ──────────────────────────────────────────────────────

export type RevisionInput = Readonly<{
  contentKey: string;
  subject: string;
  grade: number;
  candidate: CandidateLessonV2;
  /** Reviewer-only assessment document (exit items, keys, rubric), or null. */
  assessment: unknown;
  /** Optional proposed assessment plan bound to this revision. */
  plan?: Readonly<{
    planId: string;
    authors: readonly AgentIdentity[];
    tasks: readonly PlannedAssessmentTask[];
    /** Candidate task ids (e.g. exit items) the plan proposes to retire. */
    supersedesCandidateTaskIds?: readonly string[];
  }> | null;
  source: Readonly<{ gitCommit: string | null; candidatePath: string; assessmentPath: string | null }>;
  authors: readonly AgentIdentity[];
  /** When supplied, the candidate must hash to exactly this value. */
  expectedCandidateSha256?: string;
}>;

export type RevisionBinding = Readonly<{
  contentKey: string;
  candidateSha256: string;
  assessmentSha256: string | null;
  planSha256: string | null;
  source: RevisionInput["source"];
}>;

export function bindRevision(input: RevisionInput): RevisionBinding {
  const candidateSha256 = sha256(input.candidate);
  if (input.expectedCandidateSha256 && input.expectedCandidateSha256 !== candidateSha256) {
    throw new InstructionalReviewError("REVISION_HASH_MISMATCH", `expected ${input.expectedCandidateSha256}, got ${candidateSha256}`);
  }
  return Object.freeze({
    contentKey: input.contentKey,
    candidateSha256,
    assessmentSha256: input.assessment == null ? null : sha256(input.assessment),
    planSha256: input.plan ? sha256(input.plan) : null,
    source: input.source,
  });
}

// ─── Evidence ──────────────────────────────────────────────────────────────

export type EvidenceDocument = "CANDIDATE" | "ASSESSMENT";

export type EvidenceRef = Readonly<{
  document: EvidenceDocument;
  /** RFC 6901 JSON pointer into the document. */
  pointer: string;
  /** For judgment findings: exact text from the value at `pointer`. */
  quote?: string;
  /** sha256 of the canonical value at `pointer`, filled in by the reviewer. */
  valueSha256: string;
}>;

export function resolvePointer(document: unknown, pointer: string): unknown {
  if (pointer === "") return document;
  if (!pointer.startsWith("/")) throw new InstructionalReviewError("EVIDENCE_POINTER_INVALID", pointer);
  let current: unknown = document;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (current === null || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, key)) {
      throw new InstructionalReviewError("EVIDENCE_POINTER_UNRESOLVED", pointer);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function flattenText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join("\n");
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(flattenText).join("\n");
  return "";
}

// ─── Findings ──────────────────────────────────────────────────────────────

export type FindingSeverity = "BLOCKING" | "MAJOR" | "MINOR";

export type ReviewFinding = Readonly<{
  id: string;
  code: string;
  criterionId: string;
  layer: ExcellenceLayer;
  dimension: ExcellenceDimension;
  severity: FindingSeverity;
  method: "DETERMINISTIC" | "AI_JUDGMENT";
  statement: string;
  recommendation: string;
  evidence: readonly EvidenceRef[];
  /** AI judgment confidence 0..1; deterministic findings are 1. */
  confidence: number;
  requiresHumanConfirmation: boolean;
}>;

/** What an AI model submits for a judgment finding, before the reviewer validates and hashes it. */
export type JudgmentSubmission = Readonly<{
  id: string;
  code: string;
  criterionId: string;
  severity: FindingSeverity;
  statement: string;
  recommendation: string;
  evidence: readonly Readonly<{ document: EvidenceDocument; pointer: string; quote: string }>[];
  confidence: number;
}>;

/**
 * Claims an AI reviewer may not make. The reviewer may say that human approval is required; it
 * may not say approval, certification, qualification or publication readiness has happened.
 */
const PROHIBITED_CLAIMS: readonly RegExp[] = [
  /\bI (?:hereby )?(?:approve|certify|endorse|sign off)\b/i,
  /\b(?:is|are|has been|have been|now|hereby) (?:approved|certified|endorsed|signed off)\b/i,
  /\bapproved for (?:use|release|publication|classroom|students)\b/i,
  /\b(?:MOE|Ministry|WAEC)[- ](?:approved|endorsed|certified|validated)\b/i,
  /\b(?:ready|safe|cleared) (?:for|to) (?:publication|publish|release|deploy)\b/i,
  /\bas an? (?:qualified|certified|licensed|trained) (?:teacher|educator|reviewer|examiner|subject expert)\b/i,
  /\bI am an? (?:teacher|educator|examiner|curriculum officer|subject expert)\b/i,
  /\b(?:this|the) (?:lesson|content|revision) (?:works|is effective|is successful|improves learning)\b/i,
];

export function assertNoProhibitedClaims(text: string, where: string): void {
  for (const pattern of PROHIBITED_CLAIMS) {
    if (pattern.test(text)) throw new InstructionalReviewError("PROHIBITED_CLAIM", `${where}: ${pattern.source}`);
  }
}

type Documents = Readonly<Record<EvidenceDocument, unknown>>;

function evidenceRef(documents: Documents, document: EvidenceDocument, pointer: string, quote?: string): EvidenceRef {
  const value = resolvePointer(documents[document], pointer);
  if (quote !== undefined) {
    if (!quote.trim()) throw new InstructionalReviewError("EVIDENCE_QUOTE_EMPTY", pointer);
    if (!flattenText(value).includes(quote)) throw new InstructionalReviewError("EVIDENCE_QUOTE_NOT_IN_REVISION", `${document}${pointer}`);
  }
  return Object.freeze({ document, pointer, ...(quote !== undefined ? { quote } : {}), valueSha256: sha256(value ?? null) });
}

function finding(input: Omit<ReviewFinding, "layer" | "dimension">): ReviewFinding {
  const criterion = criterionById(input.criterionId);
  assertNoProhibitedClaims(input.statement, `${input.id}.statement`);
  assertNoProhibitedClaims(input.recommendation, `${input.id}.recommendation`);
  if (input.evidence.length === 0) throw new InstructionalReviewError("FINDING_EVIDENCE_REQUIRED", input.id);
  if (input.confidence < 0 || input.confidence > 1) throw new InstructionalReviewError("FINDING_CONFIDENCE_OUT_OF_RANGE", input.id);
  return Object.freeze({ ...input, layer: criterion.layer, dimension: criterion.dimension, evidence: Object.freeze([...input.evidence]) });
}

export function validateJudgment(documents: Documents, submission: JudgmentSubmission): ReviewFinding {
  if (submission.evidence.length === 0) throw new InstructionalReviewError("FINDING_EVIDENCE_REQUIRED", submission.id);
  return finding({
    id: submission.id, code: submission.code, criterionId: submission.criterionId, severity: submission.severity,
    method: "AI_JUDGMENT", statement: submission.statement, recommendation: submission.recommendation,
    evidence: submission.evidence.map((item) => evidenceRef(documents, item.document, item.pointer, item.quote)),
    confidence: submission.confidence,
    requiresHumanConfirmation: true,
  });
}

// ─── Deterministic checks ──────────────────────────────────────────────────

type AssessmentDocument = Readonly<{
  items?: readonly Readonly<{
    objectiveId: string;
    distractorMisconceptions?: Readonly<Record<string, string>>;
    verification?: ItemVerification | null;
    item: Readonly<{ id: string; options: readonly string[]; correctIndex: number; hint?: string; workedExample?: string }>;
  }>[];
}>;

export type ReviewConfig = Readonly<{
  /** Error model each catalogued misconception names, where one exists. */
  misconceptionSignatures?: Readonly<Record<string, ErrorModel>>;
}>;

function deterministicFindings(input: RevisionInput, documents: Documents, blueprint: BlueprintEvaluation, config: ReviewConfig): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  const { candidate } = input;
  const assessment = (input.assessment ?? {}) as AssessmentDocument;
  const items = assessment.items ?? [];

  // Blueprint gaps.
  for (const rule of blueprint.rules) {
    // Prerequisite gaps are reported per prerequisite below.
    if (rule.met || rule.ruleId === "BP-PREREQUISITE-DIAGNOSTIC") continue;
    const requestIndex = candidate.assessmentRequests.length ? 0 : null;
    out.push(finding({
      id: `det-${rule.ruleId.toLowerCase()}`, code: `BLUEPRINT_${rule.ruleId.replace(/^BP-/, "").replace(/-/g, "_")}_UNMET`, criterionId: rule.criterionId,
      severity: rule.blocking ? "BLOCKING" : "MAJOR", method: "DETERMINISTIC",
      statement: `${rule.requirement} Not met: ${rule.missing.join(", ")}. ${rule.detail}`,
      recommendation: "Add the missing evidence to the lesson's assessment plan; see the gap report's proposed tasks.",
      evidence: [requestIndex === null ? evidenceRef(documents, "CANDIDATE", "/scenes") : evidenceRef(documents, "CANDIDATE", `/assessmentRequests/${requestIndex}`)],
      confidence: 1, requiresHumanConfirmation: false,
    }));
  }

  // Prerequisites that are assumed but not diagnosed.
  candidate.prerequisiteAssumptions.forEach((assumption, index) => {
    const rule = blueprint.rules.find((item) => item.ruleId === "BP-PREREQUISITE-DIAGNOSTIC");
    if (!rule?.missing.includes(`prerequisite[${index}]`)) return;
    out.push(finding({
      id: `det-prereq-${index}`, code: "PREREQUISITE_NOT_DIAGNOSED", criterionId: "NF-PRG-1", severity: "BLOCKING", method: "DETERMINISTIC",
      statement: `The lesson assumes "${assumption}" but no diagnostic task checks it or routes learners who lack it.`,
      recommendation: "Add a short diagnostic item for this prerequisite with a stated fallback route.",
      evidence: [evidenceRef(documents, "CANDIDATE", `/prerequisiteAssumptions/${index}`)], confidence: 1, requiresHumanConfirmation: false,
    }));
  });

  // Misconceptions: taught and assessed.
  const assessedMisconceptions = new Set(items.flatMap((record) => Object.values(record.distractorMisconceptions ?? {})));
  candidate.misconceptions.forEach((misconception, index) => {
    const taught = candidate.scenes.some((scene) => scene.purpose !== "ASSESS_MASTERY" && scene.misconceptionIds.includes(misconception.id));
    if (!taught) out.push(finding({
      id: `det-mc-untaught-${misconception.id}`, code: "MISCONCEPTION_NOT_TAUGHT", criterionId: "LM-CON-1", severity: "MAJOR", method: "DETERMINISTIC",
      statement: `Misconception ${misconception.id} is catalogued but no instructional scene addresses it.`,
      recommendation: "Address it in a scene or remove it from the catalogue.",
      evidence: [evidenceRef(documents, "CANDIDATE", `/misconceptions/${index}`)], confidence: 1, requiresHumanConfirmation: false,
    }));
    if (items.length && !assessedMisconceptions.has(misconception.id)) out.push(finding({
      id: `det-mc-unassessed-${misconception.id}`, code: "MISCONCEPTION_NOT_DIAGNOSABLE", criterionId: "LM-CON-1", severity: "MAJOR", method: "DETERMINISTIC",
      statement: `Misconception ${misconception.id} is catalogued but no exit-item distractor is mapped to it, so the exit evidence cannot detect it.`,
      recommendation: "Map a distractor or a constructed-response pattern to it, or record why end-of-lesson evidence need not detect it.",
      evidence: [evidenceRef(documents, "CANDIDATE", `/misconceptions/${index}`)], confidence: 1, requiresHumanConfirmation: false,
    }));
  });

  // Distractor mappings checked against error models.
  const signatures = config.misconceptionSignatures ?? {};
  items.forEach((record, itemIndex) => {
    const mapping = record.distractorMisconceptions ?? {};
    record.item.options.forEach((option, optionIndex) => {
      if (optionIndex === record.item.correctIndex) return;
      const mapped = mapping[String(optionIndex)];
      if (!mapped) {
        out.push(finding({
          id: `det-unmapped-${record.item.id}-${optionIndex}`, code: "DISTRACTOR_UNMAPPED", criterionId: "LM-CON-1", severity: "MINOR", method: "DETERMINISTIC",
          statement: `Distractor ${optionIndex} of ${record.item.id} is not mapped to any misconception, so choosing it gives no diagnostic information.`,
          recommendation: "Map it to a catalogued misconception or replace it with a distractor that represents one.",
          evidence: [evidenceRef(documents, "ASSESSMENT", `/items/${itemIndex}/item/options/${optionIndex}`)], confidence: 1, requiresHumanConfirmation: false,
        }));
        return;
      }
      const expected = signatures[mapped];
      if (!expected || !record.verification) return;
      const fits = explainDistractor(record.verification, option);
      if (fits.includes(expected)) return;
      out.push(finding({
        id: `det-mismap-${record.item.id}-${optionIndex}`, code: "MISCONCEPTION_MAPPING_INCONSISTENT", criterionId: "LM-CON-1", severity: "MAJOR", method: "DETERMINISTIC",
        statement: `Distractor ${optionIndex} ("${option}") of ${record.item.id} is mapped to ${mapped} (${expected}), but that error does not produce this option. ${fits.length ? `It is produced by: ${fits.join(", ")}.` : "No modelled error produces it."}`,
        recommendation: fits.length ? `Remap to a misconception for ${fits.join(" / ")} (add one to the catalogue if needed), or replace the distractor.` : "Replace the distractor with one a learner holding the mapped misconception would choose, or remove the mapping.",
        evidence: [
          evidenceRef(documents, "ASSESSMENT", `/items/${itemIndex}/distractorMisconceptions/${optionIndex}`),
          evidenceRef(documents, "ASSESSMENT", `/items/${itemIndex}/item/options/${optionIndex}`),
          evidenceRef(documents, "ASSESSMENT", `/items/${itemIndex}/verification`),
        ],
        confidence: 1, requiresHumanConfirmation: false,
      }));
    });
  });

  // Independence of exit evidence: assistance carried on mastery items must be withheld until after the response.
  const assisted = items.flatMap((record, itemIndex) => (record.item.hint || record.item.workedExample ? [{ record, itemIndex }] : []));
  if (assisted.length) out.push(finding({
    id: "det-mastery-assistance", code: "MASTERY_ITEMS_CARRY_ASSISTANCE", criterionId: "LM-ASM-2", severity: "MINOR", method: "DETERMINISTIC",
    statement: `${assisted.length} end-of-lesson item(s) (${assisted.map(({ record }) => record.item.id).join(", ")}) carry a hint and/or worked example; if either is shown before the response, the response is not independent evidence.`,
    recommendation: "Withhold hints and worked examples until after the scored response, and record any assistance in the governed evidence metadata.",
    evidence: assisted.map(({ itemIndex }) => evidenceRef(documents, "ASSESSMENT", `/items/${itemIndex}/item`)), confidence: 1, requiresHumanConfirmation: true,
  }));
  return out;
}

// ─── Report ────────────────────────────────────────────────────────────────

export type ReviewOutcome = "REVISE_BEFORE_HUMAN_REVIEW" | "READY_FOR_QUALIFIED_HUMAN_REVIEW";

export type InstructionalReviewReport = Readonly<{
  reportVersion: typeof REVIEW_REPORT_VERSION;
  reviewerVersion: typeof AI_INSTRUCTIONAL_REVIEWER_VERSION;
  standardVersion: typeof CURRICULUM_EXCELLENCE_STANDARD_VERSION;
  rubricVersion: typeof CURRICULUM_EXCELLENCE_RUBRIC_VERSION;
  blueprintVersion: typeof ASSESSMENT_BLUEPRINT_VERSION;
  reviewer: AgentIdentity;
  revision: RevisionBinding;
  independence: ReviewerIndependence;
  authority: "ADVISORY_ONLY";
  mayApprove: false;
  mayPublish: false;
  humanQualificationClaimed: false;
  officialApprovalClaimed: false;
  candidateOnly: true;
  outcome: ReviewOutcome;
  findings: readonly ReviewFinding[];
  blueprint: BlueprintEvaluation;
  /** Present when a plan was supplied: mechanical coverage if adopted. Not a review of the plan. */
  projectedBlueprintWithPlan: Readonly<{
    planId: string;
    planSha256: string;
    planReviewStatus: "UNREVIEWED_REQUIRES_INDEPENDENT_REVIEW";
    planAuthoredByReviewer: boolean;
    supersededCandidateTaskIds: readonly string[];
    evaluation: BlueprintEvaluation;
  }> | null;
  reportSha256: string;
}>;

export function buildInstructionalReview(input: {
  reviewer: AgentIdentity;
  revision: RevisionInput;
  judgments?: readonly JudgmentSubmission[];
  config?: ReviewConfig;
}): InstructionalReviewReport {
  const independence = assessReviewerIndependence(input.reviewer, input.revision.authors);
  if (independence.selfAuthored) throw new InstructionalReviewError("SELF_REVIEW_PROHIBITED", independence.reasons.join(", "));
  const binding = bindRevision(input.revision);
  const documents: Documents = { CANDIDATE: input.revision.candidate, ASSESSMENT: input.revision.assessment ?? null };
  const assessment = (input.revision.assessment ?? {}) as AssessmentDocument;
  const exitItems: ExitItemRecord[] = (assessment.items ?? []).map((record) => ({ objectiveId: record.objectiveId, item: record.item }));
  const objectiveIds = Array.from(new Set(input.revision.candidate.scenes.flatMap((scene) => scene.objectiveIds)));
  const candidateTasks = deriveCandidateTasks(input.revision.candidate, input.revision.subject, exitItems);
  const blueprintInput = { subject: input.revision.subject, objectiveIds, prerequisiteCount: input.revision.candidate.prerequisiteAssumptions.length };
  const blueprint = evaluateAssessmentBlueprint({ ...blueprintInput, tasks: candidateTasks });

  const findings = [
    ...deterministicFindings(input.revision, documents, blueprint, input.config ?? {}),
    ...(input.judgments ?? []).map((submission) => validateJudgment(documents, submission)),
  ];
  const ids = new Set<string>();
  for (const item of findings) {
    if (ids.has(item.id)) throw new InstructionalReviewError("FINDING_ID_DUPLICATE", item.id);
    ids.add(item.id);
  }

  const plan = input.revision.plan ?? null;
  const projectedBlueprintWithPlan = plan ? Object.freeze({
    planId: plan.planId,
    planSha256: binding.planSha256 as string,
    planReviewStatus: "UNREVIEWED_REQUIRES_INDEPENDENT_REVIEW" as const,
    planAuthoredByReviewer: assessReviewerIndependence(input.reviewer, plan.authors).selfAuthored,
    supersededCandidateTaskIds: Object.freeze([...(plan.supersedesCandidateTaskIds ?? [])]),
    evaluation: evaluateAssessmentBlueprint({
      ...blueprintInput,
      tasks: [...candidateTasks.filter((task) => !(plan.supersedesCandidateTaskIds ?? []).includes(task.id)), ...plan.tasks],
    }),
  }) : null;

  const outcome: ReviewOutcome = findings.some((item) => item.severity === "BLOCKING") ? "REVISE_BEFORE_HUMAN_REVIEW" : "READY_FOR_QUALIFIED_HUMAN_REVIEW";
  const body = {
    reportVersion: REVIEW_REPORT_VERSION, reviewerVersion: AI_INSTRUCTIONAL_REVIEWER_VERSION,
    standardVersion: CURRICULUM_EXCELLENCE_STANDARD_VERSION, rubricVersion: CURRICULUM_EXCELLENCE_RUBRIC_VERSION, blueprintVersion: ASSESSMENT_BLUEPRINT_VERSION,
    reviewer: input.reviewer, revision: binding, independence,
    authority: "ADVISORY_ONLY" as const, mayApprove: false as const, mayPublish: false as const,
    humanQualificationClaimed: false as const, officialApprovalClaimed: false as const, candidateOnly: true as const,
    outcome, findings: Object.freeze(findings), blueprint, projectedBlueprintWithPlan,
  };
  return Object.freeze({ ...body, reportSha256: sha256(body) });
}

/** A report is evidence only about the revision it was built for. */
export function assertReportMatchesRevision(report: InstructionalReviewReport, candidate: CandidateLessonV2, assessment: unknown): void {
  if (sha256(candidate) !== report.revision.candidateSha256) throw new InstructionalReviewError("REVISION_STALE", "candidate changed since review");
  const current = assessment == null ? null : sha256(assessment);
  if (current !== report.revision.assessmentSha256) throw new InstructionalReviewError("REVISION_STALE", "assessment changed since review");
  const { reportSha256, ...body } = report;
  if (sha256(body) !== reportSha256) throw new InstructionalReviewError("REPORT_TAMPERED");
}
