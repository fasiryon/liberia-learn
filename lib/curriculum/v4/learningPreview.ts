import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { loadDraft6Review, type VerifiedTeachingVersions } from "./draft6Review";
import { GRADE4_SCHOOLDAY_ACCEPTED, isRegisteredSchooldaySelection, loadSchooldayPackage } from "./schooldayPackage";
import { hash } from "@/lib/content-factory/v4/generation";
import type { LessonExperience, Scene } from "@/lib/learner-experience/types";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { geographicAttachments } from "@/lib/learner-experience/geography/draft6Binding";
import geography from "@/lib/learner-experience/geography/liberia-adm1-2021.json";

export const LEARNING_PREVIEW_POLICY_KEY = "V4_DRAFT6_LEARNING_PREVIEW";
export const PILOT_RELEASE_APPROVAL_KEY = "V4_PILOT_RELEASE_APPROVAL";
// Conditional AI acceptance permits preparation; it is not publication or pilot approval.
export const CONDITIONALLY_ACCEPTED = {
  "g7-math-area-perimeter": "86066251a231c08dc7a500cd02b72b32eeb5396fefed00c6c83cb459cf2fb254",
  "g7-math-fractions": "ffaafcbb124def71114178a07736acf7c3609aa1debf36e413b4bdf1a5aae69a",
  "math-multiplication-models": "7a469baccfb5d7d1e932942baf013e1848579c4efa9077a949dcebb7542d75ce",
  "g7-science-states-of-matter": "7863152eba2e51b818a1b304fa0b240f7b0ac0d2656406947488fbc93ae912f9",
  "g7-english-reading-evidence": "fa54d6f4d508a81020bcf18c906a948a8c1c0e74ec1f384aa9c088acb289be19",
  "g7-civics-counties-capitals": "2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb",
} satisfies Record<string, string>;
export {isLearningPreviewEnabled} from "./previewFlag";
export { GRADE4_SCHOOLDAY_ACCEPTED, loadSchooldayPackage } from "./schooldayPackage";
const DRAFT6_SELECTION = /^factory@4\.0\.0-draft\.6@[a-z0-9-]+$/;
/** The exact registered hash for a selection: the draft.6 table by key, or the 8 Grade 4 school-day selections exactly. */
function registeredHash(selection: string): string | undefined {
  if (isRegisteredSchooldaySelection(selection)) return GRADE4_SCHOOLDAY_ACCEPTED[selection];
  if (!DRAFT6_SELECTION.test(selection)) return undefined;
  const key = selection.split("@")[2];
  return Object.prototype.hasOwnProperty.call(CONDITIONALLY_ACCEPTED, key) ? CONDITIONALLY_ACCEPTED[key as keyof typeof CONDITIONALLY_ACCEPTED] : undefined;
}
/** Same one-pass URL boundary as the existing V4 review route. No double decode or aliases. */
export function parsePreviewSelection(raw: string): string | null {
  try {
    const selection = raw.includes("%") ? decodeURIComponent(raw) : raw;
    // Draft.6 by pattern (the hash table still decides), or one of the 8 Grade 4 school-day selections exactly.
    return DRAFT6_SELECTION.test(selection) || isRegisteredSchooldaySelection(selection) ? selection : null;
  } catch { return null; }
}
const reference = z.string().trim().min(1).max(500);
const identity = z.string().min(1).max(128);
export const previewPolicySchema = z.strictObject({
  version: z.literal("learning-preview/1.0.0"), status: z.literal("PILOT_ONLY"), enabled: z.boolean(),
  revokedAt: z.string().datetime().nullable(), startsAt: z.string().datetime(), endsAt: z.string().datetime(),
  schoolId: identity, studentUserIds: z.array(identity).max(1024), classIds: z.array(identity).min(1).max(64),
  canonicalRecordWrites: z.literal(false), offlineDelivery: z.boolean(), offlineMaxAgeSeconds: z.number().int().min(60).max(1800).optional(),
  lessons: z.array(z.strictObject({ selection: z.string().refine(value => DRAFT6_SELECTION.test(value) || isRegisteredSchooldaySelection(value), "Registered selection required"),
    packageHash: z.string().regex(/^[a-f0-9]{64}$/), revokedAt: z.string().datetime().nullable(), approvalRecordId: identity,
    classIds: z.array(identity).min(1).max(64).optional(),
    timetable: z.array(z.strictObject({ classId: identity, timetableId: identity, subject: z.string().min(1).max(80) })).min(1).max(128).optional(),
    reviews: z.strictObject({ content: reference, rights: reference,
      access: reference, accessibility: reference, safety: reference, runtime: reference, releaseAuthorization: reference }) })).max(128),
}).superRefine((policy, ctx) => {
  const duration = Date.parse(policy.endsAt) - Date.parse(policy.startsAt);
  if (duration <= 0 || duration > 14 * 24 * 60 * 60 * 1000) ctx.addIssue({ code: "custom", message: "Finite window of at most 14 days required" });
  if (new Set(policy.lessons.map(lesson => lesson.selection)).size !== policy.lessons.length)
    ctx.addIssue({ code: "custom", message: "Duplicate lesson selection" });
  if (policy.offlineDelivery && policy.offlineMaxAgeSeconds === undefined)
    ctx.addIssue({ code: "custom", message: "Explicit bounded offline validity required" });
  if(new Set(policy.classIds).size!==policy.classIds.length || new Set(policy.studentUserIds).size!==policy.studentUserIds.length)
    ctx.addIssue({code:"custom",message:"Duplicate cohort identity"});
  for(const lesson of policy.lessons) {
    if(registeredHash(lesson.selection)!==lesson.packageHash) ctx.addIssue({code:"custom",message:"Exact registered candidate required"});
    if(policy.classIds.length>1 && !lesson.classIds?.length) ctx.addIssue({code:"custom",message:"Multiple-class policy requires per-lesson cohorts"});
    if(lesson.classIds?.some(id=>!policy.classIds.includes(id)) || lesson.classIds && new Set(lesson.classIds).size!==lesson.classIds.length)
      ctx.addIssue({code:"custom",message:"Invalid per-lesson cohort"});
    if(lesson.timetable?.some(binding=>!(lesson.classIds??policy.classIds).includes(binding.classId)) || lesson.timetable && new Set(lesson.timetable.map(b=>b.timetableId)).size!==lesson.timetable.length)
      ctx.addIssue({code:"custom",message:"Invalid timetable binding"});
  }
});
type PreviewUser = { id: string; role: string; schoolId?: string | null };
export type PilotTimetableBinding = { timetableId: string; classId: string; subject: string };

/** Trusted server policy, never request parameters. References point to real reviews; they are not approvals. */
export function authorizeLearningPreview(raw: unknown, user: PreviewUser | null, selection: string, now: number) {
  const parsed = previewPolicySchema.safeParse(raw);
  if (!parsed.success || !user || !Number.isFinite(now)) return null;
  const policy = parsed.data;
  if (!policy.enabled || policy.revokedAt !== null || user.role !== "STUDENT" || user.schoolId !== policy.schoolId ||
    !policy.studentUserIds.includes(user.id) || now < Date.parse(policy.startsAt) || now >= Date.parse(policy.endsAt)) return null;
  const entry = policy.lessons.find(lesson => lesson.selection === selection);
  const accepted = registeredHash(selection);
  return entry && entry.revokedAt === null && accepted !== undefined && accepted === entry.packageHash ? { ...entry, expiresAt: policy.endsAt, policy } : null;
}

export function pilotApprovalBinding(policy: z.infer<typeof previewPolicySchema>, selection: string, packageHash: string) {
  const entry = policy.lessons.find(lesson => lesson.selection === selection);
  if (!entry) throw Error("pilot_approval_selection_missing");
  return hash({ status: "PILOT_ONLY", schoolId: policy.schoolId, classIds: policy.classIds.slice().sort(),
    studentUserIds: policy.studentUserIds.slice().sort(), startsAt: policy.startsAt, endsAt: policy.endsAt, selection, packageHash,
    reviews: entry.reviews, approvalRecordId: entry.approvalRecordId,
    ...(entry.classIds ? {lessonClassIds:entry.classIds.slice().sort()} : {}),
    ...(entry.timetable ? {timetable:entry.timetable.slice().sort((a,b)=>a.timetableId===b.timetableId?0:a.timetableId<b.timetableId?-1:1)} : {}),
    ...(policy.offlineDelivery ? {offlineDelivery:true,offlineMaxAgeSeconds:policy.offlineMaxAgeSeconds} : {}) });
}

export function pilotExperience(source: LessonExperience, teachingVersions?: VerifiedTeachingVersions): LessonExperience {
  const noAssessment = "No graded assessment is available in this pilot. Your practice does not change grades, mastery, promotion or assignments.";
  const experience: LessonExperience = { ...source, id: `pilot:${source.id}`, offline: { packageable: false, requiredAssets: [] },
    scenes: source.scenes.map((scene): Scene => ({ ...scene,
      tools: { allowed: [], prohibited: scene.tools.prohibited },
      offline: { mode: "ONLINE_ONLY", fallback: "Reconnect to verify pilot access." }, evidence: { kind: "NONE" },
      ...(scene.type === "MASTERY_CHECK" || scene.interaction.kind === "ASSESSMENT_HANDOFF" ? {
        type: "REVIEW", title: "Pilot practice only", content: { body: noAssessment }, interaction: { kind: "NONE" },
        completion: { kind: "VIEWED" }, teaching: undefined,
      } : {}),
    })) };
  validateLessonExperience(experience, teachingVersions);
  return experience;
}

/** No cache or policy fallback. Each request sees cohort removal, expiry and revocation in the primary DB. */
export async function authorizeStudentLearningPreview(db: Pick<PrismaClient, "user" | "policyConfig" | "auditLog">,
  user: PreviewUser, selection: string, now = Date.now(), expectedTimetable?: PilotTimetableBinding) {
  if (user.role !== "STUDENT" || !user.schoolId) return null;
  const current = await db.user.findUnique({ where: { id: user.id }, select: {
    id: true, role: true, schoolId: true, school: { select: { status: true } },
    student: { select: { deletedAt: true, enrollments: { select: { Class: { select: { id: true, schoolId: true } } } },
      academicEnrollments: { select: { schoolId: true, status: true, academicYear: { select: { isActive: true, startDate: true, endDate: true } } } } } },
  } });
  if (!current || current.role !== "STUDENT" || current.schoolId !== user.schoolId ||
    current.school?.status !== "ACTIVE" || !current.student || current.student.deletedAt) return null;
  const policies = await db.policyConfig.findMany({ where: { policyKey: LEARNING_PREVIEW_POLICY_KEY,
    scope: "SCHOOL", schoolId: current.schoolId, isActive: true }, select: { config: true }, take: 2 });
  if (policies.length !== 1) return null;
  const admission = authorizeLearningPreview(policies[0].config, current, selection, now);
  if (!admission) return null;
  if (!current.student.enrollments.some(({ Class: roster }) => roster.schoolId === current.schoolId && (admission.classIds??admission.policy.classIds).includes(roster.id))) return null;
  // A day link requires this exact currently enrolled class and operator-bound slot.
  // Admission through another eligible class is insufficient for a scheduled link.
  if (expectedTimetable && (!current.student.enrollments.some(({Class: roster}) =>
    roster.schoolId === current.schoolId && roster.id === expectedTimetable.classId) ||
    !admission.timetable?.some(binding => binding.timetableId === expectedTimetable.timetableId &&
      binding.classId === expectedTimetable.classId && binding.subject === expectedTimetable.subject))) return null;
  if (current.student.academicEnrollments.length && !current.student.academicEnrollments.some(enrollment =>
    enrollment.schoolId === current.schoolId && enrollment.status === "ACTIVE" && enrollment.academicYear.isActive &&
    enrollment.academicYear.startDate.getTime() <= now && enrollment.academicYear.endDate.getTime() >= now)) return null;
  // Separate operator-authored authorization, linked to its real audit record. This pathway creates neither.
  const approval = await db.policyConfig.findUnique({ where: { id: admission.approvalRecordId }, select: {
    id: true, policyKey: true, scope: true, schoolId: true, isActive: true, config: true,
    createdById: true, createdBy: { select: { role: true, isPlatformAdmin: true } },
  } });
  const approvalSchema = z.strictObject({ status: z.literal("AUTHORIZED_PILOT_RELEASE"), bindingSha256: z.string(), auditLogId: z.string().min(1) });
  const approved = approvalSchema.safeParse(approval?.config);
  if (!approval || !approval.isActive || approval.policyKey !== PILOT_RELEASE_APPROVAL_KEY || approval.scope !== "SCHOOL" ||
    approval.schoolId !== current.schoolId || !approval.createdBy.isPlatformAdmin || approval.createdBy.role !== "ADMIN" || !approved.success ||
    approved.data.bindingSha256 !== pilotApprovalBinding(admission.policy, selection, admission.packageHash)) return null;
  const audit = await db.auditLog.findUnique({ where: { id: approved.data.auditLogId }, select: {
    userId: true, action: true, resourceId: true, resourceType: true, schoolId: true, details: true,
  } });
  if (!audit || audit.userId !== approval.createdById || audit.action !== "V4_PILOT_RELEASE_AUTHORIZED" ||
    audit.resourceId !== approval.id || audit.resourceType !== "PolicyConfig" || audit.schoolId !== current.schoolId ||
    !z.object({ bindingSha256: z.literal(approved.data.bindingSha256) }).safeParse(audit.details).success) return null;
  return { status: "PILOT_ONLY" as const, identity: { selection, packageHash: admission.packageHash, candidateVersion: selection.split("@")[1] }, expiresAt: admission.expiresAt,
    offlineAuthorization: admission.policy.offlineDelivery ? { mode:"MEMORY_ONLY" as const, issuedAt:new Date(now).toISOString(), validUntil:new Date(Math.min(Date.parse(admission.expiresAt),now+admission.policy.offlineMaxAgeSeconds!*1000)).toISOString(), maxAgeSeconds:admission.policy.offlineMaxAgeSeconds! } : null };
}

/** Every new content delivery verifies all sealed file bytes. Heartbeats deliver no content. */
export async function loadStudentLearningPreview(db: Pick<PrismaClient, "user" | "policyConfig" | "auditLog">,
  user: PreviewUser, selection: string, now = Date.now(), expectedTimetable?: PilotTimetableBinding) {
  const admission = await authorizeStudentLearningPreview(db, user, selection, now, expectedTimetable);
  if (!admission) return null;
  // The 8 Grade 4 school-day packages load only through their sealed loader; everything else stays draft.6.
  const loaded = isRegisteredSchooldaySelection(selection) ? loadSchooldayPackage(selection) : loadDraft6Review(selection);
  if (loaded.identity.packageHash !== admission.identity.packageHash) return null;
  // Derived pilot view only. The sealed projection and its draft authority remain unchanged.
  const experience = pilotExperience(loaded.experience, loaded.teachingVersions);
  const sceneAttachments=geographicAttachments(loaded.identity,experience.scenes.map(scene=>scene.id));
  if(selection.endsWith("@g7-civics-counties-capitals")&&!sceneAttachments["generated-1"]) throw Error("draft6_review_map_binding_missing");
  const offlineIntegritySha256=admission.offlineAuthorization ? hash({experience,sceneAttachments,geography:Object.keys(sceneAttachments).length?geography:null}) : null;
  return { status: "PILOT_ONLY" as const, identity: loaded.identity, expiresAt: admission.expiresAt,
    canonicalRecordWrites: false, offlineDelivery: admission.offlineAuthorization!==null, offlineAuthorization:admission.offlineAuthorization, offlineIntegritySha256, sceneAttachments, experience };
}
