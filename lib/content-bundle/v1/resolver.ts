/** Server authority boundary. Readers must be constructed by the server, never from request data.
 * No Prisma client, mutation, latest-version fallback, publication or approval engine lives here.
 */
import { createHash } from "crypto";
import { canonicalizeJson, hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { CURRICULUM_LESSON_V2_CONTRACT, type CurriculumLessonV2 } from "@/lib/curriculum/v2/contract";
import { CURRICULUM_SNAPSHOT_SCHEMA_VERSION_NATIVE } from "@/lib/curriculum/provenance/snapshot";
import { deterministicReleaseIdentity, validateOntologyRelease, type CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import type { GovernedCellInventory } from "@/lib/learning-authority/governedInventory";
import { checkToolkitMapping, type ToolkitMapping } from "./toolkitMapping";
import { sealContentBundle } from "./seal";
import { projectLearnerBundle, type LearnerContentBundle } from "./projection";
import type { ContentBundleV1 } from "./types";

export type ResolveContentBundleInput = Readonly<{
  bundleId: string;
  bundleVersion: string;
  expectedContentHash?: string;
  releaseIdentity?: string;
}>;
export type ResolverDiagnostic = Readonly<{ code: string; path: string }>;
type Member = ContentBundleV1["lessons"][number] | ContentBundleV1["activities"][number] | ContentBundleV1["assessments"][number];
export type RevisionPin = Readonly<{ revisionId: string; provenanceId: string; contentHash: string }>;
export type CompositionRecord = Readonly<{
  manifest: unknown;
  /** Pins originate in the immutable composition snapshot, not the request. */
  revisions: Readonly<Record<string, RevisionPin>>;
}>;
/** Projection of existing exact-revision governance, NOT a new review ledger.
 * An adapter must replay existing governance for THIS revision, including corrections/revocation.
 * `snapshot` is the immutable existing revision, hashed by the existing snapshot hash convention.
 * `member` is an allowlisted V1 adapter output from that snapshot (V2 scenes remain external).
 */
export type ResolvedRevision = Readonly<{
  revisionId: string; provenanceId: string; contentHash: string;
  lifecycleState: string; provenanceCompleteness: string;
  snapshotSchemaVersion: number;
  snapshot: unknown; member: Member;
  /** Exact release-bound payload, restored by the existing snapshot adapter, never current row. */
  releasePayload?: unknown;
  /** Native V2 definition from that exact snapshot, when the item is a V2 lesson. */
  nativeLesson?: CurriculumLessonV2;
}>;
export type AssessmentAuthority = Readonly<{
  definition: ContentBundleV1["assessments"][number]["definition"];
  items: ContentBundleV1["assessments"][number]["items"];
  itemOrder: ContentBundleV1["assessments"][number]["itemOrder"];
  scoring: "SINGLE_CHOICE_SERVER" | "UNSUPPORTED";
  source: "RELEASE_ITEMS" | "ANSWER_BEARING_LEGACY";
}>;
export interface ContentBundleAuthorityReader {
  readComposition(input: ResolveContentBundleInput): Promise<CompositionRecord | null>;
  readRelease(releaseId: string): Promise<CurriculumOntologyRelease | null>;
  readInventory(release: CurriculumOntologyRelease): Promise<GovernedCellInventory | null>;
  readCurriculumAuthority(release: CurriculumOntologyRelease): Promise<ContentBundleV1["curriculumAuthority"] | null>;
  readRevision(pin: RevisionPin): Promise<ResolvedRevision | null>;
  readAssessment(ref: ContentBundleV1["assessments"][number]["definition"]): Promise<AssessmentAuthority | null>;
  readResource(ref: ContentBundleV1["resources"][number]): Promise<ContentBundleV1["resources"][number] | null>;
  readAsset(ref: ContentBundleV1["offline"]["assets"][number]): Promise<ContentBundleV1["offline"]["assets"][number] | null>;
  readRendering(ref: ContentBundleV1["renderings"][number]): Promise<ContentBundleV1["renderings"][number] | null>;
  readToolkitMapping(ref: NonNullable<ContentBundleV1["toolkitMapping"]>): Promise<ToolkitMapping | null>;
  isRuntimeToolId(id: string): boolean;
}
export type ContentBundleResolution = Readonly<{
  status: "RESOLVED" | "UNAVAILABLE" | "INCOMPATIBLE";
  bundle: ContentBundleV1 | null;
  learnerProjection: LearnerContentBundle | null;
  diagnostics: readonly ResolverDiagnostic[];
}>;

const exact = (value: string) => typeof value === "string" && value.trim().length > 0 && !/^(latest|current|\*)$/i.test(value.trim());
const equal = (a: unknown, b: unknown): boolean => canonicalizeJson(a) === canonicalizeJson(b);
const failure = (status: "UNAVAILABLE" | "INCOMPATIBLE", diagnostics: readonly ResolverDiagnostic[]): ContentBundleResolution => ({ status, bundle: null, learnerProjection: null, diagnostics });

/** Existing revision snapshots use hashCurriculumSnapshot; bundle sealing uses V1's
 * separate domain/canonicalization. Never replace a declared digest with a newly computed one.
 */
export async function resolveContentBundle(input: ResolveContentBundleInput, reader: ContentBundleAuthorityReader): Promise<ContentBundleResolution> {
  if (!input || !exact(input.bundleId) || !exact(input.bundleVersion)) return failure("INCOMPATIBLE", [{ code: "EXACT_IDENTITY_REQUIRED", path: "input" }]);
  const diagnostics: ResolverDiagnostic[] = [];
  const gap = (code: string, path: string) => diagnostics.push({ code, path });
  try {
    const composition = await reader.readComposition(input);
    if (!composition) return failure("UNAVAILABLE", [{ code: "COMPOSITION_MISSING", path: "bundle" }]);
    const sealed = sealContentBundle(structuredClone(composition.manifest));
    if (sealed.ok === false) return failure("INCOMPATIBLE", sealed.errors.map(e => ({ code: e.code, path: e.path })));
    const bundle = sealed.sealed.bundle;
    const checkVersions = (value: unknown, path: string) => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (/version$/i.test(key) && typeof child === "string" && !exact(child)) gap("VERSION_PIN_MISSING", `${path}.${key}`);
        checkVersions(child, `${path}.${key}`);
      }
    };
    checkVersions(bundle, "bundle");
    if (bundle.identity.bundleId !== input.bundleId || bundle.identity.version !== input.bundleVersion) gap("VERSION_MISMATCH", "identity");
    if (input.expectedContentHash !== undefined && input.expectedContentHash !== sealed.sealed.contentHash) gap("CONTENT_HASH_MISMATCH", "identity.contentHash");
    const release = await reader.readRelease(bundle.curriculumAuthority.releaseId);
    if (!release) return failure("UNAVAILABLE", [{ code: "RELEASE_MISSING", path: "curriculumAuthority.releaseId" }]);
    if (release.status !== "PUBLISHED" || release.reviewStatus !== "APPROVED") gap("RELEASE_NOT_APPROVED_PUBLISHED", "curriculumAuthority");
    else {
      try { validateOntologyRelease(release); } catch { gap("RELEASE_INVALID", "curriculumAuthority"); }
    }
    const releaseIdentity = deterministicReleaseIdentity(release);
    if (bundle.curriculumAuthority.releaseIdentity !== releaseIdentity || (input.releaseIdentity !== undefined && input.releaseIdentity !== releaseIdentity)) gap("RELEASE_IDENTITY_MISMATCH", "curriculumAuthority.releaseIdentity");
    if (release.grade !== bundle.identity.gradeLevel || release.subject.toLowerCase() !== bundle.identity.subject.toLowerCase()) gap("RELEASE_SCOPE_MISMATCH", "identity");
    const inventory = await reader.readInventory(release);
    if (!equal(bundle.curriculumAuthority, await reader.readCurriculumAuthority(release))) gap("CURRICULUM_AUTHORITY_MISMATCH", "curriculumAuthority");
    if (!inventory || inventory.releaseId !== release.id || inventory.releaseIdentity !== releaseIdentity) gap("INVENTORY_UNRESOLVED", "curriculumAuthority");
    else for (const objective of bundle.curriculumAuthority.objectiveIds) {
      if (![...inventory.concepts.map(c => c.objectiveId), ...inventory.uncoveredObjectiveIds].includes(objective)) gap("OBJECTIVE_MISSING", "curriculumAuthority.objectiveIds");
    }
    for (const id of bundle.curriculumAuthority.conceptRefs) if (!release.concepts.some(c => c.id === id)) gap("CONCEPT_MISSING", "curriculumAuthority.conceptRefs");
    for (const id of bundle.curriculumAuthority.constructBindingRefs) if (!release.bindings.some(b => b.id === id)) gap("CONSTRUCT_BINDING_MISSING", "curriculumAuthority.constructBindingRefs");
    if (!bundle.governance.provenanceRefs.includes(release.provenanceRef)) gap("PROVENANCE_MISMATCH", "governance.provenanceRefs");
    for (const member of [...bundle.lessons, ...bundle.activities, ...bundle.assessments]) {
      const path = `members.${member.identity.itemId}`;
      if (!exact(member.identity.itemVersion)) gap("VERSION_PIN_MISSING", path);
      const pin = composition.revisions[member.identity.itemId];
      const revision = pin ? await reader.readRevision(pin) : null;
      if (!revision) { gap("ITEM_REVISION_MISSING", path); continue; }
      if (!equal(pin, { revisionId: revision.revisionId, provenanceId: revision.provenanceId, contentHash: revision.contentHash }) || !bundle.governance.provenanceRefs.includes(revision.provenanceId)) gap("PROVENANCE_REVISION_MISMATCH", path);
      if (revision.lifecycleState !== "APPROVED" || revision.provenanceCompleteness !== "VERIFIED") gap("ITEM_NOT_GOVERNED", path);
      if (hashCurriculumSnapshot(revision.snapshotSchemaVersion, revision.snapshot) !== revision.contentHash) gap("REVISION_HASH_MISMATCH", path);
      if (!equal(member, revision.member)) gap("ITEM_VERSION_OR_CONTENT_MISMATCH", path);
      if (member.identity.itemKind === "LESSON") {
        const binding = release.contentBindings.find(b => b.contentId === member.identity.itemId && b.contentVersion === member.identity.itemVersion && b.contentType === "LESSON");
        if (!binding || !inventory?.lessons.some(l => l.contentId === member.identity.itemId && l.version === member.identity.itemVersion)) gap("LESSON_NOT_RELEASED", path);
        if (!binding?.contentSha256) gap("LESSON_PAYLOAD_HASH_MISSING", path);
        // Binding digest hashes the lesson payload; revision digest hashes the full snapshot.
        else {
          if (!revision.releasePayload || createHash("sha256").update(JSON.stringify(revision.releasePayload)).digest("hex") !== binding.contentSha256) gap("LESSON_PAYLOAD_HASH_MISMATCH", path);
        }
        const nativeSnapshot = revision.snapshot as { experience?: { curriculumV2?: unknown; lessonExperience?: unknown } };
        if (revision.snapshotSchemaVersion === CURRICULUM_SNAPSHOT_SCHEMA_VERSION_NATIVE && (!revision.nativeLesson || !nativeSnapshot?.experience?.curriculumV2 || !equal(revision.nativeLesson, nativeSnapshot.experience.curriculumV2))) gap("NATIVE_LESSON_REVISION_MISMATCH", path);
        if (revision.nativeLesson) {
          const lesson = revision.nativeLesson;
          if (lesson.contractVersion !== CURRICULUM_LESSON_V2_CONTRACT || lesson.identity.lessonId !== member.identity.itemId || lesson.identity.version !== member.identity.itemVersion || lesson.identity.title !== member.title || lesson.estimatedMinutes !== (member as ContentBundleV1["lessons"][number]).estimatedMinutes || lesson.authoring.releaseId !== release.id || lesson.authoring.releaseIdentity !== releaseIdentity || !equal(lesson.objectives.map(o => o.id).sort(), [...member.objectiveIds].sort())) gap("NATIVE_LESSON_REVISION_MISMATCH", path);
          if (lesson.reviewGaps.some(g => g.severity === "BLOCKING")) gap("NATIVE_LESSON_BLOCKING_GAP", path);
          // Embedded governance.state is a generation-time DRAFT; only replayed exact-revision
          // lifecycle above can establish approval. We never promote this embedded flag.
        }
      }
    }
    for (const assessment of bundle.assessments) {
      const path = `assessments.${assessment.identity.itemId}`;
      const authority = await reader.readAssessment(assessment.definition);
      if (!authority || !equal(authority.definition, assessment.definition) || !equal(authority.items, assessment.items) || !equal(authority.itemOrder, assessment.itemOrder)) gap("ASSESSMENT_IDENTITY_INVALID", path);
      if (authority?.source === "ANSWER_BEARING_LEGACY") gap("ANSWER_BEARING_LEGACY_STORE", path);
      if (authority && authority.scoring !== "SINGLE_CHOICE_SERVER") gap("UNSUPPORTED_SCORING", path);
      for (const item of assessment.items) {
        if (!exact(item.assessmentItemVersion)) gap("ASSESSMENT_VERSION_PIN_MISSING", path);
        if (!release.items.some(i => i.id === item.assessmentItemId && i.version === item.assessmentItemVersion) || !release.bindings.some(b => b.itemId === item.assessmentItemId && b.itemVersion === item.assessmentItemVersion)) gap("ASSESSMENT_ITEM_NOT_RELEASED", path);
      }
    }
    for (const resource of bundle.resources) if (!equal(resource, await reader.readResource(resource))) gap("RESOURCE_VERSION_UNRESOLVED", `resources.${resource.resourceId}`);
    for (const asset of bundle.offline.assets) if (!equal(asset, await reader.readAsset(asset))) gap("ASSET_HASH_OR_VERSION_MISMATCH", `offline.assets.${asset.assetId}`);
    for (const rendering of bundle.renderings) if (!equal(rendering, await reader.readRendering(rendering))) gap("RENDERING_HASH_OR_VERSION_MISMATCH", `renderings.${rendering.renderingId}`);
    if (bundle.toolkitBindings.length) {
      for (const binding of bundle.toolkitBindings) if (!release.toolPolicies.some(p => [...p.allowed, ...p.prohibited].includes(binding.toolId))) gap("TOOL_NOT_GOVERNED", "toolkitBindings");
      const mapping = bundle.toolkitMapping ? await reader.readToolkitMapping(bundle.toolkitMapping) : null;
      if (!mapping) gap("TOOLKIT_MAPPING_UNRESOLVED", "toolkitMapping");
      else for (const issue of checkToolkitMapping(bundle, mapping, id => reader.isRuntimeToolId(id))) gap(issue.code, "toolkitMapping");
    }
    // Current LearningExperienceLink has no immutable linkRevision. No adapter can certify one.
    for (const lab of bundle.labs) gap("LAB_REVISION_CERTIFICATION_UNRESOLVED", `labs.${lab.identity.itemId}`);
    if (diagnostics.length) return failure("INCOMPATIBLE", diagnostics);
    const learnerProjection = projectLearnerBundle(bundle, sealed.sealed.contentHash);
    if (!isLearnerProjectionSafe(bundle, learnerProjection)) return failure("INCOMPATIBLE", [{ code: "LEARNER_PROJECTION_INVALID", path: "learnerProjection" }]);
    return { status: "RESOLVED", bundle, learnerProjection, diagnostics: [] };
  } catch {
    // Never return partial content or raw database/provider errors (which may contain secrets).
    return failure("UNAVAILABLE", [{ code: "AUTHORITY_READ_FAILED", path: "authority" }]);
  }
}

/** Defense in depth after the V1 allowlist: references/assets must stay in learner closure. */
export function isLearnerProjectionSafe(bundle: ContentBundleV1, projection: LearnerContentBundle): boolean {
  const blockedResources = new Set(bundle.resources.filter(r => r.audience !== "LEARNER" || ["ANSWER_KEY", "SCORING_GUIDE", "TEACHER_NOTE"].includes(r.kind)).map(r => r.resourceId));
  const blockedAssets = new Set(bundle.offline.assets.filter(a => a.audience !== "LEARNER").map(a => a.assetId));
  const normalize = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");
  const forbidden = new Set(["secured", "correctindex", "correctanswer", "answerkey", "scoringexplanation", "scoringguideresourceid", "internalconfiguration", "governance", "reviewernotes", "extensions", "teacher", "apikey", "secret", "password", "accesstoken", "privatekey", "authorization"]);
  const visit = (value: unknown): boolean => {
    if (typeof value === "string") return !blockedResources.has(value) && !blockedAssets.has(value);
    if (Array.isArray(value)) return value.every(visit);
    if (value && typeof value === "object") return Object.entries(value).every(([key, child]) => !forbidden.has(normalize(key)) && visit(child));
    return true;
  };
  return visit(projection) && projection.resources.every(r => !["ANSWER_KEY", "SCORING_GUIDE", "TEACHER_NOTE"].includes(r.kind)) && projection.renderings.every(r => r.kind !== "TEACHER_GUIDE");
}

/** Authorization is supplied by the caller's existing server RBAC/tenant policy. No route.
 * Teacher preview intentionally returns the learner-safe bundle plus bounded teacher metadata;
 * raw governance snapshots/configuration and the server bundle never cross this boundary.
 */
export function createTeacherPreviewResolver(reader: ContentBundleAuthorityReader, authorize: () => Promise<void>) {
  return async (input: ResolveContentBundleInput) => {
    await authorize();
    const result = await resolveContentBundle(input, reader);
    return {
      status: result.status, bundle: result.learnerProjection, learnerProjection: result.learnerProjection,
      teacherMetadata: result.bundle ? {
        identity: { bundleId: result.bundle.identity.bundleId, version: result.bundle.identity.version, contentHash: result.bundle.identity.contentHash },
        resources: result.bundle.resources.filter(r => r.audience === "TEACHER").map(r => ({ resourceId: r.resourceId, resourceVersion: r.resourceVersion, kind: r.kind, title: r.title })),
      } : null,
      diagnostics: result.diagnostics,
    };
  };
}
