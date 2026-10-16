/**
 * Grade 7 v0.2.0 excellence gap reports.
 *
 * Runs the AI instructional reviewer over each pinned candidate revision and renders a gap report:
 * findings, blueprint coverage as-is, criterion status by layer, and the proposed (unreviewed)
 * assessment plan with a mechanical projection of what it would cover. Pure: inputs in, documents
 * out. CANDIDATE ONLY.
 */
import { EXCELLENCE_LAYERS, EXCELLENCE_RUBRIC_V1, evaluateLayerAttainment, type CriterionRating, type CriterionRatingRecord, type ExcellenceLayer, type LayerAttainment } from "./standard";
import { buildInstructionalReview, InstructionalReviewError, sha256, type AgentIdentity, type InstructionalReviewReport } from "./instructionalReviewer";
import { explainDistractor, type ErrorModel, type ItemVerification } from "./misconceptionErrorModels";
import type { BlueprintEvaluation } from "./assessmentBlueprint";
import type { G7LessonInputs, G7SourcePin, ProposedPlan } from "./g7GapReportSources";

export const G7_GAP_REPORT_VERSION = "liberialearn-g7-excellence-gap-report/1.0.0" as const;

export type CriterionStatus = Readonly<{
  criterionId: string;
  layer: ExcellenceLayer;
  blocking: boolean;
  rating: CriterionRating;
  basis: string;
}>;

/**
 * Status of every rubric criterion as far as an AI reviewer may judge it. The reviewer can find a
 * criterion unmet; it can only rate MET from a deterministic blueprint rule, and HUMAN_REQUIRED
 * criteria stay NOT_EVALUATED until a qualified human rates them.
 */
export function criterionStatuses(report: InstructionalReviewReport, blueprint: BlueprintEvaluation = report.blueprint, includeFindings = true): CriterionStatus[] {
  return EXCELLENCE_RUBRIC_V1.map((criterion) => {
    const rules = blueprint.rules.filter((rule) => rule.criterionId === criterion.id);
    const findings = includeFindings ? report.findings.filter((item) => item.criterionId === criterion.id) : [];
    let rating: CriterionRating;
    let basis: string;
    if (rules.some((rule) => !rule.met) || findings.some((item) => item.severity === "BLOCKING")) {
      rating = "NOT_MET";
      basis = [...rules.filter((rule) => !rule.met).map((rule) => rule.ruleId), ...findings.filter((item) => item.severity === "BLOCKING").map((item) => item.id)].join(", ");
    } else if (findings.length) {
      rating = "PARTIALLY_MET";
      basis = findings.map((item) => item.id).join(", ");
    } else if (criterion.check === "HUMAN_REQUIRED") {
      rating = "NOT_EVALUATED";
      basis = "Requires a qualified human reviewer.";
    } else if (rules.length && criterion.check === "DETERMINISTIC") {
      rating = "MET";
      basis = rules.map((rule) => `blueprint:${rule.ruleId}`).join(", ");
    } else {
      rating = "NOT_EVALUATED";
      basis = criterion.check === "AI_JUDGMENT_ADVISORY" ? "No AI finding; advisory judgment is not a MET rating." : "No deterministic check covers this criterion yet.";
    }
    return Object.freeze({ criterionId: criterion.id, layer: criterion.layer, blocking: criterion.blocking, rating, basis });
  });
}

function attainment(statuses: readonly CriterionStatus[]): readonly LayerAttainment[] {
  const records: CriterionRatingRecord[] = statuses.map((status) => ({
    criterionId: status.criterionId,
    rating: status.rating,
    ratedBy: status.rating === "MET" ? "DETERMINISTIC" : "AI",
    evidenceRefs: status.rating === "MET" ? status.basis.split(", ") : [],
  }));
  return evaluateLayerAttainment(records);
}

export type CorrectionCheck = Readonly<{
  kind: "OPTION_REPLACEMENT" | "REMAP";
  itemId: string;
  optionIndex: number;
  option: string;
  mapTo: string;
  expectedErrorModel: ErrorModel | null;
  producedBy: readonly ErrorModel[];
  /** null when the target misconception has no error model (judgment only). */
  consistent: boolean | null;
  note: "MECHANICAL_CHECK_OF_REVIEWER_AUTHORED_PROPOSAL_NOT_A_REVIEW";
}>;

type AssessmentItems = Readonly<{ items?: readonly Readonly<{ verification?: ItemVerification | null; item: Readonly<{ id: string; options: readonly string[] }> }>[] }>;

export function checkProposedCorrections(plan: ProposedPlan, assessment: unknown, signatures: Readonly<Record<string, ErrorModel>>): CorrectionCheck[] {
  const items = (assessment as AssessmentItems).items ?? [];
  const models: Record<string, ErrorModel> = { ...signatures, ...(plan.misconceptionCorrections.signatureAdditions ?? {}) };
  const check = (kind: CorrectionCheck["kind"], itemId: string, optionIndex: number, option: string, mapTo: string, expected: ErrorModel | null): CorrectionCheck | null => {
    const record = items.find((item) => item.item.id === itemId);
    if (!record) throw new InstructionalReviewError("PROPOSAL_ITEM_UNKNOWN", itemId);
    if (!record.verification) return null;
    const producedBy = explainDistractor(record.verification, option);
    return Object.freeze({
      kind, itemId, optionIndex, option, mapTo, expectedErrorModel: expected, producedBy: Object.freeze(producedBy),
      consistent: expected ? producedBy.includes(expected) : null,
      note: "MECHANICAL_CHECK_OF_REVIEWER_AUTHORED_PROPOSAL_NOT_A_REVIEW" as const,
    });
  };
  const out: Array<CorrectionCheck | null> = [];
  for (const replacement of plan.misconceptionCorrections.optionReplacements) {
    if (!items.find((item) => item.item.id === replacement.itemId)?.verification) throw new InstructionalReviewError("PROPOSAL_ITEM_UNVERIFIABLE", replacement.itemId);
    out.push(check("OPTION_REPLACEMENT", replacement.itemId, replacement.optionIndex, replacement.to, replacement.mapTo, replacement.expectedErrorModel));
  }
  for (const remap of plan.misconceptionCorrections.remaps) {
    if (!remap.to) continue;
    const record = items.find((item) => item.item.id === remap.itemId);
    const option = record?.item.options[remap.optionIndex];
    if (option === undefined) throw new InstructionalReviewError("PROPOSAL_OPTION_UNKNOWN", `${remap.itemId}#${remap.optionIndex}`);
    out.push(check("REMAP", remap.itemId, remap.optionIndex, option, remap.to, models[remap.to] ?? null));
  }
  return out.filter((item): item is CorrectionCheck => item !== null);
}

export type G7GapReport = Readonly<{
  reportVersion: typeof G7_GAP_REPORT_VERSION;
  lessonKey: string;
  title: string;
  subject: string;
  grade: number;
  candidateOnly: true;
  published: false;
  pullRequest: number;
  review: InstructionalReviewReport;
  criteria: Readonly<{ asIs: readonly CriterionStatus[]; blueprintIfPlanAdopted: readonly CriterionStatus[] }>;
  layers: Readonly<{ asIs: readonly LayerAttainment[] }>;
  plan: ProposedPlan | null;
  correctionChecks: readonly CorrectionCheck[];
  packageGaps: readonly string[];
  waecBaseline: G7LessonInputs["source"]["waecBaseline"];
  /** Present when an AI judgment review was attempted for this revision. */
  aiJudgmentReview?: AIJudgmentAttempt;
  /** Present when this report follows an earlier revision's report. */
  priorFindings?: readonly PriorFindingStatus[];
}>;

export type AIJudgmentAttempt = Readonly<{
  reviewer: AgentIdentity;
  status: "BLOCKED" | "RAN";
  code: string | null;
  detail: string;
  requires: "INDEPENDENT_REVIEWER";
}>;

export type PriorFindingStatus = Readonly<{
  findingId: string;
  severity: string;
  code: string;
  method: "DETERMINISTIC" | "AI_JUDGMENT";
  status: "NOT_REPRODUCED_BY_AUTOMATED_CHECKS" | "STILL_PRESENT" | "CORRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW" | "OPEN_CURRICULUM_OWNER_DECISION" | "OPEN_NOT_ADDRESSED";
  change: string;
}>;

type PriorReport = Readonly<{ review: Readonly<{ revision: Readonly<{ candidateSha256: string }>; findings: readonly Readonly<{ id: string; severity: string; code: string; method: "DETERMINISTIC" | "AI_JUDGMENT" }>[] }> }>;

/**
 * Carries the previous revision's findings forward. A deterministic finding that no longer fires is
 * NOT_REPRODUCED (mechanically), never "resolved". Every AI judgment finding needs an authored
 * disposition, and each stays pending independent review.
 */
export function carryForwardFindings(prior: PriorReport, current: InstructionalReviewReport, dispositions: G7LessonInputs["priorDispositions"]): PriorFindingStatus[] {
  const currentIds = new Set(current.findings.map((item) => item.id));
  return prior.review.findings.map((item) => {
    if (item.method === "DETERMINISTIC") {
      return Object.freeze({ findingId: item.id, severity: item.severity, code: item.code, method: item.method, status: currentIds.has(item.id) ? "STILL_PRESENT" as const : "NOT_REPRODUCED_BY_AUTOMATED_CHECKS" as const, change: currentIds.has(item.id) ? "The same deterministic check still fires on this revision." : "The deterministic check no longer fires on this revision." });
    }
    const disposition = dispositions.find((entry) => entry.findingId === item.id);
    if (!disposition) throw new InstructionalReviewError("PRIOR_FINDING_UNDISPOSED", item.id);
    return Object.freeze({ findingId: item.id, severity: item.severity, code: item.code, method: item.method, status: disposition.disposition, change: disposition.change });
  });
}

export function buildG7GapReport(pin: G7SourcePin, inputs: G7LessonInputs, priorReport: unknown = null): G7GapReport {
  const { source, candidate, assessment, judgments, plan } = inputs;
  if (plan && plan.revision.candidateSha256 !== source.expectedCandidateSha256) throw new InstructionalReviewError("PLAN_REVISION_MISMATCH", plan.planId);
  const revision = {
    contentKey: source.contentKey, subject: source.subject, grade: source.grade, candidate, assessment,
    plan: plan ? { planId: plan.planId, authors: plan.authors, tasks: plan.tasks, supersedesCandidateTaskIds: plan.supersedesCandidateTaskIds } : null,
    source: { gitCommit: pin.gitCommit, candidatePath: source.candidatePath, assessmentPath: source.assessmentPath },
    authors: pin.candidateAuthors,
    expectedCandidateSha256: source.expectedCandidateSha256,
  };
  const review = buildInstructionalReview({
    reviewer: pin.reviewer,
    revision,
    judgments,
    config: { misconceptionSignatures: source.misconceptionSignatures },
  });
  let aiJudgmentReview: AIJudgmentAttempt | undefined;
  if (pin.aiJudgmentReviewer) {
    try {
      buildInstructionalReview({ reviewer: pin.aiJudgmentReviewer, revision, config: { misconceptionSignatures: source.misconceptionSignatures } });
      aiJudgmentReview = Object.freeze({ reviewer: pin.aiJudgmentReviewer, status: "RAN" as const, code: null, detail: "Ran without judgments.", requires: "INDEPENDENT_REVIEWER" as const });
    } catch (error) {
      if (!(error instanceof InstructionalReviewError)) throw error;
      aiJudgmentReview = Object.freeze({ reviewer: pin.aiJudgmentReviewer, status: "BLOCKED" as const, code: error.code, detail: error.message, requires: "INDEPENDENT_REVIEWER" as const });
    }
  }
  const priorFindings = priorReport ? carryForwardFindings(priorReport as PriorReport, review, inputs.priorDispositions) : undefined;
  const asIs = criterionStatuses(review);
  const projected = review.projectedBlueprintWithPlan
    ? criterionStatuses(review, review.projectedBlueprintWithPlan.evaluation, false)
    : asIs;
  return Object.freeze({
    reportVersion: G7_GAP_REPORT_VERSION,
    lessonKey: source.lessonKey,
    title: candidate.title,
    subject: source.subject,
    grade: source.grade,
    candidateOnly: true as const,
    published: false as const,
    pullRequest: pin.pullRequest,
    review,
    criteria: Object.freeze({ asIs: Object.freeze(asIs), blueprintIfPlanAdopted: Object.freeze(projected) }),
    layers: Object.freeze({ asIs: attainment(asIs) }),
    plan,
    correctionChecks: Object.freeze(plan ? checkProposedCorrections(plan, assessment, source.misconceptionSignatures) : []),
    packageGaps: source.packageGaps,
    waecBaseline: source.waecBaseline,
    ...(aiJudgmentReview ? { aiJudgmentReview } : {}),
    ...(priorFindings ? { priorFindings: Object.freeze(priorFindings) } : {}),
  });
}

// ─── Markdown ──────────────────────────────────────────────────────────────

const LAYER_TITLE: Record<ExcellenceLayer, string> = {
  NATIONAL_FOUNDATION: "National Foundation",
  LIBERIALEARN_MASTERY: "LiberiaLearn Mastery",
  GLOBAL_EXCELLENCE: "Global Excellence",
};

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n+/g, " ");
const who = (identity: AgentIdentity) => `${identity.agentId} (${identity.kind}${identity.modelFamily ? `, ${identity.modelFamily}` : ""})`;

export function renderG7GapReportMarkdown(report: G7GapReport): string {
  const { review, plan } = report;
  const lines: string[] = [];
  const push = (...items: string[]) => lines.push(...items);
  const count = (severity: string) => review.findings.filter((item) => item.severity === severity).length;

  push(`# Excellence gap report: ${report.title}`, "");
  push(`Grade ${report.grade} ${report.subject} · candidate \`${review.revision.contentKey}\` · ${review.standardVersion}`, "");
  const automated = review.reviewer.kind === "AUTOMATED";
  if (automated) {
    push("> **CANDIDATE ONLY. Automated checks, not a review.** These are the deterministic checks of the Curriculum Excellence Standard (blueprint, prerequisites, misconception catalogue, distractor error models, assistance on mastery items). They approve, publish, release and certify nothing, and they claim no human qualification or MOE/WAEC approval. Approval of native curriculum requires an identified, qualified human reviewing the exact revision (`lib/curriculum/v2/governance.ts`). A design rubric is not learning evidence: a lesson succeeds only when students independently show they learned, retained and can apply it (pilot plan).", "");
    push(`> **No AI judgment review of this revision.** ${report.aiJudgmentReview ? `An AI judgment review by ${who(report.aiJudgmentReview.reviewer)} was ${report.aiJudgmentReview.status === "BLOCKED" ? `refused (\`${report.aiJudgmentReview.code}\`): that agent wrote the corrections in this revision and may not review them` : "run"}. ` : ""}Judgment criteria and every correction need an independent reviewer.`, "");
  } else {
    push("> **CANDIDATE ONLY. Advisory AI review.** Nothing here approves, publishes, releases or certifies this lesson, and nothing here claims human qualification or MOE/WAEC approval. Approval of native curriculum requires an identified, qualified human reviewing the exact revision (`lib/curriculum/v2/governance.ts`). A design rubric is not learning evidence: a lesson succeeds only when students independently show they learned, retained and can apply it (pilot plan).", "");
    push(`> **Not an independent review.** Reviewer ${who(review.reviewer)} shares a model family with the candidate's author (${review.independence.reasons.join(", ")}). It may be used as advice but does not count toward an independent-review requirement.`, "");
  }

  push("## Exact revision", "");
  push(review.revision.source.gitCommit
    ? `- Source: PR #${report.pullRequest} at commit \`${review.revision.source.gitCommit}\` (read with \`git show\`; not copied, not modified)`
    : `- Source: this tree (PR #${report.pullRequest} integration), pinned by the candidate hash below; regenerated whenever the candidate changes`);
  push(`- Candidate: \`${review.revision.source.candidatePath}\` sha256 \`${review.revision.candidateSha256}\``);
  push(`- Assessment (reviewer only): \`${review.revision.source.assessmentPath}\` sha256 \`${review.revision.assessmentSha256}\``);
  if (plan) push(`- Proposed plan: \`${plan.planId}\` sha256 \`${review.revision.planSha256}\``);
  push(`- Report sha256: \`${review.reportSha256}\` (void for any other revision; see \`assertReportMatchesRevision\`)`, "");

  push("## Summary", "");
  push(`- Reviewer outcome: **${review.outcome}** (the reviewer has no approve outcome)`);
  push(`- Findings: ${count("BLOCKING")} blocking, ${count("MAJOR")} major, ${count("MINOR")} minor (${review.findings.filter((item) => item.method === "DETERMINISTIC").length} deterministic, ${review.findings.filter((item) => item.method === "AI_JUDGMENT").length} AI judgment needing human confirmation)`);
  const share = review.blueprint.selectedResponseShareOfMastery;
  const percent = (value: number | null) => (value === null ? "n/a" : `${Math.round(value * 100)}%`);
  const projectedShare = review.projectedBlueprintWithPlan?.evaluation.selectedResponseShareOfMastery ?? null;
  if (!plan) {
    push(`- Selected response share of end-of-lesson mastery evidence: ${percent(share)}`);
    push(`- Blueprint blocking gaps: ${review.blueprint.blockingGaps.join(", ") || "none"}`);
  } else {
  push(`- Selected response share of end-of-lesson mastery evidence: ${share === null ? "n/a" : `${Math.round(share * 100)}%`} as is; ${projectedShare === null ? "n/a" : `${Math.round(projectedShare * 100)}%`} if the plan is adopted`);
  push(`- Blueprint blocking gaps as is: ${review.blueprint.blockingGaps.join(", ") || "none"}; if the plan is adopted (mechanical projection, unreviewed): ${review.projectedBlueprintWithPlan?.evaluation.blockingGaps.join(", ") || "none"}`);
  }
  push(`- Existing package gaps from PR #${report.pullRequest} (unchanged here): ${report.packageGaps.join(", ")}`, "");

  push("## Three layers", "");
  push("| Layer | Attained as is | Blocking criteria not yet met |", "| --- | --- | --- |");
  for (const layer of report.layers.asIs) push(`| ${LAYER_TITLE[layer.layer]} | ${layer.attained ? "yes" : "no"} | ${layer.unmetBlocking.join(", ")} |`);
  push("");
  if (!plan) push("Layer attainment is cumulative and design-only (`isLearningEvidence: false`). Automated checks can rate only deterministic criteria MET; judgment and HUMAN_REQUIRED criteria stay NOT_EVALUATED until an independent reviewer rates them, so no layer can be attained from this report.", "");
  else push("Layer attainment is cumulative and design-only (`isLearningEvidence: false`). HUMAN_REQUIRED criteria cannot be rated MET by this reviewer, so no layer can be attained without qualified human review. The last column re-evaluates only blueprint-checked criteria with the proposed plan added (— means the blueprint does not check that criterion); it ignores findings and is not a review of the plan.", "");
  for (const layer of EXCELLENCE_LAYERS) {
    push(`### ${LAYER_TITLE[layer]}`, "");
    if (plan) push("| Criterion | Blocking | As is | Blueprint if plan adopted | Basis |", "| --- | --- | --- | --- | --- |");
    else push("| Criterion | Blocking | Status | Basis |", "| --- | --- | --- | --- |");
    report.criteria.asIs.filter((status) => status.layer === layer).forEach((status) => {
      const covered = review.blueprint.rules.some((rule) => rule.criterionId === status.criterionId);
      const projected = covered ? report.criteria.blueprintIfPlanAdopted.find((item) => item.criterionId === status.criterionId)?.rating ?? "" : "—";
      const criterion = EXCELLENCE_RUBRIC_V1.find((item) => item.id === status.criterionId);
      push(`| \`${status.criterionId}\` ${cell(criterion?.statement ?? "")} | ${status.blocking ? "yes" : "no"} | ${status.rating}${plan ? ` | ${projected}` : ""} | ${cell(status.basis)} |`);
    });
    push("");
  }

  push("## Assessment blueprint", "");
  push(`Subject family ${review.blueprint.family}, ${review.blueprintVersion}.`, "");
  if (plan) push("| Rule | Criterion | Requirement | As is | If plan adopted |", "| --- | --- | --- | --- | --- |");
  else push("| Rule | Criterion | Requirement | Status |", "| --- | --- | --- | --- |");
  for (const rule of review.blueprint.rules) {
    const projected = review.projectedBlueprintWithPlan?.evaluation.rules.find((item) => item.ruleId === rule.ruleId);
    const state = (met: boolean | undefined, missing: readonly string[] = []) => (met ? "met" : `**not met** (${missing.join(", ")})`);
    push(`| ${rule.ruleId} | ${rule.criterionId} | ${cell(rule.requirement)} | ${state(rule.met, rule.missing)}${plan ? ` | ${projected ? state(projected.met, projected.missing) : ""}` : ""} |`);
  }
  push("");
  if (report.priorFindings) {
    push("## Findings on the previous revision", "");
    push("How every finding on the previous revision stands now. NOT_REPRODUCED means a deterministic check no longer fires; it is not a verdict that the issue is resolved. The corrections were written by an AI agent and need independent review.", "");
    push("| Finding | Severity | Method | Status | Change |", "| --- | --- | --- | --- | --- |");
    for (const item of report.priorFindings) push(`| \`${item.findingId}\` ${item.code} | ${item.severity} | ${item.method} | ${item.status} | ${cell(item.change)} |`);
    push("");
  }

  push("## Findings", "");
  if (!review.findings.length) push("No deterministic check fired. This is not a review: judgment criteria were not evaluated.", "");
  for (const item of review.findings) {
    push(`### ${item.severity} · ${item.code} · \`${item.id}\``, "");
    push(`${item.statement}`, "");
    push(`- Criterion: \`${item.criterionId}\` (${LAYER_TITLE[item.layer]}, ${item.dimension})`);
    push(`- Method: ${item.method}${item.method === "AI_JUDGMENT" ? `, confidence ${item.confidence}` : ""}${item.requiresHumanConfirmation ? ", requires human confirmation" : ""}`);
    push(`- Recommendation: ${item.recommendation}`);
    for (const ref of item.evidence) push(`- Evidence: ${ref.document} \`${ref.pointer}\`${ref.quote ? ` "${ref.quote}"` : ""} (value sha256 \`${ref.valueSha256.slice(0, 12)}…\`)`);
    push("");
  }

  if (plan) {
  push("## Proposed assessment plan (unreviewed)", "");
  push(`\`${plan.planId}\` was written by the same AI reviewer, so the reviewer may not review it (\`SELF_REVIEW_PROHIBITED\`). The coverage columns above are a mechanical projection, not a review. Keys and scoring guides are reviewer only.`, "");
  if (plan.supersedesCandidateTaskIds.length) push(`Proposes retiring: ${plan.supersedesCandidateTaskIds.map((id) => `\`${id}\``).join(", ")}. ${plan.supersedeRationale ?? ""}`, "");
  const groups: Array<[string, (kind: string) => boolean]> = [
    ["Prerequisite diagnostics", (kind) => kind === "PREREQUISITE_DIAGNOSTIC"],
    ["Reasoning and production evidence", (kind) => ["SHORT_CONSTRUCTED_RESPONSE", "EXTENDED_REASONING", "ORIGINAL_WRITING", "PERFORMANCE_TASK"].includes(kind)],
    ["Retention (delayed retrieval)", (kind) => kind === "DELAYED_RETRIEVAL"],
    ["Transfer", (kind) => kind === "TRANSFER_TASK"],
    ["Advanced extension (optional)", (kind) => kind === "EXTENSION"],
  ];
  for (const [title, match] of groups) {
    const tasks = plan.tasks.filter((task) => match(task.kind));
    if (!tasks.length) continue;
    push(`### ${title}`, "");
    for (const task of tasks) {
      const timing = task.timing === "DELAYED" ? `DELAYED ${task.delayDays} days` : task.timing;
      push(`- **\`${task.id}\`** ${task.kind} · ${timing} · scaffold ${task.scaffold} · ${task.context} context · ${task.scoring}${task.prerequisiteIndex !== undefined ? ` · prerequisite[${task.prerequisiteIndex}]` : ""} · objectives ${task.objectiveIds.map((id) => `\`${id}\``).join(", ")}`);
      push(`  - Prompt: ${task.prompt}`);
      if (task.key) push(`  - Key: ${task.key}`);
      if (task.scoringGuide) push(`  - Scoring: ${typeof task.scoringGuide === "string" ? task.scoringGuide : Object.entries(task.scoringGuide as Record<string, string>).map(([score, text]) => `${score}: ${text}`).join(" · ")}`);
      if (task.fallbackRoute) push(`  - If missing: ${task.fallbackRoute}`);
      if (task.targetsMisconceptions?.length) push(`  - Targets: ${task.targetsMisconceptions.map((id) => `\`${id}\``).join(", ")}`);
      if (task.note) push(`  - Note: ${task.note}`);
    }
    push("");
  }

  const corrections = plan.misconceptionCorrections;
  push("## Misconception-mapping corrections (proposed)", "");
  if (corrections.catalogueAdditions.length) {
    push("Catalogue additions:", "");
    for (const addition of corrections.catalogueAdditions) push(`- \`${addition.id}\` (${addition.objectiveId}): ${addition.description} Response: ${addition.response}${addition.condition ? ` Condition: ${addition.condition}` : ""}`);
    push("");
  }
  if (corrections.remaps.length) {
    push("| Item | Option | From | To | Rationale |", "| --- | --- | --- | --- | --- |");
    for (const remap of corrections.remaps) push(`| \`${remap.itemId}\` | ${remap.optionIndex} | \`${remap.from}\` | ${remap.to ? `\`${remap.to}\`` : "unmapped"} | ${cell(remap.rationale ?? "")} |`);
    push("");
  }
  for (const check of report.correctionChecks) {
    const verdict = check.consistent === null ? `no error model for \`${check.mapTo}\`, judgment only` : `${check.consistent ? "consistent" : "INCONSISTENT"} with ${check.expectedErrorModel}`;
    const what = check.kind === "OPTION_REPLACEMENT"
      ? `Replace \`${check.itemId}\` option ${check.optionIndex} with "${check.option}" mapped to \`${check.mapTo}\``
      : `Remap \`${check.itemId}\` option ${check.optionIndex} ("${check.option}") to \`${check.mapTo}\``;
    push(`- ${what}. Mechanical check: produced by ${check.producedBy.join(", ") || "no modelled error"} → ${verdict}.`);
  }
  if (report.correctionChecks.length) push("", "These mechanical checks test reviewer-authored proposals against the error models. They are not a review of the proposals.");
  for (const addition of corrections.diagnosabilityAdditions ?? []) push(`- Make \`${addition.misconceptionId}\` diagnosable through \`${addition.via}\`: ${addition.rationale}`);
  push("");
  }

  push("## National mapping kept explicit", "");
  push(`- MOE: objectives remain LiberiaLearn candidates with MOE relationships, not bindings; the open decisions are recorded in PR #${report.pullRequest} (${report.packageGaps.filter((gap) => gap.startsWith("MOE") || gap.startsWith("SCOPE")).join(", ")}). This report does not bind or rebind anything.`);
  push(`- WAEC: ${report.waecBaseline.examination}; ${report.waecBaseline.competency}; evidence specificity ${report.waecBaseline.evidenceSpecificity}. ${report.waecBaseline.note}`, "");

  push("## Required before any use", "");
  if (automated) {
    push("1. An independent reviewer (not the agent that wrote the corrections, and not its model family where possible) reviews this exact revision against the judgment and human criteria, and confirms or rejects each correction.");
    push("2. A qualified human approves or revises the candidate assessment definitions and rubric before any of them is used as mastery evidence.");
  } else {
    push("1. A qualified human confirms or rejects each AI judgment finding against this exact revision.");
    push("2. Independent review (not this reviewer, not its model family where possible) of the proposed plan and corrections.");
  }
  push(`3. The curriculum decisions already blocking the package in PR #${report.pullRequest}.`);
  push("4. Pilot measurement under the Learning outcome standard before any claim that the lesson works.", "");
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderG7IndexMarkdown(pin: G7SourcePin, reports: readonly G7GapReport[]): string {
  if (pin.gitCommit === null) {
    const n = (report: G7GapReport, severity: string) => report.review.findings.filter((item) => item.severity === severity).length;
    return [
      `# Grade 7 ${pin.revisionLabel} excellence automated checks`,
      "",
      `Generated by \`scripts/build-curriculum-excellence-g7-gap-reports.ts\` from the ${pin.revisionLabel} candidates and reviewer-only assessment reviews in this tree, pinned by the candidate hashes in [source.json](source.json). Do not edit generated files by hand; a test fails if they are stale.`,
      "",
      `**CANDIDATE ONLY. Automated checks, not a review.** The corrections in ${pin.revisionLabel} were written by an AI agent, so the AI judgment review of this revision is refused (\`SELF_REVIEW_PROHIBITED\`) and is left to an independent reviewer. Nothing here approves, publishes or releases anything.`,
      "",
      "| Lesson | Outcome | Blocking | Major | Minor | Blueprint gaps | Previous findings not reproduced | Report |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...reports.map((report) => {
        const prior = report.priorFindings ?? [];
        const gone = prior.filter((item) => item.status === "NOT_REPRODUCED_BY_AUTOMATED_CHECKS").length;
        const deterministic = prior.filter((item) => item.method === "DETERMINISTIC").length;
        return `| ${report.title} | ${report.review.outcome} | ${n(report, "BLOCKING")} | ${n(report, "MAJOR")} | ${n(report, "MINOR")} | ${report.review.blueprint.blockingGaps.join(", ") || "none"} | ${gone} of ${deterministic} deterministic | [checks](${report.lessonKey}/gap-report.md) |`;
      }),
      "",
    ].join("\n");
  }
  const lines = [
    "# Grade 7 v0.2.0 excellence gap reports",
    "",
    "Generated by `scripts/build-curriculum-excellence-g7-gap-reports.ts` from the candidates pinned in [source.json](source.json) (PR #" + pin.pullRequest + " at `" + pin.gitCommit + "`), the AI judgment submissions and the proposed assessment plans in each lesson folder. Do not edit generated files by hand; a test fails if they are stale.",
    "",
    "**CANDIDATE ONLY.** These reports are advisory AI review. They approve, publish and release nothing, and they are not independent review (same model family as the candidates' author).",
    "",
    "| Lesson | Outcome | Blocking | Major | Minor | Blueprint gaps as is | If plan adopted | Report |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...reports.map((report) => {
      const n = (severity: string) => report.review.findings.filter((item) => item.severity === severity).length;
      return `| ${report.title} | ${report.review.outcome} | ${n("BLOCKING")} | ${n("MAJOR")} | ${n("MINOR")} | ${report.review.blueprint.blockingGaps.join(", ")} | ${report.review.projectedBlueprintWithPlan?.evaluation.blockingGaps.join(", ") || "none"} | [gap report](${report.lessonKey}/gap-report.md) |`;
    }),
    "",
  ];
  return lines.join("\n");
}

export function g7ReportDigest(report: G7GapReport): string {
  return sha256(report);
}
