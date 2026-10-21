/** Server-only, read-only resolver for the exact immutable factory delivery. */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { z } from "zod";
import delivery from "@/docs/architecture/content-factory/evidence/first-three-v2-reconciliation.json";
import { digest, parseBlueprint } from "@/lib/content-factory/v2/blueprint";
import { artifactHash, parseResourceDraft } from "@/lib/content-factory/v2/quality";
import { authoringInputSchema } from "@/lib/content-factory/v2/authoringInput";
import { resolveAuthoredRuntime } from "@/lib/content-factory/v2/runtimeBindings";
import { verifyFirstThreeRuntimeSources } from "@/lib/content-factory/v2/runtimeSource";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { resolveLabProposal } from "@/lib/curriculum/v2/labs";
import { toLessonExperience } from "@/lib/curriculum/v2/compat";
import { projectItemForLearner } from "@/lib/assessment/v2/projection";
import { scoreResponse } from "@/lib/assessment/v2/scoring";
import type { LearnerResponse } from "@/lib/assessment/v2/itemTypes";
import type { FactoryArtifact } from "@/lib/content-factory/v2/types";
import type { Scene } from "./types";

const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const manifestSchema = z.object({ schemaVersion: z.literal("factory-ten-candidates/1.0.0"), inputHash: z.string(), files: z.record(z.string(), z.string()), packageHash: z.string() }).strict();
const summarySchema = z.object({ candidateId: z.string(), candidateVersion: z.literal("0.2.0"), inputHash: z.string(), state: z.literal("DRAFT"), approved: z.literal(false), released: z.literal(false), reviewState: z.literal("PENDING_INDEPENDENT_REVIEW"), generationStatus: z.literal("AWAITING_HUMAN_REVIEW"), failures: z.array(z.string()).length(0) }).passthrough();
const inputSchema = z.object({ originalAuthoringInputBase64: z.string(), source: z.object({ databaseId: z.string(), contentId: z.string(), revisionId: z.string(), revisionNumber: z.number(), snapshotSchemaVersion: z.number(), contentSnapshot: z.unknown(), contentHash: z.string() }) }).passthrough();
const artifactSchema = z.object({ id: z.string(), version: z.string(), payload: z.unknown(), blueprint: z.object({ blueprintId: z.string(), version: z.string(), contentHash: z.string() }), role: z.string(), author: z.unknown(), dependencies: z.array(z.unknown()), contentHash: z.string() });

export const CANDIDATE_REVIEW_IDS = ["candidate-ft01-g7-civics-counties-capitals", "candidate-ft04-g7-science-states-of-matter", "candidate-ft07-g7-math-fractions"] as const;
const sourceIds = ["wk_mca7a_fri_p4", "wk_mca7a_fri_p3", "lesson_mca_1"];

function readCandidate(candidateId: string) {
  const index = CANDIDATE_REVIEW_IDS.findIndex(id => id === candidateId);
  if (index < 0) return null; // URL input never selects a filesystem path.
  const pin = delivery.packages.find(p => p.contentId === sourceIds[index]);
  if (!pin) throw new Error("candidate_delivery_missing");
  const root = path.resolve(pin.reviewPackage);
  const inside = path.relative(process.cwd(), root);
  if (!inside.startsWith(`..${path.sep}`) && inside !== ".." && !path.isAbsolute(inside)) throw new Error("candidate_package_inside_repository");
  if (fs.lstatSync(root).isSymbolicLink() || fs.realpathSync(root) !== root) throw new Error("candidate_package_symlink");
  const manifestBytes = fs.readFileSync(path.join(root, "manifest.json"));
  if (hash(manifestBytes) !== pin.manifestFileSha256) throw new Error("candidate_manifest_pin_mismatch");
  const manifest = manifestSchema.parse(JSON.parse(manifestBytes.toString("utf8")));
  const { packageHash, ...body } = manifest;
  if (packageHash !== pin.packageHash || digest("factory-batch-package", body) !== packageHash) throw new Error("candidate_package_hash_mismatch");
  const names = fs.readdirSync(root).filter(f => f !== "manifest.json").sort();
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(manifest.files).sort())) throw new Error("candidate_file_set_mismatch");
  for (const name of names) {
    const file = path.join(root, name);
    if (path.basename(name) !== name || fs.lstatSync(file).isSymbolicLink() || hash(fs.readFileSync(file)) !== manifest.files[name]) throw new Error("candidate_file_integrity_failure");
  }
  verifyFirstThreeRuntimeSources();
  const read = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
  const summary = summarySchema.parse(read("summary.json"));
  if (summary.candidateId !== candidateId || summary.inputHash !== manifest.inputHash) throw new Error("candidate_identity_mismatch");
  const input = inputSchema.parse(read("input.json"));
  const authoredBytes = Buffer.from(input.originalAuthoringInputBase64, "base64");
  const authoredPin = delivery.sourceInputs.find(p => p.contentId === pin.contentId);
  if (!authoredPin || hash(authoredBytes) !== authoredPin.v2AuthoredSha256) throw new Error("candidate_authored_pin_mismatch");
  const authored = authoringInputSchema.parse(JSON.parse(authoredBytes.toString("utf8")));
  const runtime = resolveAuthoredRuntime(authored);
  if (!runtime || input.source.contentId !== pin.contentId || input.source.databaseId !== authored.source.databaseId || input.source.revisionId !== authored.source.revisionId || input.source.revisionNumber !== authored.source.revisionNumber || input.source.contentHash !== authored.source.snapshotSha256 || hashCurriculumSnapshot(input.source.snapshotSchemaVersion, input.source.contentSnapshot) !== authored.source.snapshotSha256) throw new Error("candidate_source_or_runtime_mismatch");
  const blueprint = parseBlueprint(authored.blueprint);
  const artifacts = pin.resources.map(resource => {
    const raw = artifactSchema.parse(read(resource.file));
    // parseResourceDraft validates the owner's real lesson, activity and assessment contracts.
    const draft = parseResourceDraft({ id: raw.id, version: raw.version, payload: raw.payload });
    const original = read(resource.file) as FactoryArtifact; // envelope and payload validated above; protected data stays server-side.
    if (artifactHash(original) !== resource.contentHash || raw.contentHash !== resource.contentHash) throw new Error("candidate_resource_hash_mismatch");
    return draft;
  });
  const lesson = artifacts.find(a => a.payload.kind === "LESSON");
  const diagnostic = artifacts.find(a => a.id === "diagnostic");
  const worksheet = artifacts.find(a => a.id === "worksheet");
  if (!lesson || lesson.payload.kind !== "LESSON" || diagnostic?.payload.kind !== "ASSESSMENT" || diagnostic.payload.definition.purpose !== "DIAGNOSTIC" || worksheet?.payload.kind !== "DOCUMENT") throw new Error("candidate_sequence_incomplete");
  return { pin, summary, authored, blueprint, candidate: lesson.payload.candidate, diagnostic: diagnostic.payload, worksheet: worksheet.payload };
}

export function candidateReviewEntry(candidateId: string) {
  const resolved = readCandidate(candidateId);
  if (!resolved) return null;
  const { candidate, blueprint, summary, pin } = resolved;
  const labLinks = candidate.labProposals.map(proposal => resolveLabProposal({ proposal, scenes: candidate.scenes, lesson: { lessonId: candidateId, version: summary.candidateVersion }, context: { grade: blueprint.grade, objectives: blueprint.objectives, concepts: [], prerequisiteConceptIds: [] } }));
  const projected = toLessonExperience({ identity: { lessonId: candidateId, version: summary.candidateVersion, title: candidate.title, grade: blueprint.grade, subject: blueprint.subject, unitId: blueprint.unitId }, ageBand: candidate.ageBand, scenes: candidate.scenes, labLinks, assessmentHandoffs: [], objectives: blueprint.objectives.map(o => ({ id: o.id, statement: o.statement, conceptIds: [], standardCodes: [], skillIds: [] })), authoring: { releaseId: null, releaseIdentity: null } });
  const handoff: Scene = { id: "review-assessment-handoff", type: "MASTERY_CHECK", title: "Assessment handoff", objectiveIds: projected.objectives.map(o => o.id), content: { body: "Synthetic review sequence complete. Independent assessment requires separate authorization and exact item review. Official grades, mastery writes and production release are disabled." }, interaction: { kind: "ASSESSMENT_HANDOFF", assessment: { assessmentId: `${candidateId}--summative`, assessmentVersion: summary.candidateVersion, player: "ASSESSMENT_PLAYER_V2", scoring: "SERVER_AUTHORITY", objectiveIds: projected.objectives.map(o => o.id), items: [] } }, tools: { allowed: [], prohibited: [] }, accessibility: { textAlternative: "Assessment handoff is disabled pending review.", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false }, offline: { mode: "ONLINE_ONLY", fallback: "Connect to the authorized review runtime." }, evidence: { kind: "MASTERY_RESPONSE", evidenceType: "QUIZ", objectiveIds: projected.objectives.map(o => o.id) }, completion: { kind: "VIEWED" } };
  const scenes = projected.scenes.map(scene => {
    const media = resolved.authored.assets.filter(a => a.sceneId === scene.id).map(a => ({ kind: "IMAGE" as const, ref: `/lab-review/experience/${candidateId}/media/${a.sha256}`, alt: a.altText }));
    return media.length ? { ...scene, media } : scene;
  });
  return { experience: { ...projected, scenes: [...scenes, handoff], offline: { packageable: false, requiredAssets: [] }, authority: { ...projected.authority, note: `Reviewer-only V2 draft. Package ${pin.packageHash}. V0.2.1 adoption pending. No official grades, mastery writes or release.` } }, links: labLinks.map(l => l.link) };
}

export function candidateDiagnostic(candidateId: string) {
  const resolved = readCandidate(candidateId);
  if (!resolved) return null;
  return { packageHash: resolved.pin.packageHash, items: resolved.diagnostic.items.map(item => projectItemForLearner(item, { attemptId: `synthetic-review-${resolved.pin.packageHash}`, points: 0, independent: true })) };
}

export const diagnosticRequestSchema = z.object({ packageHash: z.string().regex(/^[a-f0-9]{64}$/), responses: z.record(z.string(), z.discriminatedUnion("kind", [z.object({ kind: z.literal("SINGLE_SELECT"), optionId: z.string().max(500) }).strict(), z.object({ kind: z.literal("NUMERIC"), value: z.string().max(64), unit: z.string().max(64).nullable() }).strict()])) }).strict();

export function reviewDiagnosticResult(candidateId: string, request: z.infer<typeof diagnosticRequestSchema>) {
  const resolved = readCandidate(candidateId);
  if (!resolved || request.packageHash !== resolved.pin.packageHash) return null;
  const { diagnostic, blueprint, worksheet } = resolved;
  if (Object.keys(request.responses).length !== diagnostic.items.length || diagnostic.items.some(item => !Object.hasOwn(request.responses, item.itemId))) throw new Error("diagnostic_response_set_invalid");
  const outcomes = diagnostic.items.map(item => {
    const spec = diagnostic.specs.find(s => s.itemId === item.itemId && s.itemVersion === item.version);
    if (!spec) throw new Error("diagnostic_spec_missing");
    const raw = request.responses[item.itemId];
    const response: LearnerResponse = raw.kind === "NUMERIC" ? { ...raw, unit: raw.unit ?? null } : raw;
    const result = scoreResponse(item, spec, response);
    if (result.status === "INVALID_RESPONSE" || result.status === "BLANK") throw new Error("diagnostic_response_invalid");
    return result;
  });
  const needsRemediation = outcomes.some(result => result.status !== "SCORED" || result.points !== result.maxPoints);
  // No score, key, rubric, misconception response pattern or item verdict leaves the server.
  return { packageHash: resolved.pin.packageHash, phase: needsRemediation ? "REMEDIATION" as const : "INSTRUCTION" as const, remediation: needsRemediation ? { title: worksheet.title, prerequisites: blueprint.prerequisites.map(p => p.statement), sections: worksheet.sections.map(({ heading, text }) => ({ heading, text })) } : null, officialGrades: false, masteryWrites: false, released: false };
}

export function candidateReviewMedia(candidateId: string, mediaHash: string) {
  if (!/^[a-f0-9]{64}$/.test(mediaHash)) return null;
  const resolved = readCandidate(candidateId);
  const asset = resolved?.authored.assets.find(a => a.sha256 === mediaHash && a.mimeType === "image/png");
  if (!asset) return null;
  const bytes = Buffer.from(asset.bytesBase64, "base64");
  if (hash(bytes) !== mediaHash) throw new Error("candidate_media_hash_mismatch");
  return bytes;
}
