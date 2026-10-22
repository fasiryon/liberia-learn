import { factoryLearnerProjection } from "@/lib/curriculum/v4/factoryProjection";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { runFactory } from "../v2/manager";
import { digest } from "../v2/blueprint";
import { candidateText, v4BindingGaps, type V4Lesson } from "@/lib/curriculum/v4/candidates";
import { authorLesson, LESSON_AUTHOR_VERSION } from "./lessonAuthor";
import { VISUAL_TEACHING_CONTRACT } from "./visualTeachingBlock";
import { assertV4AnswerIsolation, buildVisualSidecar, CANDIDATE_VERSION, hash, normalizedFile, referenceBlueprint, referenceExecutors, referenceInputs,
  textHash, validateV4Draft, validateVisualSidecar, verifyReferenceInputs, V4_LESSONS } from "./generation";

const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
export const DRAFT_ROOT = `curriculum/factory-v4/drafts/${CANDIDATE_VERSION}`;

export const REFERENCE_PROFILE = { version: CANDIDATE_VERSION, executor: LESSON_AUTHOR_VERSION, author: authorLesson, inputs: referenceInputs, lessons: V4_LESSONS };
export type ReferenceProfile = Omit<typeof REFERENCE_PROFILE, "version" | "executor"> & { version: string; executor: string };

export async function buildReferenceCandidate(lesson: V4Lesson, profile: ReferenceProfile = REFERENCE_PROFILE) {
  const blueprint = referenceBlueprint(lesson, profile.inputs);
  const factory = await runFactory({ blueprint, executors: referenceExecutors(lesson, profile.author), authoringOnly: true,
    appendAudit: async () => {}, maxAttempts: 1 });
  if (factory.status === "FAILED" || factory.artifacts.length !== 1) throw new Error(`reference_factory_failed:${lesson.key}:${factory.events.at(-1)?.error}`);
  const payload = factory.artifacts[0].payload;
  if (payload.kind !== "LESSON") throw new Error("lesson_author_output_required");
  const { candidate, academic, standard } = validateV4Draft(payload.candidate, lesson);
  if (hash(candidate) === hash(JSON.parse(candidateText(lesson)))) throw new Error("reference_fixture_substituted_for_generation");
  const sidecar = validateVisualSidecar(buildVisualSidecar(lesson, candidate, profile.inputs), lesson, candidate, profile.inputs);
  assertV4AnswerIsolation(candidate, sidecar, { items: [], specs: [] });
  const projection = factoryLearnerProjection(lesson, candidate, profile.version);
  const releaseBlockers = [...new Set([...v4BindingGaps(lesson).map(g => g.code), ...academic.gaps.filter(g => g.severity === "BLOCKING").map(g => g.code),
    ...factory.quality.failures, ...factory.quality.releaseBlockers, "ASSESSMENT_ITEMS_PENDING", "RESTRICTED_KEY_COMPARISON_PENDING", "FRONTEND_GENERATED_PACKAGE_CONSUMPTION_QA_PENDING"])];
  const files: Record<string, string> = {
    "candidate.json": json(candidate), "visual-teaching.json": json(sidecar), "blueprint.json": json(blueprint),
    "factory-artifact.json": json(factory.artifacts[0]),
    "learner-projection.json": json(projection),
    "factory-receipt.json": json({ status: factory.status, events: factory.events, quality: factory.quality }),
    "paper-alternative.txt": sidecar.blocks.map(b => `${b.sceneId}/${b.slot}/${b.index}\n${b.accessibility.textAlternative}\n${b.offline.responsePrompt}`).join("\n\n") + "\n",
  };
  const manifestBody = {
    manifestVersion: "factory-v4-candidate/1.0.0", candidateVersion: profile.version, contractVersion: VISUAL_TEACHING_CONTRACT,
    key: lesson.key, lessonId: lesson.lessonId, grade: lesson.grade, subject: lesson.subject, title: candidate.title,
    state: "DRAFT", approved: false, published: false, released: false, learnerDeliverable: false, audience: "REVIEWER_ONLY",
    contentOrigin: "DETERMINISTIC_FACTORY_EXECUTOR_WITH_SYNTHETIC_TEACHING_CONTEXTS",
    generation: { executor: profile.executor, role: "LESSON_AUTHOR", referenceFixtureCopied: false, modelCalls: 0 },
    sourceLineage: lesson.source, sourceVerification: "REPOSITORY_PINS_VERIFIED_REMOTE_RIGHTS_AND_LEGACY_BODY_NOT_ATTESTED",
    inputPins: { manifestSha256: hash(profile.inputs), frontendCommit: profile.inputs.frontendCommit,
      candidate: profile.inputs.candidates.find(p => p.path.endsWith(`/${lesson.file}`)) },
    candidateSha256: hash(candidate), blueprintHash: blueprint.contentHash,
    learnerProjectionSha256: hash(projection),
    academicSchema: { valid: true, errors: academic.errors },
    visualInstruction: { valid: true, family: standard.family, balance: standard.balance, practice: standard.practice,
      totals: standard.totals, advisories: standard.problems.filter(p => p.severity === "ADVISORY") },
    accessibility: { schema: "PASS", blockBindings: sidecar.blocks.length, manualScreenReaderReview: "PENDING" },
    offline: { mode: "TEXT_PAPER_CAPTURE_ONLY", protectedKeysCached: false, runtimeColdStartAndReconnect: "PENDING" },
    protectedAssessment: { included: false, restrictedKeyComparison: "PENDING_AUTHORIZED_OWNER_INPUT", canonicalMasteryMutation: false },
    factoryStatus: factory.status, releaseBlockers,
    files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, textHash(bytes)])),
  };
  const manifest = { ...manifestBody, packageHash: digest("factory-v4-candidate/1.0.0", manifestBody) };
  return { manifest, files: { ...files, "manifest.json": json(manifest) } };
}

/** New output only. A rerun verifies bytes and retains mtimes; a different candidate needs a new version. */
export function writeImmutableBatch(root: string, files: Readonly<Record<string, string>>) {
  const absoluteRoot = path.resolve(root);
  // Reject links in any existing parent, including junctions, before creating or writing files.
  for (let dir = absoluteRoot; ; dir = path.dirname(dir)) {
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw new Error("output_symlink_forbidden");
    if (path.dirname(dir) === dir) break;
  }
  const checkExisting = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name), stat = lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error("output_symlink_forbidden");
      if (stat.isDirectory()) checkExisting(file);
      else if (!(path.relative(absoluteRoot, file).split(path.sep).join("/") in files)) throw new Error("unexpected_existing_output");
    }
  };
  const planned = Object.entries(files).map(([name, bytes]) => {
    const target = path.resolve(absoluteRoot, name);
    if (!target.startsWith(absoluteRoot + path.sep)) throw new Error("output_path_escape");
    for (let dir = target; dir !== absoluteRoot; dir = path.dirname(dir)) {
      if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw new Error("output_symlink_forbidden");
    }
    if (existsSync(target) && readFileSync(target, "utf8") !== bytes) throw new Error(`immutable_output_conflict:${name}`);
    return { target, bytes };
  });
  if (existsSync(absoluteRoot)) checkExisting(absoluteRoot);
  for (const { target, bytes } of planned) if (!existsSync(target)) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes, { encoding: "utf8", flag: "wx" });
  }
}

export async function generateReferenceBatch(profile: ReferenceProfile = REFERENCE_PROFILE) {
  verifyReferenceInputs(process.cwd(), profile.inputs);
  const draftRoot = `curriculum/factory-v4/drafts/${profile.version}`;
  const oldFiles = ["docs/architecture/content-factory/evidence/first-three-v021-reconciliation.json",
    "curriculum/factory-v2/authoring/first-three/stated-primary-objectives-v021.json"];
  const before = oldFiles.map(file => ({ file, hash: textHash(normalizedFile(file)) }));
  const candidates = [];
  const files: Record<string, string> = {};
  for (const lesson of profile.lessons) {
    const first = await buildReferenceCandidate(lesson, profile), second = await buildReferenceCandidate(lesson, profile);
    if (json(first) !== json(second)) throw new Error(`nondeterministic_candidate:${lesson.key}`);
    for (const [name, bytes] of Object.entries(first.files)) files[`${lesson.key}/${name}`] = bytes;
    candidates.push({ key: lesson.key, manifest: `${draftRoot}/${lesson.key}/manifest.json`,
      packageHash: first.manifest.packageHash, manifestSha256: textHash(first.files["manifest.json"]),
      factoryStatus: first.manifest.factoryStatus, releaseBlockers: first.manifest.releaseBlockers });
  }
  for (const old of before) if (textHash(normalizedFile(old.file)) !== old.hash) throw new Error("v021_evidence_changed");
  const receipt = { version: "factory-v4-generation/1.0.0", candidateVersion: profile.version,
    contractVersion: VISUAL_TEACHING_CONTRACT, inputsSha256: hash(profile.inputs), candidates,
    deterministic: { independentBuildsPerCandidate: 2, allBytesIdentical: true },
    v021: { repositoryEvidenceUnchanged: before, restrictedPackagesAccessed: false, restrictedPackagesWritten: false },
    productionWrites: false, providerCalls: 0, approved: false, published: false, released: false,
    artifactScope: "LESSON_CANDIDATES_ONLY_NOT_COMPLETE_EXCELLENCE_PACKAGES" };
  files["generation-receipt.json"] = json(receipt);
  writeImmutableBatch(draftRoot, files);
  return receipt;
}
