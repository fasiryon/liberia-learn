import { createHash } from "crypto";
import { readdirSync } from "fs";
import path from "path";
import { z } from "zod";
import { digest } from "@/lib/content-factory/v2/blueprint";
import { hash } from "@/lib/content-factory/v4/generation";
import { DRAFT6_LESSONS } from "@/lib/content-factory/v4/draft6/lessons";
import { validateAcademicCandidate } from "@/lib/content-factory/v4/draft6/quality";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { factoryLearnerProjection } from "./factoryProjection";
import { readFactoryPackageText } from "./factoryReview";
import { visualTeachingSidecarSchema } from "@/lib/content-factory/v4/visualTeachingBlock";

export type VerifiedTeachingVersions = Readonly<{ registryVersion: string; instructionStandard: string }>;

export const DRAFT6_RECEIPT_SHA256 = "c59d3623d3bd558398a50e30de62688bc066ca22238c3d188b2ef88c9cbe04ab";
const rootDir = "curriculum/factory-v4/drafts/4.0.0-draft.6";
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const receiptSchema = z.object({ version: z.literal("4.0.0-draft.6"), packages: z.array(z.object({ key: z.string(), packageHash: hex, candidateSha256: hex })), files: z.record(z.string(), hex) });
const manifestSchema = z.object({ candidateVersion: z.literal("4.0.0-draft.6"), key: z.string(),
  packageHash: hex, candidateSha256: hex, learnerProjectionSha256: hex, files: z.record(z.string(), hex),
  approved: z.literal(false), published: z.literal(false), released: z.literal(false), learnerDeliverable: z.literal(false),
  audience: z.literal("REVIEWER_ONLY"), releaseBlockers: z.array(z.string()) }).passthrough();
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

/** Separate draft.6 receipt format. No latest alias, source fetch, approval, or database access. */
export function loadDraft6Review(selection: string, root = process.cwd()) {
  const match = /^factory@4\.0\.0-draft\.6@([a-z0-9-]+)$/.exec(selection);
  if (!match) throw Error("draft6_review_selection");
  const key = match[1], lesson = DRAFT6_LESSONS.find(entry => entry.key === key);
  if (!lesson) throw Error("draft6_review_unknown_lesson");
  const receiptBytes = readFactoryPackageText(root, `${rootDir}/generation-receipt.json`);
  if (sha(receiptBytes) !== DRAFT6_RECEIPT_SHA256) throw Error("draft6_review_receipt_hash");
  const receipt = receiptSchema.parse(JSON.parse(receiptBytes));
  const pin = receipt.packages.find(entry => entry.key === key);
  if (!pin) throw Error("draft6_review_package_missing");
  const readPinned = (name: string) => {
    if (!/^[a-z0-9.-]+$/.test(name)) throw Error("draft6_review_filename");
    const relative = `${key}/${name}`, bytes = readFactoryPackageText(root, `${rootDir}/${relative}`);
    if (sha(bytes) !== receipt.files[relative]) throw Error(`draft6_review_file_hash:${name}`);
    return bytes;
  };
  const raw: unknown = JSON.parse(readPinned("manifest.json"));
  const manifest = manifestSchema.parse(raw);
  const { packageHash, ...body } = z.record(z.string(), z.unknown()).parse(raw);
  if (manifest.key !== key || packageHash !== pin.packageHash || digest("factory-v4-candidate/1.0.0", body) !== packageHash) throw Error("draft6_review_package_hash");
  const expected = [...Object.keys(manifest.files), "manifest.json"].sort();
  if (readdirSync(path.join(root, rootDir, key)).sort().join() !== expected.join()) throw Error("draft6_review_inventory");
  const contents = Object.fromEntries(Object.entries(manifest.files).map(([name, checksum]) => {
    const bytes = readPinned(name);
    if (sha(bytes) !== checksum) throw Error(`draft6_review_manifest_file_hash:${name}`);
    return [name, bytes];
  }));
  const candidate = parseCandidateLessonV2(contents["candidate.json"]);
  // Declarations come from the manifest/receipt-verified file, never request parameters or inferred phases.
  const sidecar = visualTeachingSidecarSchema.parse(JSON.parse(contents["visual-teaching.json"]));
  if (sidecar.candidateSha256 !== manifest.candidateSha256) throw Error("draft6_review_sidecar_candidate_hash");
  const teachingVersions: VerifiedTeachingVersions = { registryVersion: sidecar.registryVersion, instructionStandard: sidecar.instructionStandard };
  if (hash(candidate) !== pin.candidateSha256 || hash(candidate) !== manifest.candidateSha256) throw Error("draft6_review_candidate_hash");
  validateAcademicCandidate(candidate, lesson);
  const experience = factoryLearnerProjection(lesson, candidate, "4.0.0-draft.6");
  validateLessonExperience(experience, teachingVersions);
  if (hash(experience) !== manifest.learnerProjectionSha256 || hash(JSON.parse(contents["learner-projection.json"])) !== hash(experience)) throw Error("draft6_review_projection_hash");
  return { experience, teachingVersions, identity: { selection, candidateVersion: manifest.candidateVersion,
    packageHash: manifest.packageHash, candidateSha256: manifest.candidateSha256,
    learnerProjectionSha256: manifest.learnerProjectionSha256 }, releaseBlockers: manifest.releaseBlockers };
}
