import fs from "fs";
import path from "path";
import { z } from "zod";
import { FIRST_TEN_BASELINE, loadFirstTenSources } from "./firstTen";
import { authoringGenerationInput, authoringInputSchema, validateAuthoringInput, type AuthoringRequirements } from "./authoringInput";
import { runPreparedReviewPackages, type BatchActors, type PreparedReviewLesson } from "./batch";
import { bytesHash } from "./batchContract";
import { digest, FACTORY_ROLES, parseBlueprint } from "./blueprint";
import { inventoryLegacy } from "./inventory";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { staticBatchExecutors } from "./staticBatch";
import { runFactory } from "./manager";
import { resolveAuthoredRuntime } from "./runtimeBindings";
import { assessmentAttribution, type StatedPrimaryObjectives } from "./assessmentAttribution";
import { FIRST_TEN_CONTRACT_PIN, misconceptionCrosswalk, retentionPolicyStatus, validateRetentionEnvelope, type AmendedFirstTenContract } from "./contractPolicy";
import { verifyFirstThreeRuntimeSources } from "./runtimeSource";

export const PARTIAL_BATCH_VERSION = "factory-authored-subset/1.0.0" as const;
const id = z.string().min(1).refine(v => v === v.trim());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const fullManifestSchema = z.object({ sourceCommit: z.string().regex(/^[a-f0-9]{40}$/), specSha256: hash, extractSha256: hash,
  lessons: z.array(z.object({ key: id, databaseId: id, contentId: id, revisionId: id, revisionNumber: z.number().int().nonnegative().default(1), snapshotSha256: hash, grade: z.number().int(), subject: id }).passthrough()).length(10),
}).passthrough();

/** Trusted source adapters feed this internal orchestration boundary; the CLI always uses pinned sources.
 * Synthetic evidence is supported for regression tests, never relabelled as real source evidence.
 */
export type AuthoringCohort = {
  manifest: unknown; requirements: AuthoringRequirements; sources: PreparedReviewLesson["source"][];
  evidence: "LOCAL_READ_ONLY_EXPORT_UNATTESTED" | "SYNTHETIC_FIXTURE";
};

export function loadPinnedAuthoringCohort(specBytes: Buffer, extractDirectory: string): AuthoringCohort {
  const sources = loadFirstTenSources(specBytes, extractDirectory);
  const report = inventoryLegacy({ schemaVersion: "factory-legacy-inventory/1.0.0", environment: "PRODUCTION_READ_ONLY_EXPORT", capturedAt: sources.manifest.capturedAt,
    queryRef: `local-read-only-extract:${sources.extractSha256}`,
    lessons: sources.lessons.map(({ source, sourceRef }) => ({ ...sourceRef, grade: source.row.grade, subject: source.row.subject, contentType: source.row.contentType,
      version: source.row.version, status: source.row.status, contentHash: source.revision.contentHash, snapshotSchemaVersion: source.revision.snapshotSchemaVersion, contentSnapshot: source.revision.contentSnapshot,
      relationshipCounts: { assignments: source.dependencies.assignments + source.dependencies.homework, submissions: source.dependencies.gradedSubmissions, learningEvents: source.dependencies.learningEvents, scheduledWork: source.dependencies.scheduledWork },
    })).map(({ snapshotSha256: _pin, ...row }) => row),
  });
  const context: AuthoringRequirements = { baselineCommit: FIRST_TEN_BASELINE.sourceCommit, lessons: sources.lessons.map(({ lesson, sourceRef }) => {
    const misconceptions = z.array(z.object({ id, description: id, probe: id, feedback: id })).parse(lesson.misconceptions);
    const media = z.array(z.object({ id, requirement: id, offlineFallback: id })).parse(lesson.visualAndInteractive);
    return { key: lesson.key, source: sourceRef, subject: lesson.subject, grade: lesson.grade, objectiveIds: lesson.objectives.map(o => o.id),
      misconceptions: misconceptions.map(m => ({ id: m.id, description: m.description, probe: m.probe, feedback: m.feedback })),
      mediaSpecifications: media.map(m => ({ id: m.id, requirement: m.requirement, offlineFallback: m.offlineFallback })),
      retention: { delayDays: lesson.retention.delayDays, items: lesson.retention.items },
      assessmentTasks: lesson.independentAssessment.endOfLesson.map(t => ({ id: t.id, objectiveIds: t.objectiveIds, kind: t.kind, scoring: t.scoring, task: t.task })),
    };
  }) };
  return { manifest: FIRST_TEN_BASELINE, requirements: context, evidence: "LOCAL_READ_ONLY_EXPORT_UNATTESTED",
    sources: report.rows.map(row => ({ ...row, capturedDependencyCounts: sources.lessons.find(l => l.sourceRef.databaseId === row.databaseId)!.source.dependencies,
      exportedVerificationClaims: sources.lessons.find(l => l.sourceRef.databaseId === row.databaseId)!.source.verification,
      relationshipCountScope: "CAPTURED_STORES_ONLY_SUBMISSIONS_ARE_GRADED_SUBMISSIONS_ONLY" })),
  };
}

/** Validate the whole fixed manifest and source set, then canonicalize the explicit subset by manifest order. */
export function planAuthoredSubset(cohort: AuthoringCohort, selectedInput: unknown) {
  const manifest = fullManifestSchema.parse(cohort.manifest);
  const selected = z.array(id).min(1).max(10).parse(selectedInput);
  if (new Set(selected).size !== selected.length) throw new Error("partial_duplicate_selected_id");
  for (const values of [manifest.lessons.map(l => l.contentId), manifest.lessons.map(l => l.databaseId), manifest.lessons.map(l => l.revisionId), cohort.sources.map(s => s.databaseId), cohort.requirements.lessons.map(l => l.source.contentId)]) {
    if (values.length !== 10 || new Set(values).size !== 10) throw new Error("partial_full_cohort_identity_invalid");
  }
  if (cohort.requirements.baselineCommit !== manifest.sourceCommit) throw new Error("partial_cohort_commit_mismatch");
  for (const lesson of manifest.lessons) {
    const expected = { databaseId: lesson.databaseId, contentId: lesson.contentId, revisionId: lesson.revisionId, revisionNumber: lesson.revisionNumber, snapshotSha256: lesson.snapshotSha256 };
    const source = cohort.sources.find(s => s.databaseId === lesson.databaseId);
    const required = cohort.requirements.lessons.find(l => l.source.contentId === lesson.contentId);
    if (!source || !required || digest("source", required.source) !== digest("source", expected) || source.contentId !== lesson.contentId || source.revisionId !== lesson.revisionId || source.revisionNumber !== lesson.revisionNumber || source.contentHash !== lesson.snapshotSha256 || source.grade !== lesson.grade || source.subject !== lesson.subject || required.grade !== lesson.grade || required.subject !== lesson.subject || source.contentType.toUpperCase() !== "LESSON" || source.gaps.length || !source.snapshotSchemaVersion || hashCurriculumSnapshot(source.snapshotSchemaVersion, source.contentSnapshot) !== lesson.snapshotSha256) throw new Error(`partial_full_cohort_source_mismatch:${lesson.contentId}`);
  }
  if (selected.some(id => !manifest.lessons.some(l => l.contentId === id))) throw new Error("partial_unknown_selected_id");
  return { manifest, cohortManifestHash: digest("factory-pinned-full-ten-manifest/1.0.0", cohort.manifest), selected: manifest.lessons.filter(l => selected.includes(l.contentId)) };
}

/** Preflight every supplied authored package before any output write. Never invoke an author or fill a gap. */
export async function processAuthoredSubset(input: {
  enabled: boolean; cohort: AuthoringCohort; selectedIds: unknown; authoringInputs: readonly Buffer[]; outputRoot: string;
  /** Pinned contract 1.0.0 plus amendments and stated primary objectives. Required for runtime-bound (real first-three) inputs. */
  contractPolicy?: { contract: AmendedFirstTenContract; statedPrimary: StatedPrimaryObjectives };
}) {
  if (input.enabled !== true) throw new Error("content_factory_ten_disabled");
  const cohort = structuredClone(input.cohort);
  const plan = planAuthoredSubset(cohort, input.selectedIds);
  const rawInputs = input.authoringInputs.map(bytes => {
    const raw = Buffer.from(bytes);
    if (!Buffer.from(raw.toString("utf8"), "utf8").equals(raw)) throw new Error("partial_input_invalid_utf8");
    return { raw, value: authoringInputSchema.parse(JSON.parse(raw.toString("utf8"))) };
  });
  if (new Set(rawInputs.map(p => p.value.source.contentId)).size !== rawInputs.length) throw new Error("partial_duplicate_authoring_package");
  if (rawInputs.length !== plan.selected.length || rawInputs.some(p => !plan.selected.some(l => l.contentId === p.value.source.contentId))) throw new Error("partial_supplied_package_set_mismatch");
  const prepared = [];
  for (const selected of plan.selected) {
    const supplied = rawInputs.find(p => p.value.source.contentId === selected.contentId)!;
    const validation = validateAuthoringInput(supplied.value, "authored", cohort.requirements);
    if (!validation.valid) throw new Error(`partial_authoring_incomplete:${selected.contentId}:${[...validation.failures, ...validation.missing].join(";")}`);
    const mediaBlockers = validation.executionBlockers.filter(code => /^(SVG_ASSET_ADAPTER_REQUIRED|GOVERNED_RUNTIME_BINDING_REQUIRED|PRIMARY_MEDIA_REQUIREMENT_REVIEW_REQUIRED):/.test(code));
    if (mediaBlockers.length) throw new Error(`partial_required_media_unresolved:${selected.contentId}:${mediaBlockers.join(";")}`);
    const blueprint = parseBlueprint(supplied.value.blueprint);
    if (plan.manifest.lessons.some(l => [l.contentId, l.databaseId, l.revisionId].includes(blueprint.blueprintId))) throw new Error("partial_candidate_reuses_source_identity");
    const source = cohort.sources.find(s => s.databaseId === selected.databaseId)!;
    const actors: Partial<BatchActors> = {};
    for (const role of FACTORY_ROLES) if (supplied.value.authors[role]) actors[role] = supplied.value.authors[role];
    const generation = authoringGenerationInput(supplied.value, cohort.requirements);
    const runtimeBinding=resolveAuthoredRuntime(supplied.value);
    const runtimeSources=runtimeBinding?verifyFirstThreeRuntimeSources():null;
    if (runtimeBinding && !input.contractPolicy) throw new Error(`partial_contract_policy_required:${selected.contentId}`);
    if (runtimeBinding?.authoredGeneration === "V0.2.1" && input.contractPolicy?.contract.designation !== "liberialearn-first-ten-modernization-contract/1.0.0+FT-A001+FT-A002") throw new Error(`partial_v021_contract_amendment_required:${selected.contentId}`);
    const attribution = assessmentAttribution(supplied.value, input.contractPolicy?.statedPrimary);
    const policy = input.contractPolicy ? {
      contractPin: FIRST_TEN_CONTRACT_PIN,
      amendments: input.contractPolicy.contract.amendments,
      misconceptionCrosswalk: misconceptionCrosswalk(input.contractPolicy.contract, supplied.value),
      retention: { envelope: validateRetentionEnvelope(supplied.value.retentionChecks, blueprint.objectives.length), policy: retentionPolicyStatus(input.contractPolicy.contract) },
    } : null;
    const generationBytes = Buffer.from(JSON.stringify(generation));
    const generationHash = bytesHash(generationBytes);
    const executors = () => staticBatchExecutors(generationBytes, generationHash);
    const checked = await runFactory({ blueprint, executors: executors(), actors, authoringOnly: true, maxAttempts: 1, appendAudit: async () => {} });
    if (checked.status !== "AWAITING_HUMAN_REVIEW" || checked.quality.failures.length) throw new Error(`partial_factory_preflight_failed:${selected.contentId}`);
    const lesson: PreparedReviewLesson = { blueprint, source,
      entry: { candidateId: blueprint.blueprintId, candidateVersion: blueprint.version, source: supplied.value.source, blueprint, assets: supplied.value.assets,
        generation: { id: `authored:${selected.contentId}`, version: blueprint.version, sha256: generationHash, sourceRef: `authoring-input:sha256:${bytesHash(supplied.raw)}` } },
    };
    const inputHash = digest(PARTIAL_BATCH_VERSION, { cohortManifestHash: plan.cohortManifestHash, specSha256: plan.manifest.specSha256, extractSha256: plan.manifest.extractSha256,
      evidence: cohort.evidence, source: supplied.value.source, sourceSnapshot: source.contentHash, authoringBytesSha256: bytesHash(supplied.raw), generationHash, runtimeBinding,runtimeSources, attribution, policy, requirements: cohort.requirements.lessons.find(l => l.source.contentId === selected.contentId) });
    prepared.push({ lesson, actors, generationBytes, executors, inputHash, raw: supplied.raw, runtimeBinding,runtimeSources, attribution, policy });
  }
  if (new Set(prepared.map(p => p.lesson.entry.candidateId)).size !== prepared.length) throw new Error("partial_duplicate_candidate_identity");
  const root = path.resolve(input.outputRoot);
  const relative = path.relative(process.cwd(), root);
  if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw new Error("partial_output_must_be_outside_repository");
  const results = await runPreparedReviewPackages({ outputRoot: path.join(root, "packages"), lessons: prepared.map(p => p.lesson), authoringOnly: true,
    context: lesson => {
      const p = prepared.find(p => p.lesson.entry.candidateId === lesson.entry.candidateId)!;
      return { actors: p.actors, inputHash: p.inputHash, generationInputBase64: p.generationBytes.toString("base64"), createExecutors: p.executors,
        evidence: { partialPipelineVersion: PARTIAL_BATCH_VERSION, cohortManifestHash: plan.cohortManifestHash, originalAuthoringInputBase64: p.raw.toString("base64"), sourceEvidence: cohort.evidence, runtimeBinding:p.runtimeBinding,runtimeSources:p.runtimeSources, assessmentAttribution:p.attribution, contractPolicy:p.policy },
        extraReleaseBlockers: ["FULL_COHORT_READINESS_NOT_EVALUATED", "SOURCE_EXPORT_NOT_PRODUCTION_ATTESTED", "FULL_DEPENDENCY_STORE_COVERAGE_NOT_CAPTURED", ...(p.runtimeBinding?["DRAFT_RUNTIME_NOT_APPROVED",...(p.runtimeBinding.derivedGeometrySha256?["CC_BY_3_IGO_ASSET_POLICY_REVIEW_PENDING"]:[])]:[]), ...p.attribution.releaseBlockers, ...(p.policy ? ["RETENTION_POLICY_INTERNAL_BASELINE_ONLY"] : ["MISCONCEPTION_CROSSWALK_NOT_EVALUATED"]), ...(cohort.evidence === "SYNTHETIC_FIXTURE" ? ["SYNTHETIC_EVIDENCE_ONLY"] : [])],
      };
    },
  });
  if (results.some(r => r.generationStatus !== "AWAITING_HUMAN_REVIEW" || r.failures.length)) throw new Error("partial_package_validation_failed");
  const selectedIds = plan.selected.map(l => l.contentId);
  const event1 = { sequence: 1, status: "SUBSET_VALIDATED", selectedIds, previousHash: null };
  const firstEvent = { ...event1, eventHash: digest(PARTIAL_BATCH_VERSION, event1) };
  const event2 = { sequence: 2, status: "DRAFT_PACKAGES_PREPARED", packageHashes: results.map(r => r.packageHash), previousHash: firstEvent.eventHash };
  const body = { schemaVersion: PARTIAL_BATCH_VERSION, cohortManifestHash: plan.cohortManifestHash, evidence: cohort.evidence,
    scope: selectedIds.length === 10 ? "FULL_COHORT_DRAFT_SUBMISSION" : "PARTIAL_DRAFT_SUBMISSION", selectedIds, suppliedCount: selectedIds.length, notStartedCount: 10 - selectedIds.length,
    state: "DRAFT", approved: false, published: false, released: false, fullCohortReady: false, readiness: "NOT_EVALUATED", statusScope: "THIS_SUBMISSION_ONLY",
    lessons: plan.manifest.lessons.map(l => {
      const p = prepared.find(p => p.lesson.source.contentId === l.contentId);
      const result = p ? results.find(r => r.candidateId === p.lesson.entry.candidateId)! : null;
      return { contentId: l.contentId, revisionId: l.revisionId, snapshotSha256: l.snapshotSha256, status: result ? "AWAITING_HUMAN_REVIEW" : "NOT_STARTED", packageHash: result?.packageHash ?? null };
    }),
    events: [firstEvent, { ...event2, eventHash: digest(PARTIAL_BATCH_VERSION, event2) }],
  };
  const receipt = { ...body, manifestHash: digest(PARTIAL_BATCH_VERSION, body) };
  const submissionHash = digest("factory-authored-submission", { cohortManifestHash: plan.cohortManifestHash, inputs: prepared.map(p => p.inputHash) });
  const directory = path.join(root, "submissions"); fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${submissionHash}.json`);
  if (fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink() || digest("receipt", JSON.parse(fs.readFileSync(file, "utf8"))) !== digest("receipt", receipt)) throw new Error("partial_submission_receipt_tampered");
  } else fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  return receipt;
}
