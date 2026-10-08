import { createHash } from "node:crypto";
import { lessonPayloadSha256 } from "@/lib/learning-authority/releases/grade4Math2026_2";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { buildCurriculumContentSnapshotV1 } from "@/lib/curriculum/provenance/snapshot";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { getCanonicalSubjectCode } from "@/lib/curriculum/subjectTaxonomy";
import { publishedRelease, publishedReleaseForLearner } from "@/lib/learning-authority/publishedReleases";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import type { LessonExperience } from "@/lib/learner-experience/types";
import type { RetrievedChunk } from "@/lib/ai/rag/retrievalService";
import type { TutorAction, TutorGroundingStrength, TutorIdentity, TutorSourceTier } from "./contextContract";

const include = {
  curriculumVersion: true,
  provenance: { include: { currentRevision: true, revisions: { orderBy: { sequence: "desc" as const }, take: 1 } } },
} satisfies Prisma.CurriculumContentInclude;
type LessonRow = Prisma.CurriculumContentGetPayload<{ include: typeof include }>;
type Scope = { schoolId: string; userId: string; grade: number; subjects: string[]; classIds: string[] };

export type TutorContextPackage = {
  contractVersion: "tutor-context/2";
  schoolId: string;
  learnerScopeKey: string;
  grade: number;
  subject: string | null;
  lesson: { id: string; contentId: string; title: string; version: string; revisionId: string | null } | null;
  unitId: string | null;
  releaseId: string | null;
  experienceId: string | null;
  experienceVersion: string | null;
  sceneId: string | null;
  objectiveIds: string[];
  objectiveStatements: string[];
  allowedRelatedContentIds: string[];
  action: TutorAction;
  sourcePolicy: "LEARNER_PROJECTED_LESSONS_ONLY";
  sources: RetrievedChunk[];
  groundingStrength: TutorGroundingStrength;
  fallbackReason?: string;
  /** Pins safe text as well as revision identity; never reuse a revoked source cache. */
  fingerprint: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
function subject(value: string): string { return getCanonicalSubjectCode(value) ?? value.trim().toUpperCase(); }
function denied(): never { throw Object.assign(new Error("This lesson context is unavailable for your account."), { status: 404 }); }
function stale(): never { throw Object.assign(new Error("This lesson has changed. Reopen it before asking the tutor."), { status: 409 }); }

/** Exclude secret-bearing text rather than creating a competing curriculum projection. */
export function hasRestrictedTutorText(value: string): boolean {
  return /(?:^|\n)\s*#{1,6}\s*(?:answer\s*(?:key|guide)|teacher\s*(?:notes|guide|explanation)|scoring\s*rubric|expected\s*(?:answer|response)|mastery\s*check\s*answers)\b/i.test(value)
    || /["']?(?:answerKey|correctIndex|expectedAnswer|expectedResponse|scoringRubric|teacherNotes)["']?\s*[:=]/i.test(value);
}

function eligible(row: LessonRow, scope: Scope): boolean {
  if (!scope.subjects.includes(subject(row.subject)) || row.grade !== scope.grade) return false;
  if (row.schoolId && row.schoolId !== scope.schoolId) return false;
  if (!["published", "approved"].includes(row.status.toLowerCase())) return false;
  if (row.contentType.toLowerCase() !== "lesson" || row.lessonType?.toLowerCase() === "assessment") return false;
  if (/\[assessment\]/i.test(row.title ?? "")) return false;
  if (row.versionId && row.curriculumVersion?.status !== "ACTIVE") return false;
  const payload = record(row.payload);
  const audience = text(payload.audience || payload.visibility).toLowerCase();
  if (["teacher", "teacher_only", "staff", "private"].includes(audience) || payload.teacherOnly === true) return false;
  if (["teacher_only", "private"].includes(row.visibility)) return false;
  const provenance = row.provenance;
  if (provenance) {
    const revision = provenance.currentRevision;
    if (provenance.lifecycleState !== "APPROVED" || !revision || provenance.revisions[0]?.id !== revision.id) return false;
    // Reuse the existing revision contract. Tutor cannot bless drifted projections.
    if (revision.snapshotSchemaVersion !== 1 || hashCurriculumSnapshot(1, buildCurriculumContentSnapshotV1(row)) !== revision.contentHash) return false;
  }
  return true;
}

function learnerBody(projected: Record<string, unknown>): string {
  const body = text(projected.body_standard) || text(projected.body);
  return hasRestrictedTutorText(body) ? "" : body;
}

export function tutorStrength(sources: RetrievedChunk[]): TutorGroundingStrength {
  const tiers = sources.filter((source) => source.content.trim()).map((source) => source.tutorTier ?? 3);
  return tiers.some((tier) => tier <= 1) ? "STRONG" : tiers.includes(2) ? "MEDIUM" : "WEAK";
}

/** Scope order is deterministic. Semantic scores only order candidates within a tier. */
export function rankTutorSources(sources: RetrievedChunk[], topK = 5): RetrievedChunk[] {
  return [...sources].sort((a, b) => (a.tutorTier ?? 3) - (b.tutorTier ?? 3) || b.rankingScore - a.rankingScore)
    .filter((source) => source.content.trim() && !hasRestrictedTutorText(source.content)).slice(0, topK);
}

function chunk(row: LessonRow, title: string, content: string, tier: TutorSourceTier, kind: string, suffix = "lesson"): RetrievedChunk {
  return {
    id: `tutor:${row.id}@${row.version}:${suffix}`, sourceId: row.id, sourceType: "lesson",
    title, content: content.slice(0, 12000), chunkIndex: 0, subject: row.subject, grade: row.grade,
    schoolId: row.schoolId, scope: row.schoolId ? "SCHOOL" : "GLOBAL", sourceLabel: kind,
    similarity: 0, rankingScore: 0, tutorTier: tier,
    metadata: { version: row.version, revisionId: row.provenance?.currentRevisionId ?? null, learnerProjected: true, kind },
  };
}

function finish(context: Omit<TutorContextPackage, "fingerprint" | "groundingStrength">): TutorContextPackage {
  const sources = rankTutorSources(context.sources);
  return { ...context, sources, groundingStrength: tutorStrength(sources), fingerprint: createHash("sha256").update(JSON.stringify({ ...context, sources })).digest("hex") };
}

/** Resolve on every request, before answer-cache lookup. Identifiers cannot widen scope. */
export async function resolveTutorContext(
  user: Pick<SessionUser, "id" | "role" | "schoolId">,
  identity: TutorIdentity,
  action: TutorAction = "explain",
): Promise<TutorContextPackage> {
  if (user.role !== "STUDENT" || !user.schoolId) denied();
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { userId: user.id },
      select: { id: true, currentGrade: true, deletedAt: true, enrollments: { select: { classId: true, Class: { select: { subject: true, schoolId: true } } } } },
    });
    if (!student?.currentGrade || student.deletedAt) denied();
    const enrollments = student.enrollments.filter((enrollment) => enrollment.Class.schoolId === user.schoolId);
    const scope: Scope = { schoolId: user.schoolId!, userId: user.id, grade: student.currentGrade, subjects: [...new Set(enrollments.map((e) => subject(String(e.Class.subject))))], classIds: enrollments.map((e) => e.classId) };
    if (!scope.subjects.length) denied();
    const empty = {
      contractVersion: "tutor-context/2" as const, schoolId: scope.schoolId, learnerScopeKey: createHash("sha256").update(user.id).digest("hex"),
      grade: scope.grade, subject: null, lesson: null, unitId: null, releaseId: null, experienceId: null, experienceVersion: null,
      sceneId: null, objectiveIds: [], objectiveStatements: [], allowedRelatedContentIds: [], action,
      sourcePolicy: "LEARNER_PROJECTED_LESSONS_ONLY" as const, sources: [],
    };
    const ref = identity.lessonId ?? identity.contentId;
    if (!ref) {
      if (identity.sceneId || identity.objectiveIds?.length || identity.experienceId || identity.releaseId) denied();
      return finish({ ...empty, fallbackReason: "lesson_context_required" });
    }
    // A ScheduledWork reference must belong to an enrolled class in this tenant.
    const work = identity.lessonId ? await tx.scheduledWork.findFirst({
      where: { id: identity.lessonId, classId: { in: scope.classIds }, class: { schoolId: scope.schoolId } }, select: { contentId: true },
    }) : null;
    const row = await tx.curriculumContent.findFirst({
      where: { OR: [{ id: work?.contentId ?? ref }, { contentId: work?.contentId ?? ref }], AND: [{ OR: [{ schoolId: null }, { schoolId: scope.schoolId }] }] }, include,
    });
    if (!row || !eligible(row, scope)) denied();
    if (identity.contentId && identity.contentId !== row.contentId) denied();
    if (identity.lessonVersion && identity.lessonVersion !== row.version) stale();
    if (identity.revisionId && identity.revisionId !== row.provenance?.currentRevisionId) stale();
    const mayRead = async (candidate: LessonRow) => {
      if (!candidate.teacherCreated && !candidate.schoolId) return true;
      if (candidate.schoolId !== scope.schoolId) return false;
      if (candidate.visibility === "school_wide") return true;
      const assigned = await tx.scheduledWork.findFirst({ where: { contentId: candidate.contentId, classId: { in: scope.classIds }, class: { schoolId: scope.schoolId } }, select: { id: true } });
      return Boolean(assigned || await tx.teacherLessonAssignment.findFirst({ where: { contentId: candidate.contentId, classId: { in: scope.classIds }, class: { schoolId: scope.schoolId } }, select: { id: true } }));
    };
    if (!await mayRead(row)) denied();
    const projected = projectStudentLessonPayload(row.payload);
    let experience: LessonExperience | null = null;
    if (projected.lessonExperience) {
      experience = projected.lessonExperience as LessonExperience;
      try { validateLessonExperience(experience); } catch { denied(); }
      const release = experience.authority.releaseId ? publishedRelease(experience.authority.releaseId) : null;
      const activeVersionMatches = row.curriculumVersion?.status === "ACTIVE" && [row.curriculumVersion.id, row.curriculumVersion.versionName].includes(experience.authority.releaseId ?? "");
      if (experience.authority.status !== "APPROVED_RELEASE" || (!release && !activeVersionMatches) || experience.grade !== row.grade || subject(experience.subject) !== subject(row.subject)) denied();
    }
    if ((identity.sceneId || identity.experienceId || identity.experienceVersion) && !experience) denied();
    if (identity.experienceId && identity.experienceId !== experience?.id) denied();
    if (identity.experienceVersion && identity.experienceVersion !== experience?.version) stale();
    const scene = identity.sceneId ? experience?.scenes.find((candidate) => candidate.id === identity.sceneId) : null;
    if (identity.sceneId && !scene) denied();
    const release = publishedReleaseForLearner(row.grade, subject(row.subject));
    const binding = release?.contentBindings.find((candidate) => candidate.contentId === row.contentId && candidate.contentVersion === row.version);
    const bindingValid = binding && (!binding.contentSha256 || binding.contentSha256 === lessonPayloadSha256(row.payload));
    const availableObjectiveIds = scene ? [...scene.objectiveIds] : experience ? experience.objectives.map((objective) => objective.id) : [];
    if (identity.objectiveIds?.some((id) => !availableObjectiveIds.includes(id))) denied();
    // Identifiers may select an objective only from this canonical scene/lesson.
    const objectiveIds = identity.objectiveIds?.length ? [...new Set(identity.objectiveIds)] : availableObjectiveIds;
    const objectives = experience ? experience.objectives.filter((objective) => objectiveIds.includes(objective.id)).map((objective) => objective.statement) : strings(projected.objectives);
    const sources: RetrievedChunk[] = [];
    const title = text(projected.title) || row.title || row.contentId;
    if (scene && !["MASTERY_CHECK", "CHECK_UNDERSTANDING"].includes(scene.type) && scene.interaction.kind !== "ASSESSMENT_HANDOFF" && !hasRestrictedTutorText(scene.content.body)) {
      sources.push(chunk(row, `${title}: ${scene.title}`, scene.content.body, 0, "Current scene", `scene:${scene.id}`));
    }
    const body = experience ? experience.scenes.filter((candidate) => !["MASTERY_CHECK", "CHECK_UNDERSTANDING"].includes(candidate.type) && candidate.interaction.kind !== "ASSESSMENT_HANDOFF" && (!objectiveIds.length || candidate.objectiveIds.some((id) => objectiveIds.includes(id))))
      .map((candidate) => candidate.content.body).filter((value) => !hasRestrictedTutorText(value)).join("\n\n") : learnerBody(projected);
    if (body) sources.push(chunk(row, title, body, 0, "Current lesson"));
    const relatedBindings = bindingValid ? release!.contentBindings.filter((candidate) => candidate.contentType === "LESSON" && candidate.contentId !== row.contentId && (candidate.conceptId === binding.conceptId || release!.prerequisites.some((edge) => edge.toConceptId === binding.conceptId && edge.fromConceptId === candidate.conceptId))) : [];
    // Do not query broad grade/subject until exact and explicitly linked scopes are exhausted.
    if (!sources.length) {
      const linkedIds = relatedBindings.map((candidate) => candidate.contentId);
      await collectRelated({ OR: [...(linkedIds.length ? [{ contentId: { in: linkedIds } }] : []), ...(row.unitId ? [{ unitId: row.unitId }] : [])] }, false);
    }
    if (!sources.length) await collectRelated({}, true);
    async function collectRelated(placement: Prisma.CurriculumContentWhereInput, broad: boolean) {
      let cursor: string | undefined;
      for (let page = 0; page < 5 && sources.length < 5; page++) {
        const candidates = await tx.curriculumContent.findMany({
          where: { ...placement, id: { not: row!.id }, grade: row!.grade, subject: row!.subject, versionId: row!.versionId,
            contentType: { equals: "lesson", mode: "insensitive" }, status: { in: ["published", "approved"], mode: "insensitive" },
            AND: [
              { OR: [{ lessonType: null }, { lessonType: { not: "assessment", mode: "insensitive" } }] },
              { OR: [
                { schoolId: null, teacherCreated: false },
                { schoolId: scope.schoolId, visibility: "school_wide" },
                { schoolId: scope.schoolId, scheduledWork: { some: { classId: { in: scope.classIds }, class: { schoolId: scope.schoolId } } } },
                { schoolId: scope.schoolId, teacherLessonAssignments: { some: { classId: { in: scope.classIds }, class: { schoolId: scope.schoolId } } } },
              ] },
              { OR: [{ provenance: null }, { provenance: { is: { lifecycleState: "APPROVED" } } }] },
            ],
          }, include, orderBy: { contentId: "asc" }, take: 20,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        for (const candidate of candidates) {
          if (!eligible(candidate, scope) || !await mayRead(candidate) || candidate.versionId !== row!.versionId) continue;
          const link = relatedBindings.find((item) => item.contentId === candidate.contentId);
          if (link && (link.contentVersion !== candidate.version || (link.contentSha256 && link.contentSha256 !== lessonPayloadSha256(candidate.payload)))) continue;
          const safe = projectStudentLessonPayload(candidate.payload);
          const relatedBody = learnerBody(safe);
          if (relatedBody) sources.push(chunk(candidate, text(safe.title) || candidate.title || candidate.contentId, relatedBody,
            broad ? 3 : link && link.conceptId === binding?.conceptId ? 1 : 2, broad ? "Other lesson in this subject" : "Supporting lesson"));
          if (sources.length >= 5) break;
        }
        if (candidates.length < 20) break;
        cursor = candidates.at(-1)!.id;
      }
    }
    const releaseId = experience?.authority.releaseId ?? (bindingValid ? release!.id : row.versionId);
    if (identity.releaseId && identity.releaseId !== releaseId) stale();
    return finish({ ...empty, subject: row.subject, lesson: { id: row.id, contentId: row.contentId, title, version: row.version, revisionId: row.provenance?.currentRevisionId ?? null },
      unitId: row.unitId, releaseId, experienceId: experience?.id ?? null, experienceVersion: experience?.version ?? null,
      sceneId: scene?.id ?? null, objectiveIds, objectiveStatements: objectives, allowedRelatedContentIds: relatedBindings.map((item) => item.contentId), sources,
      ...(!sources.length ? { fallbackReason: "approved_lesson_material_unavailable" } : {}),
    });
  }, { isolationLevel: "RepeatableRead" });
}

export function tutorIdentityFromContext(context: TutorContextPackage): TutorIdentity {
  return context.lesson ? {
    contentId: context.lesson.contentId, lessonVersion: context.lesson.version,
    ...(context.lesson.revisionId ? { revisionId: context.lesson.revisionId } : {}),
    ...(context.experienceId ? { experienceId: context.experienceId, experienceVersion: context.experienceVersion! } : {}),
    ...(context.sceneId ? { sceneId: context.sceneId } : {}), objectiveIds: context.objectiveIds,
    ...(context.releaseId ? { releaseId: context.releaseId } : {}),
  } : {};
}
