import { factoryLearnerProjection } from "./factoryProjection";
import { createHash } from "crypto";
import { readFileSync, lstatSync, readdirSync } from "fs";
import path from "path";
import { z } from "zod";
import pins from "@/curriculum/factory-v4/review-pins.json";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { digest, parseBlueprint } from "@/lib/content-factory/v2/blueprint";
import { artifactHash, validateArtifact, parseResourceDraft } from "@/lib/content-factory/v2/quality";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import { validateCandidateAgainstContext } from "@/lib/curriculum/v2/validate";
import { ageBandForGrade } from "@/lib/curriculum/v2/authoringContext";
import { evaluateV4Standard } from "./standard";
import { visualTeachingSidecarSchema } from "@/lib/content-factory/v4/visualTeachingBlock";
import { findV4Lesson } from "./candidates";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const hash = (value: unknown) => sha(canonicalizeJson(value));
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const files = ["blueprint.json", "candidate.json", "factory-artifact.json", "factory-receipt.json", "learner-projection.json", "paper-alternative.txt", "visual-teaching.json"];
const receiptSchema = z.object({ version: z.literal("factory-v4-generation/1.0.0"), candidateVersion: z.string(), inputsSha256: hex,
  candidates: z.array(z.object({ key: z.string(), manifest: z.string(), packageHash: hex, manifestSha256: hex })) });
const manifestSchema = z.object({ manifestVersion: z.literal("factory-v4-candidate/1.0.0"), candidateVersion: z.string(),
  contractVersion: z.literal("visual-teaching-block/4.0.0-draft.1"), key: z.string(), lessonId: z.string(), grade: z.number(), subject: z.string(),
  state: z.literal("DRAFT"), approved: z.literal(false), published: z.literal(false), released: z.literal(false), learnerDeliverable: z.literal(false), audience: z.literal("REVIEWER_ONLY"),
  generation: z.object({ executor: z.string(), modelCalls: z.number(), role: z.literal("LESSON_AUTHOR"), referenceFixtureCopied: z.literal(false) }),
  inputPins: z.object({ manifestSha256: hex }), candidateSha256: hex, learnerProjectionSha256: hex, blueprintHash: hex,
  protectedAssessment: z.object({ included: z.literal(false), canonicalMasteryMutation: z.literal(false) }),
  factoryStatus: z.string(), files: z.record(z.string(), hex), packageHash: hex, releaseBlockers: z.array(z.string()),
}).passthrough();

/** Read only pinned repository files. Never follow junctions, fetch sources, or access a database. */
function read(root: string, relative: string) {
  const base = path.resolve(root), file = path.resolve(base, relative);
  if (!file.startsWith(base + path.sep)) throw Error("factory_review_path_escape");
  for (let current = file; ; current = path.dirname(current)) {
    if (lstatSync(current).isSymbolicLink()) throw Error("factory_review_symlink");
    if (current === base) break;
  }
  const bytes = readFileSync(file), text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw Error("factory_review_invalid_utf8");
  return text;
}

export function factoryReviewSelections() {
  return pins.flatMap(pin => {
    const receipt = readFactoryReceipt(pin.candidateVersion);
    return receipt.candidates.map(entry => `factory@${pin.candidateVersion}@${entry.key}`);
  });
}

function readFactoryReceipt(version: string, root = process.cwd()) {
  const pin = pins.find(entry => entry.candidateVersion === version);
  if (!pin) throw Error("factory_review_unsupported_version");
  const bytes = read(root, `curriculum/factory-v4/drafts/${version}/generation-receipt.json`);
  if (sha(bytes) !== pin.receiptSha256) throw Error("factory_review_receipt_hash");
  const receipt = receiptSchema.parse(JSON.parse(bytes));
  if (receipt.candidateVersion !== version || new Set(receipt.candidates.map(c => c.key)).size !== receipt.candidates.length) throw Error("factory_review_receipt_identity");
  return receipt;
}

/** Fail closed. Callers may present a 404, but must never choose another source on failure. */
export function loadFactoryReview(selection: string, root = process.cwd()) {
  const match = /^factory@(4\.0\.0-draft\.[45])@([a-z0-9-]+)$/.exec(selection);
  if (!match) throw Error("factory_review_invalid_selection");
  const [, version, key] = match;
  const receipt = readFactoryReceipt(version, root), entry = receipt.candidates.find(c => c.key === key);
  const lesson = findV4Lesson(key);
  if (!entry || !lesson) throw Error("factory_review_unknown_candidate");
  const dir = `curriculum/factory-v4/drafts/${version}/${key}`;
  if (entry.manifest !== `${dir}/manifest.json`) throw Error("factory_review_manifest_path");
  const manifestBytes = read(root, entry.manifest);
  if (sha(manifestBytes) !== entry.manifestSha256) throw Error("factory_review_manifest_hash");
  const raw: unknown = JSON.parse(manifestBytes);
  const manifest = manifestSchema.parse(raw);
  const { packageHash, ...body } = z.record(z.string(), z.unknown()).parse(raw);
  if (packageHash !== entry.packageHash || digest("factory-v4-candidate/1.0.0", body) !== packageHash) throw Error("factory_review_package_hash");
  if (manifest.key !== key || manifest.candidateVersion !== version || manifest.lessonId !== lesson.lessonId || manifest.grade !== lesson.grade || manifest.subject !== lesson.subject || manifest.inputPins.manifestSha256 !== receipt.inputsSha256) throw Error("factory_review_identity");
  if (Object.keys(manifest.files).sort().join() !== files.slice().sort().join() || readdirSync(path.join(root, dir)).sort().join() !== [...files, "manifest.json"].sort().join()) throw Error("factory_review_incomplete_package");
  const contents = Object.fromEntries(files.map(name => {
    const bytes = read(root, `${dir}/${name}`);
    if (sha(bytes) !== manifest.files[name]) throw Error(`factory_review_file_hash:${name}`);
    return [name, bytes];
  }));
  const inputsPath = version === "4.0.0-draft.4" ? "curriculum/factory-v4/reference-inputs.json" : "curriculum/factory-v4/draft5-inputs.json";
  const inputs: unknown = JSON.parse(read(root, inputsPath));
  if (hash(inputs) !== receipt.inputsSha256) throw Error("factory_review_inputs_hash");
  const candidate = parseCandidateLessonV2(contents["candidate.json"]);
  if (candidate.contractVersion !== "candidate-lesson-v2/1.1.0" || hash(candidate) !== manifest.candidateSha256) throw Error("factory_review_candidate_hash");
  const sidecar = visualTeachingSidecarSchema.parse(JSON.parse(contents["visual-teaching.json"]));
  if (sidecar.candidateSha256 !== manifest.candidateSha256) throw Error("factory_review_sidecar_binding");
  // Objective text comes from the pinned sidecar, allowing honest new draft objectives without mutating reference fixtures.
  const contextLesson = { ...lesson, objectives: sidecar.objectives.map(o => {
    const original = lesson.objectives.find(x => x.id === o.id);
    if (!original) throw Error("factory_review_unknown_objective");
    return { ...original, statement: o.statement };
  }) };
  if (contextLesson.objectives.length !== lesson.objectives.length) throw Error("factory_review_incomplete_objectives");
  const context = { ...contextLesson, ageBand: ageBandForGrade(lesson.grade) };
  const academic = validateCandidateAgainstContext(candidate, context), standard = evaluateV4Standard(candidate, context);
  if (academic.errors.length || standard.problems.some(p => p.severity !== "ADVISORY")) throw Error("factory_review_invalid_instruction");
  const blueprint = parseBlueprint(JSON.parse(contents["blueprint.json"]));
  const envelope = z.strictObject({ id: z.string(), version: z.string(), payload: z.unknown(),
    contentHash: hex, blueprint: z.strictObject({ blueprintId: z.string(), version: z.string(), contentHash: hex }),
    role: z.literal("LESSON_AUTHOR"), author: z.strictObject({ kind: z.enum(["AI", "HUMAN", "AUTOMATED"]), agentId: z.string(), modelFamily: z.string().nullable().optional(), modelId: z.string().nullable().optional(), sessionId: z.string().nullable().optional() }),
    dependencies: z.array(z.strictObject({ id: z.string(), version: z.string(), contentHash: hex })),
  }).parse(JSON.parse(contents["factory-artifact.json"]));
  const artifact = { ...envelope, ...parseResourceDraft({ id: envelope.id, version: envelope.version, payload: envelope.payload }) };
  if (artifact.payload.kind !== "LESSON" || blueprint.contentHash !== manifest.blueprintHash || hash(artifact.payload.candidate) !== hash(candidate) || artifactHash(artifact) !== artifact.contentHash) throw Error("factory_review_artifact_binding");
  if (validateArtifact(blueprint, artifact).length) throw Error("factory_review_invalid_artifact");
  const factory = z.object({ status: z.string(), events: z.array(z.strictObject({ role: z.string(), status: z.string(), sequence: z.number(), attempt: z.number(), inputHash: hex, outputHashes: z.array(hex), error: z.string().nullable(), previousHash: hex.nullable(), eventHash: hex })) }).parse(JSON.parse(contents["factory-receipt.json"]));
  if (factory.status !== manifest.factoryStatus || !factory.events.some(e => e.role === "LESSON_AUTHOR" && e.status === "SUCCEEDED" && e.outputHashes.includes(artifact.contentHash))) throw Error("factory_review_missing_author_receipt");
  let previousHash: string | null = null;
  for (const [index, event] of factory.events.entries()) {
    const { eventHash, ...payload } = event;
    if (event.sequence !== index + 1 || event.previousHash !== previousHash || eventHash !== digest("factory-event/2.0.0", payload)) throw Error("factory_review_event_chain");
    previousHash = eventHash;
  }
  const slots = candidate.scenes.flatMap(scene => [
    ...(scene.teaching?.blocks ?? []).map((block, index) => ({ sceneId: scene.id, slot: "blocks", index, block })),
    ...(scene.teaching?.visual ? [{ sceneId: scene.id, slot: "visual", index: 0, block: scene.teaching.visual }] : []),
  ]);
  if (slots.length !== sidecar.blocks.length || slots.some((slot, i) => {
    const binding = sidecar.blocks[i];
    return binding.sceneId !== slot.sceneId || binding.slot !== slot.slot || binding.index !== slot.index || binding.type !== slot.block.type || binding.blockSha256 !== hash(slot.block);
  })) throw Error("factory_review_block_binding");
  const experience = factoryLearnerProjection(contextLesson, candidate, version);
  validateLessonExperience(experience);
  if (hash(experience) !== manifest.learnerProjectionSha256 || hash(JSON.parse(contents["learner-projection.json"])) !== hash(experience)) throw Error("factory_review_projection_binding");
  return { experience, candidate, standard, manifest, review: { source: "FACTORY_GENERATED" as const, candidateVersion: version, key, packageHash: entry.packageHash, candidateSha256: manifest.candidateSha256, manifestSha256: entry.manifestSha256, receiptSha256: pins.find(p => p.candidateVersion === version)!.receiptSha256 }, releaseBlockers: manifest.releaseBlockers };
}
