import fs from "fs";
import path from "path";
import { z } from "zod";
import { digest, FACTORY_ROLES, type FactoryRole } from "./blueprint";
import { runFactory } from "./manager";
import { actorSchema, BATCH_VERSION, bytesHash, prepareBatch, validateBatchMedia, type ProductionCaptureInput } from "./batchContract";
import type { FactoryExecutors } from "./types";

const summarySchema = z.strictObject({
  candidateId: z.string(), candidateVersion: z.string(), inputHash: z.string(),
  state: z.literal("DRAFT"), released: z.literal(false), approved: z.literal(false),
  reviewState: z.literal("PENDING_INDEPENDENT_REVIEW"),
  generationStatus: z.enum(["FAILED", "REVISION_REQUIRED", "AWAITING_HUMAN_REVIEW"]),
  failures: z.array(z.string()), releaseBlockers: z.array(z.string()),
});
const manifestSchema = z.strictObject({
  schemaVersion: z.literal(BATCH_VERSION), inputHash: z.string(),
  files: z.record(z.string(), z.string()), packageHash: z.string(),
});
type PreparedLesson = ReturnType<typeof prepareBatch>["lessons"][number];
export type PreparedReviewLesson = PreparedLesson;
export type BatchSummary = z.infer<typeof summarySchema>;
export type BatchActors = Record<FactoryRole, z.infer<typeof actorSchema>>;

function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

function readExisting(dir: string, inputHash: string): BatchSummary & { packageHash: string } {
  const manifestFile = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestFile)) throw new Error("batch_incomplete_attempt_requires_recovery");
  const manifest = manifestSchema.parse(JSON.parse(fs.readFileSync(manifestFile, "utf8")));
  if (manifest.inputHash !== inputHash) throw new Error("batch_candidate_version_immutable");
  const { packageHash, ...body } = manifest;
  if (packageHash !== digest("factory-batch-package", body)) throw new Error("batch_manifest_hash_mismatch");
  if (["input.json", "summary.json", "result.json", "comparison.json", "REVIEWER_PACKAGE.md"].some(file => !Object.hasOwn(manifest.files, file))) throw new Error("batch_package_required_file_missing");
  const actual = fs.readdirSync(dir).filter(f => f !== "manifest.json").sort();
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(manifest.files).sort())) throw new Error("batch_package_file_set_mismatch");
  for (const file of actual) {
    if (path.basename(file) !== file || fs.lstatSync(path.join(dir, file)).isSymbolicLink() || bytesHash(fs.readFileSync(path.join(dir, file))) !== manifest.files[file]) throw new Error("batch_package_integrity_failure");
  }
  const summary = summarySchema.parse(JSON.parse(fs.readFileSync(path.join(dir, "summary.json"), "utf8")));
  if (summary.inputHash !== inputHash) throw new Error("batch_summary_input_mismatch");
  return { ...summary, packageHash };
}

/** Local candidate sink. Exclusive reservations prevent concurrent authoring or silent crash retries.
 * Completed packages are verified and reused; interrupted attempts require evidence-led recovery.
 * There is deliberately no approval, release, DB, provider or deployment capability here.
 */
export async function runCandidateBatch(input: {
  enabled: boolean; contract: unknown; inventory: unknown; outputRoot: string;
  actors: BatchActors;
  generationInputs: Readonly<Record<string, string>>;
  productionCapture?: ProductionCaptureInput;
  createExecutors: (lesson: Readonly<PreparedLesson>) => FactoryExecutors;
}): Promise<(BatchSummary & { packageHash: string })[]> {
  if (input.enabled !== true) throw new Error("content_factory_ten_disabled");
  const prepared = freeze(prepareBatch(input.contract, input.inventory, input.productionCapture));
  const actors = Object.fromEntries(FACTORY_ROLES.map(role => [role, actorSchema.parse(input.actors[role])]));
  for (const { entry } of prepared.lessons) {
    const encoded = input.generationInputs[entry.candidateId];
    if (!encoded || Buffer.from(encoded, "base64").toString("base64") !== encoded || bytesHash(Buffer.from(encoded, "base64")) !== entry.generation.sha256) throw new Error("batch_generation_input_hash_mismatch");
  }
  const root = path.resolve(input.outputRoot);
  const relative = path.relative(process.cwd(), root);
  if (prepared.contract.evidence.kind === "ACCEPTED_READ_ONLY_EXPORT" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw new Error("production_candidate_output_must_be_outside_repository");
  fs.mkdirSync(root, { recursive: true });
  return runPreparedReviewPackages({ outputRoot: root, lessons: prepared.lessons, context: lesson => ({
    actors, inputHash: digest(BATCH_VERSION, { contract: prepared.contract, source: lesson.source, actors, pipeline: BATCH_VERSION }),
    evidence: { contract: prepared.contract }, generationInputBase64: input.generationInputs[lesson.entry.candidateId],
    createExecutors: () => input.createExecutors(lesson),
    extraReleaseBlockers: prepared.contract.evidence.kind === "SYNTHETIC" ? ["SYNTHETIC_EVIDENCE_ONLY"] : [],
  }) });
}

/** Shared immutable sink for already-preflighted inputs. Callers own cohort/source validation. */
export async function runPreparedReviewPackages(input: {
  outputRoot: string; lessons: readonly PreparedReviewLesson[]; authoringOnly?: boolean;
  context: (lesson: PreparedReviewLesson) => {
    actors: Partial<BatchActors>; inputHash: string; evidence: Record<string, unknown>;
    generationInputBase64: string; createExecutors: () => FactoryExecutors; extraReleaseBlockers: string[];
  };
}): Promise<(BatchSummary & { packageHash: string })[]> {
  const root = path.resolve(input.outputRoot);
  fs.mkdirSync(root, { recursive: true });
  const results: (BatchSummary & { packageHash: string })[] = [];
  for (const lesson of input.lessons) {
    const { entry, source, blueprint } = lesson;
    const context = input.context(lesson);
    const { actors, inputHash } = context;
    // Hash untrusted IDs so they never become filesystem paths.
    const dir = path.join(root, digest("candidate-slot", { id: entry.candidateId, version: entry.candidateVersion }));
    if (fs.existsSync(dir)) { results.push(readExisting(dir, inputHash)); continue; }
    // mkdir is the cross-process lock. A racing worker fails before invoking an author.
    fs.mkdirSync(dir);
    const write = (file: string, value: unknown) => fs.writeFileSync(path.join(dir, file), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
    write("input.json", { schemaVersion: BATCH_VERSION, inputHash, ...context.evidence, source, actors, generationInputBase64: context.generationInputBase64 });
    let rawIndex = 0;
    try {
      const supplied = context.createExecutors();
      const executors = Object.fromEntries(FACTORY_ROLES.map(role => [role, async (task: Parameters<FactoryExecutors[FactoryRole]>[0]) => {
        const drafts = await supplied[role](task);
        // Retain malformed as well as valid generator outputs for restricted review.
        write(`raw-${String(++rawIndex).padStart(3, "0")}.json`, { role, attempt: task.attempt, drafts });
        return drafts;
      }])) as FactoryExecutors;
      const result = await runFactory({ blueprint, executors, actors, maxAttempts: 1, authoringOnly: input.authoringOnly,
        appendAudit: async event => write(`event-${String(event.sequence).padStart(3, "0")}.json`, event),
        persistArtifact: async artifact => write(`artifact-${digest("artifact-id", artifact.id)}.json`, artifact),
      });
      const failures = [...result.quality.failures, ...validateBatchMedia(blueprint, entry.assets, result.artifacts)];
      for (const artifact of result.artifacts) if (artifact.version !== entry.candidateVersion) failures.push(`candidate_version_mismatch:${artifact.id}`);
      const summary: BatchSummary = {
        candidateId: entry.candidateId, candidateVersion: entry.candidateVersion, inputHash,
        state: "DRAFT", released: false, approved: false, reviewState: "PENDING_INDEPENDENT_REVIEW",
        generationStatus: result.status === "FAILED" ? "FAILED" : failures.length ? "REVISION_REQUIRED" : result.status,
        failures: [...new Set(failures)],
        releaseBlockers: [...new Set([...result.quality.releaseBlockers, "INDEPENDENT_REVIEW_NOT_PERFORMED", "SOURCE_COMPARISON_SIGNOFF_REQUIRED", "CANDIDATE_ONLY_NO_RELEASE_PATH", ...(failures.length || result.status === "FAILED" ? ["DETERMINISTIC_VALIDATION_FAILED"] : []), ...(entry.assets.length ? ["MEDIA_LICENSE_AND_ACCESSIBILITY_REVIEW_REQUIRED"] : []), ...context.extraReleaseBlockers])],
      };
      write("summary.json", summary);
      write("result.json", result);
      write("comparison.json", { source: entry.source, relationshipBaseline: source.relationshipCounts,
        disposition: "NOT_EVALUATED", sourceSnapshotPreservedIn: "input.json#/source/contentSnapshot",
        proposedMapping: blueprint.objectives,
        candidates: result.artifacts.flatMap(a => a.payload.kind === "LESSON" ? [{ resourceId: a.id, version: a.version, contentHash: a.contentHash,
          scenes: a.payload.candidate.scenes.map(s => ({ sceneId: s.id, title: s.title, objectiveIds: s.objectiveIds })),
        }] : []),
        reviewRequired: "A qualified reviewer must disposition every original section and independently check facts, mappings, keys, rubrics and accessible alternatives.",
      });
      fs.writeFileSync(path.join(dir, "REVIEWER_PACKAGE.md"), [
        `# Candidate ${entry.candidateId}@${entry.candidateVersion}`, "",
        "DRAFT. Unapproved and unreleased. Restricted reviewer package includes protected keys, rubrics and source bodies.", "",
        `Source: ${source.databaseId} / ${source.contentId} / ${source.revisionId} / ${source.contentHash}`,
        `Input: ${inputHash}`, `Generation: ${summary.generationStatus}`, "",
        "Inspect input.json for the complete preserved source, curriculum contract, blueprint, generation and media provenance.",
        "Inspect artifact files and result.json for candidate lessons, assessment items and protected rubrics. comparison.json indexes source and candidate identities for review.",
        "Raw outputs and chained event files retain generation attempts. summary.json lists deterministic failures and release blockers.",
        "Independent review has not occurred. Compare every source section, check curriculum mapping, facts, keys, media licensing, accessibility and offline delivery against this exact package hash.",
        "Record review through the existing governance owner. This factory cannot approve or release.", "",
      ].join("\n"), { flag: "wx" });
      const files = Object.fromEntries(fs.readdirSync(dir).sort().map(file => [file, bytesHash(fs.readFileSync(path.join(dir, file)))]));
      const body = { schemaVersion: BATCH_VERSION, inputHash, files };
      write("manifest.json", { ...body, packageHash: digest("factory-batch-package", body) });
      results.push(readExisting(dir, inputHash));
    } catch (error) {
      // Never remove partial evidence or call the author again after uncertain completion.
      write("failure.json", { inputHash, code: error instanceof Error ? error.message : "batch_attempt_failed", state: "DRAFT", released: false });
      throw error;
    }
  }
  return results;
}
