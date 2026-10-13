/** Server read seam. No client assertion, approval mutation, scoring or mastery write. */
import type { Prisma } from "@prisma/client";
import { learnerMetadataAllowed, learnerLifecycleAllowed, learnerScopeAllows, loadLearnerScope } from "@/lib/curriculum/learnerEligibility";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { isNativeCurriculumV2Payload, CURRICULUM_V2_PAYLOAD_KEY, type CurriculumLessonV2 } from "@/lib/curriculum/v2/contract";
import { assertNativeCurriculumV2Approval, NATIVE_APPROVAL_EVENTS } from "@/lib/curriculum/v2/governance";
import { buildCurriculumContentSnapshot, CURRICULUM_SNAPSHOT_SCHEMA_VERSION_NATIVE } from "@/lib/curriculum/provenance/snapshot";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { publishedRelease } from "@/lib/learning-authority/publishedReleases";
import { deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";
import { governedInventoryForRelease } from "@/lib/learning-authority/governedInventoryRuntime";
import { lessonPayloadSha256 } from "@/lib/learning-authority/releases/grade4Math2026_2";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { findLabExperience, isGradeAppropriate } from "@/lib/learner-experience/labExperience";
import { isLinkStudentVisible, validateExperienceLink, type LearningExperienceLink } from "@/lib/learner-experience/links";
import { type LabLaunchContext } from "@/lib/learner-experience/labLaunch";
import type { LessonRouteTarget, LessonReturnTarget } from "@/lib/learner-experience/lessonRoute";
import type { AssessmentHandoff, LessonExperience, Scene, SceneInteraction } from "@/lib/learner-experience/types";

/** Delivery intentionally omits instant-feedback keys from the existing authoring/player type. */
export type LearnerScene = Omit<Scene, "interaction"> & { interaction:
  | Exclude<SceneInteraction, { kind: "MULTIPLE_CHOICE" }>
  | Readonly<{ kind: "MULTIPLE_CHOICE"; feedbackAuthority: "SERVER_REQUIRED"; items: readonly Readonly<{ id: string; prompt: string; options: readonly string[] }>[] }>
};
export type DeliveryIdentity = Readonly<{
  lessonId: string; lessonVersion: string; releaseId: string | null;
  releaseIdentity: string | null; revisionId: string | null;
}>;
export type EvidenceDisposition = "OBSERVATION_ONLY" | "READ_ONLY" | "OFFLINE_PENDING" | "INCOMPATIBLE_VERSION";
export type AuthorizedLabLink = Readonly<{
  linkId: string; labId: string; labVersion: string; label: string; sceneId: string;
  returnTarget: LessonReturnTarget; launchContext: LabLaunchContext; authorization: "APPROVED_LINK_CERTIFIED_LAB";
}>;
export type LessonExperienceDelivery = DeliveryIdentity & Readonly<{
  contractVersion: "lesson-experience-delivery/1.1.0";
  routeTarget: LessonRouteTarget;
  serverCompletion: { completedAt: string } | null;
  compatibility: "NATIVE_V2" | "LEGACY_COMPATIBLE";
  title: string; subject: string; grade: number; ageBand: LessonExperience["ageBand"] | null;
  objectives: LessonExperience["objectives"]; objectiveIds: readonly string[];
  scenes: readonly LearnerScene[]; sceneIds: readonly string[];
  authorizedLabLinks: readonly AuthorizedLabLink[]; assessmentRefs: readonly AssessmentHandoff[];
  legacyPayload: ReturnType<typeof projectStudentLessonPayload> | null;
  evidenceDisposition: Readonly<{ status: EvidenceDisposition; authoritativeSubmission: false; masteryMutation: false; nextActionAuthority: "LEARNING_ORCHESTRATOR"; handoff: "EXISTING_GOVERNED_EVIDENCE_ADAPTER"; submissionEndpoint: null }>;
  offlinePolicy: Readonly<{ presentation: "READ_ONLY_AFTER_AUTHORIZED_CACHE"; authoritativeSubmission: false; reauthorizeOnReconnect: true; purgeOnAccessLoss: true; versionMismatch: "INCOMPATIBLE_VERSION"; trust: "ONLINE_SERVER_RESOLUTION_REQUIRED" }>;
  provenance: Readonly<{ provenanceId: string | null; revisionId: string | null; approvalId: string | null; releaseSourceRef: string | null }>;
}>;

export class LessonDeliveryError extends Error {
  constructor(public readonly status: number, public readonly code: "UNAVAILABLE" | "FORBIDDEN" | "INCOMPATIBLE_VERSION", public readonly format?: "NATIVE_V2", public readonly reason?: "NOT_RELEASED" | "REVOKED" | "NOT_STUDENT_READY") { super(code); }
}
function unavailable(): never { throw new LessonDeliveryError(404, "UNAVAILABLE"); }

/** This comparison is advisory presentation state, never an admission token. */
export function deliveryTrustDisposition(cached: DeliveryIdentity, current: DeliveryIdentity | null, online: boolean): EvidenceDisposition {
  if (!online) return "OFFLINE_PENDING";
  if (!current) return "READ_ONLY";
  if (["lessonId", "lessonVersion", "releaseId", "releaseIdentity", "revisionId"].some((key) => cached[key as keyof DeliveryIdentity] !== current[key as keyof DeliveryIdentity])) return "INCOMPATIBLE_VERSION";
  return "OBSERVATION_ONLY";
}

/** Links come only from the exact approved revision; certification remains independent of showcase access. */
export function resolveAuthorizedLabLinks(experience: LessonExperience, links: readonly LearningExperienceLink[], target: LessonRouteTarget = { kind: "CONTENT", contentId: experience.id }): AuthorizedLabLink[] {
  return links.flatMap((link) => {
    try {
      const lab = findLabExperience(link.experience.labId);
      if (!lab || !isLinkStudentVisible(link, experience, lab) || !isGradeAppropriate(lab, experience.grade)) return [];
      validateExperienceLink(link, experience, lab);
      const returnTarget = { route: target, sceneId: link.placement.sceneId };
      const launchContext: LabLaunchContext = { v: 1, labId: lab.labId, labVersion: lab.version, linkId: link.linkId, origin: { experienceId: experience.id, experienceVersion: experience.version, sceneId: link.placement.sceneId, objectiveIds: link.objectiveIds, activityId: target.kind === "SCHEDULED_WORK" ? target.scheduledWorkId : experience.id } };
      return [{ linkId: link.linkId, labId: lab.labId, labVersion: lab.version, label: lab.title, sceneId: link.placement.sceneId,
        returnTarget, launchContext, authorization: "APPROVED_LINK_CERTIFIED_LAB" as const }];
    } catch { return []; }
  });
}

/** Call inside one repeatable-read transaction so approval, row and access form one snapshot. */
export async function resolveLessonDelivery(
  tx: Prisma.TransactionClient, user: { id: string; role: string; schoolId?: string | null }, lessonRef: string, requestedVersion?: string, routeKind?: LessonRouteTarget["kind"],
): Promise<LessonExperienceDelivery> {
  if (user.role !== "STUDENT") throw new LessonDeliveryError(403, "FORBIDDEN");
  if (!user.schoolId) unavailable();
  const scope = await loadLearnerScope(tx, user);
  const include = { provenance: { include: { currentRevision: true } }, curriculumVersion: { select: { status: true } } } as const;
  let serverCompletion: { completedAt: string } | null = null;
  let target: LessonRouteTarget = { kind: "CONTENT", contentId: lessonRef };
  let row = routeKind === "SCHEDULED_WORK" ? null : await tx.curriculumContent.findUnique({ where: { contentId: lessonRef }, include });
  if (!row && routeKind !== "CONTENT") {
    const work = await tx.scheduledWork.findUnique({ where: { id: lessonRef }, include: { content: { include }, class: { select: { schoolId: true } }, progress: { where: { studentId: user.id }, select: { completedAt: true } } } });
    if (!work || work.class.schoolId !== user.schoolId || !scope.classIds.includes(work.classId)) unavailable();
    row = work.content;
    const completedAt = work.progress?.[0]?.completedAt;
    serverCompletion = completedAt ? { completedAt: completedAt.toISOString() } : null;
    target = { kind: "SCHEDULED_WORK", scheduledWorkId: work.id ?? lessonRef, contentId: row.contentId };
  }
  if (!row) unavailable();
  // Do not disclose format/lifecycle until school, class and metadata authorization pass.
  if (row.contentType.toUpperCase() !== "LESSON" || !learnerMetadataAllowed(row) || !await learnerScopeAllows(tx, row, scope)) unavailable();
  const native = isNativeCurriculumV2Payload(row.payload);
  const denyNative = (reason: "NOT_RELEASED" | "REVOKED" | "NOT_STUDENT_READY"): never => { throw new LessonDeliveryError(reason === "REVOKED" ? 410 : 404, "UNAVAILABLE", "NATIVE_V2", reason); };
  if (native && row.provenance?.lifecycleState === "REVOKED") denyNative("REVOKED");
  if (!["published", "APPROVED"].includes(row.status) || !learnerLifecycleAllowed(row.provenance)) {
    if (native) denyNative("NOT_RELEASED");
    unavailable();
  }
  if (requestedVersion !== undefined && requestedVersion !== row.version) throw new LessonDeliveryError(409, "INCOMPATIBLE_VERSION", native ? "NATIVE_V2" : undefined);
  const projected = projectStudentLessonPayload(row.payload);
  if (projected.studentReady !== true) {
    if (native) denyNative("NOT_STUDENT_READY");
    unavailable();
  }
  let experience: LessonExperience | null = null;
  let authorizedLabLinks: AuthorizedLabLink[] = [];
  let assessmentRefs: AssessmentHandoff[] = [];
  let scenes: LearnerScene[] = [];
  let approvalId: string | null = null;
  let releaseSourceRef: string | null = null;
  if (native) {
    try {
      experience = projected.lessonExperience as LessonExperience;
      validateLessonExperience(experience);
      if (experience.id !== row.contentId || experience.version !== row.version || experience.grade !== row.grade || experience.subject !== String(row.subject)) unavailable();
      const revision = row.provenance?.currentRevision;
      if (!revision || row.provenance?.lifecycleState !== "APPROVED" || revision.id !== row.provenance.currentRevisionId || revision.snapshotSchemaVersion !== CURRICULUM_SNAPSHOT_SCHEMA_VERSION_NATIVE) unavailable();
      const snapshot = buildCurriculumContentSnapshot(row);
      if (hashCurriculumSnapshot(snapshot.schemaVersion, snapshot.snapshot) !== revision.contentHash) unavailable();
      const [latestRevision, approval] = await Promise.all([
        tx.curriculumContentRevision.findFirst({ where: { provenanceId: row.provenance.id }, orderBy: { sequence: "desc" }, select: { id: true } }),
        tx.curriculumGovernanceEvent.findFirst({ where: { provenanceId: row.provenance.id, lifecycleResult: { not: null } }, orderBy: { sequence: "desc" } }),
      ]);
      if (latestRevision?.id !== revision.id || !approval || approval.revisionId !== revision.id || approval.lifecycleResult !== "APPROVED" || !(NATIVE_APPROVAL_EVENTS as readonly string[]).includes(approval.eventType)) unavailable();
      assertNativeCurriculumV2Approval({ native: true, writersEnabled: true, eventType: approval.eventType, approvalBasis: approval.approvalBasis,
        actorType: approval.actorType, actorUserId: approval.actorUserId, reviewAuthority: approval.reviewAuthority,
        hasQualification: Boolean(approval.reviewerQualificationRef?.trim()) && approval.reviewerQualificationSnapshot != null,
        revisionSnapshotSchemaVersion: revision.snapshotSchemaVersion, nativeSnapshotSchemaVersion: CURRICULUM_SNAPSHOT_SCHEMA_VERSION_NATIVE });
      const release = experience.authority.releaseId ? publishedRelease(experience.authority.releaseId) : null;
      if (!release || release.status !== "PUBLISHED" || release.reviewStatus !== "APPROVED" || release.grade !== row.grade || release.subject !== String(row.subject) || deterministicReleaseIdentity(release) !== experience.authority.releaseIdentity) unavailable();
      const bindings = release.contentBindings.filter((binding) => binding.contentType === "LESSON" && binding.contentId === row.contentId && binding.contentVersion === row.version);
      if (!bindings.length || bindings.some((binding) => binding.contentSha256 && binding.contentSha256 !== lessonPayloadSha256(row.payload))) unavailable();
      const inventory = governedInventoryForRelease(release);
      const lesson = inventory.lessons.find((entry) => entry.contentId === row.contentId && entry.version === row.version);
      if (!lesson || experience.objectives.some((objective) =>
        !lesson.objectiveIds.includes(objective.id) || !lesson.conceptIds.includes(objective.conceptId) ||
        !inventory.concepts.some((concept) => concept.conceptId === objective.conceptId && concept.objectiveId === objective.id) ||
        !bindings.some((binding) => binding.conceptId === objective.conceptId))) unavailable();
      if (new Set(experience.objectives.map((objective) => objective.id)).size !== experience.objectives.length || experience.scenes.some((scene) => !scene.id.trim())) unavailable();
      experience = { ...experience, authority: { status: "APPROVED_RELEASE", note: "Server-resolved exact-revision release", candidateContentIds: [], releaseId: release.id, releaseIdentity: deterministicReleaseIdentity(release) } };
      const artifact = (row.payload as Record<string, unknown>)[CURRICULUM_V2_PAYLOAD_KEY] as CurriculumLessonV2;
      authorizedLabLinks = resolveAuthorizedLabLinks(experience, artifact.labLinks.map((entry) => entry.link), target);
      scenes = experience.scenes.map((scene): LearnerScene => {
        if (scene.interaction.kind === "MULTIPLE_CHOICE") return { ...scene, interaction: { kind: "MULTIPLE_CHOICE", feedbackAuthority: "SERVER_REQUIRED", items: scene.interaction.items.map(({ id, prompt, options }) => ({ id, prompt, options })) } };
        if (scene.interaction.kind === "LAB_LAUNCH" && !authorizedLabLinks.some((link) => link.linkId === (scene.interaction as { linkId: string }).linkId)) return { ...scene, interaction: { kind: "NONE" }, completion: { kind: "VIEWED" }, evidence: { kind: "NONE" } };
        if (scene.interaction.kind !== "ASSESSMENT_HANDOFF") return { ...scene, interaction: scene.interaction };
        const ref = scene.interaction.assessment;
        // Every item must exist in this published release and map to a lesson objective.
        const items = ref.items.map((refItem) => {
          const item = release.items.find((candidate) => candidate.id === refItem.itemId && candidate.version === refItem.itemVersion);
          if (!item || !inventory.activities.some((activity) => activity.activityId === item.id && activity.activityVersion === item.version && ref.objectiveIds.includes(activity.objectiveId))) unavailable();
          return { itemId: item.id, itemVersion: item.version, prompt: item.prompt, options: [...item.options] };
        });
        if (!items.length || ref.objectiveIds.some((id) => !lesson.objectiveIds.includes(id))) unavailable();
        const assessment: AssessmentHandoff = { assessmentId: ref.assessmentId, assessmentVersion: ref.assessmentVersion, player: "ASSESSMENT_PLAYER_V2", objectiveIds: ref.objectiveIds, scoring: "SERVER_AUTHORITY", items };
        assessmentRefs.push(assessment);
        return { ...scene, interaction: { kind: "ASSESSMENT_HANDOFF", assessment } };
      });
      approvalId = approval.id;
      releaseSourceRef = release.provenanceRef;
    } catch { denyNative("NOT_RELEASED"); }
  }
  return {
    contractVersion: "lesson-experience-delivery/1.1.0", routeTarget: target, serverCompletion, compatibility: native ? "NATIVE_V2" : "LEGACY_COMPATIBLE",
    lessonId: row.contentId, lessonVersion: row.version, releaseId: experience?.authority.releaseId ?? null, releaseIdentity: experience?.authority.releaseIdentity ?? null,
    revisionId: row.provenance?.currentRevisionId ?? null, title: experience?.title ?? (typeof projected.title === "string" ? projected.title : row.contentId), subject: String(row.subject), grade: row.grade,
    ageBand: experience?.ageBand ?? null, objectives: experience?.objectives ?? [], objectiveIds: experience?.objectives.map((objective) => objective.id) ?? [],
    scenes, sceneIds: scenes.map((scene) => scene.id), authorizedLabLinks, assessmentRefs, legacyPayload: native ? null : projected,
    evidenceDisposition: { status: "OBSERVATION_ONLY", authoritativeSubmission: false, masteryMutation: false, nextActionAuthority: "LEARNING_ORCHESTRATOR", handoff: "EXISTING_GOVERNED_EVIDENCE_ADAPTER", submissionEndpoint: null },
    offlinePolicy: { presentation: "READ_ONLY_AFTER_AUTHORIZED_CACHE", authoritativeSubmission: false, reauthorizeOnReconnect: true, purgeOnAccessLoss: true, versionMismatch: "INCOMPATIBLE_VERSION", trust: "ONLINE_SERVER_RESOLUTION_REQUIRED" },
    provenance: { provenanceId: row.provenance?.id ?? null, revisionId: row.provenance?.currentRevisionId ?? null, approvalId, releaseSourceRef },
  };
}
