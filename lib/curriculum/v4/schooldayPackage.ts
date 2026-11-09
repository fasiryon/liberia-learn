/**
 * Sealed loader for the 8 academically accepted Grade 4 school-day packages (G4-E2E; CoS ruling A and addendum,
 * COS-G4-E2E-ADMISSION-RULING-20261028.md). Reachable only from the pilot admission path
 * (learningPreview.loadStudentLearningPreview), which itself requires the preview policy row and the flag.
 *
 * Fail closed, never a fallback, never a write: an unregistered selection, an extra or missing file, a symlink, any
 * delivery flag set true, a package hash other than the registered one, a package digest mismatch, a file or receipt
 * hash mismatch, a projection hash mismatch or a scene-contract failure each throws. The packages stay
 * REVIEWER_ONLY / REVISION_REQUIRED with their release blockers: academic acceptance clears none of them, and no real
 * learner may receive them until the founder authorizes a pilot.
 */
import { createHash } from "crypto";
import { readdirSync } from "fs";
import path from "path";
import { readFactoryPackageText } from "./factoryReview";
import { digest } from "@/lib/content-factory/v2/blueprint";
import { hash } from "@/lib/content-factory/v4/generation";
import type { LessonExperience } from "@/lib/learner-experience/types";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";

/** Exactly the 8 accepted selections and their accepted package hashes. No pattern: an exact table. */
export const GRADE4_SCHOOLDAY_ACCEPTED = {
  "factory@4.0.0-schoolday-primary-math.2-draft.1@g4-math-three-digit-products": "df24c30a680e745006ef124f671a26cccb1bdf64a8ec9f79b3273e8ba4d98eb2",
  "factory@4.0.0-schoolday-primary-science.2-draft.1@g4-science-food-path-and-absorption": "6c9bb35aa616f76c316159159dcc2b96c22618e1a628f6e14a66b294ab2c607a",
  "factory@4.0.0-schoolday-primary-english.2-draft.1@g4-english-predict-question-summarize": "39c9cafb634914512bd4cf396cdb454b2770a9057e5bd93734a6787e8757f0e6",
  "factory@4.0.0-schoolday-primary-social-studies.2-draft.1@g4-social-studies-coast-inland-evidence": "924e57dcc56e65c20eaedb5133c70d84a433f935c898349ac053df22b584cd04",
  "factory@4.0.0-schoolday-primary-computing.2-draft.1@g4-computing-keep-score-with-variables": "be00b57563b01f490e99768e2787fd46271e446bf97d8a6d8c790a7f4deaba43",
  "factory@4.0.0-schoolday-primary-engineering.2-draft.1@g4-engineering-compare-flashlight-switches": "202106a8bffa0afb8c05aa9338db458b5b913483f70a222c2bc1b8a579b7a7a1",
  "factory@4.0.0-schoolday-grade4-support.2-draft.1@g4-support-retrieve-reteach-retry": "936016a5f43b7f8beb9d70696b0422f25c73862d8435c335ba5f221d0d79dd25",
  "factory@4.0.0-schoolday-grade4-eod.1-draft.1@g4-eod-evidence-connections": "f99247e183ee0653787d97354202974d1d3ad26e92e09bf5a5898230e2ef7791",
} as const satisfies Record<string, string>;

export type SchooldaySelection = keyof typeof GRADE4_SCHOOLDAY_ACCEPTED;
export const isRegisteredSchooldaySelection = (selection: string): selection is SchooldaySelection =>
  Object.prototype.hasOwnProperty.call(GRADE4_SCHOOLDAY_ACCEPTED, selection);

const DELIVERY_FLAGS = ["approved", "published", "released", "learnerDeliverable"] as const;
const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
const fail = (code: string): never => { throw Error(`schoolday_package_${code}`); };
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");

export function loadSchooldayPackage(selection: string, root = process.cwd()) {
  if (!isRegisteredSchooldaySelection(selection)) return fail("unregistered");
  const registeredHash: string = GRADE4_SCHOOLDAY_ACCEPTED[selection];
  const [, version, key] = selection.split("@");
  const versionDir = `curriculum/factory-v4/drafts/${version}`, dir = `${versionDir}/${key}`;

  const manifestText = readFactoryPackageText(root, `${dir}/manifest.json`);
  const manifest = JSON.parse(manifestText) as Record<string, unknown> & { files?: Record<string, string> };
  if (DELIVERY_FLAGS.some((flag) => manifest[flag] !== false)) fail("delivery_flag");
  if (manifest.key !== key || manifest.candidateVersion !== version) fail("identity");
  const files = manifest.files;
  if (!files || typeof files !== "object" || Object.values(files).some((value) => !/^[a-f0-9]{64}$/.test(value))) return fail("manifest_files");
  if (!sameSet(readdirSync(path.join(root, dir)), [...Object.keys(files), "manifest.json"])) fail("file_set");

  const { packageHash, ...body } = manifest;
  if (packageHash !== registeredHash) fail("hash");
  if (digest("factory-v4-candidate/1.0.0", body) !== registeredHash) fail("hash");

  const contents: Record<string, string> = {};
  for (const [name, expected] of Object.entries(files)) {
    const text = readFactoryPackageText(root, `${dir}/${name}`);
    if (sha(text) !== expected) fail("file_hash");
    contents[name] = text;
  }

  // The generation receipt seals every file of the version directory, including the review packet.
  const receipt = JSON.parse(readFactoryPackageText(root, `${versionDir}/generation-receipt.json`)) as { files?: Record<string, string> } & Record<string, unknown>;
  if (!receipt.files || DELIVERY_FLAGS.some((flag) => flag in receipt && receipt[flag] !== false)) fail("receipt");
  for (const [relative, expected] of Object.entries(receipt.files!)) {
    if (sha(readFactoryPackageText(root, `${versionDir}/${relative}`)) !== expected) fail("file_hash");
  }
  if (sha(manifestText) !== receipt.files![`${key}/manifest.json`]) fail("file_hash");

  const experience = JSON.parse(contents["learner-projection.json"] ?? fail("file_set")) as LessonExperience;
  if (hash(experience) !== manifest.learnerProjectionSha256) fail("projection_hash");
  // Versions are verified only where the sealed manifest declares them (P1-P3, the original sealed trees, declare none).
  const teachingVersions = typeof manifest.registryVersion === "string" && typeof manifest.instructionStandard === "string"
    ? { registryVersion: manifest.registryVersion, instructionStandard: manifest.instructionStandard } : undefined;
  validateLessonExperience(experience, teachingVersions);
  return {
    experience,
    teachingVersions,
    identity: { selection, candidateVersion: version, packageHash: registeredHash, candidateSha256: String(manifest.candidateSha256),
      learnerProjectionSha256: String(manifest.learnerProjectionSha256) },
    releaseBlockers: Array.isArray(manifest.releaseBlockers) ? (manifest.releaseBlockers as string[]) : [],
  };
}
