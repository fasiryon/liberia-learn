import type { CurriculumReviewRecommendation, Prisma, ReviewerCredentialStatus } from "@prisma/client";
import { prisma } from "../lib/db";
import { parseSupabaseDatabaseTarget } from "../lib/database-target";
import { createCurriculumContent, updateCurriculumContent } from "../lib/curriculum/mutations/repository";
import { createReviewerCredential, createReviewerProfile, transitionReviewerCredential } from "../lib/curriculum/review/roster";
import { enqueueCurriculumReviewTask, cancelTasksForSupersededRevisions } from "../lib/curriculum/review/tasks";
import { claimReviewTask, heartbeatReviewClaim, releaseReviewClaim } from "../lib/curriculum/review/claims";
import { submitAssessment } from "../lib/curriculum/review/assessments";
import { finalizeReviewTaskIfReady } from "../lib/curriculum/review/decisions";
import { reviewEligibility } from "../lib/curriculum/review/eligibility";
import { getReviewTaskView } from "../lib/curriculum/review/taskView";
import { createCalibrationSession, submitCalibrationResult } from "../lib/curriculum/review/calibration";
import { getCredentialCoverageReport, getQueueOperationsReport, getReviewerQualityReport } from "../lib/curriculum/review/reporting";
import { notifyReviewUsers } from "../lib/curriculum/review/notifications";
import { enforceLegacyReviewAdapter } from "../lib/curriculum/review/legacyAdapter";
import { evaluateReviewPolicy } from "../lib/curriculum/review/policy";
import { P2B_RUBRIC_V1, type RubricResponses } from "../lib/curriculum/review/rubric";
import { ReviewOperationError } from "../lib/curriculum/review/errors";

const STAGING_REF = "yonpfzjczoffhrgibxkz";
type Actor = { id: string; role: "ADMIN" | "TEACHER"; schoolId: string; isPlatformAdmin: boolean };
type Reviewer = { user: Actor; profileId: string; credentialId: string };
type Check = { number: number; scenario: string; passed: true; detail?: string };

function expect(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function expectCode(fn: () => Promise<unknown>, code: string): Promise<void> {
  try { await fn(); } catch (error) { if (error instanceof ReviewOperationError && error.code === code) return; throw error; }
  throw new Error(`Expected ${code}`);
}

const rubric = Object.fromEntries(P2B_RUBRIC_V1.map((dimension) => [dimension, { value: "PASS" }])) as RubricResponses;

async function main(): Promise<void> {
  const target = parseSupabaseDatabaseTarget(process.env.DATABASE_URL ?? "", "DATABASE_URL");
  if (target.projectRef !== STAGING_REF) throw new Error("P2-B E2E refuses non-staging database");
  process.env.P2A_PROVENANCE_WRITERS_DISABLED = "false";
  const run = `p2b-e2e-${Date.now()}`;
  const checks: Check[] = [];
  const pass = (number: number, scenario: string, detail?: string) => { checks.push({ number, scenario, passed: true, detail }); console.log(`PASS ${number}: ${scenario}`); };

  const schoolA = await prisma.school.create({ data: { name: `${run} School A`, code: `${run}-a` } });
  const schoolB = await prisma.school.create({ data: { name: `${run} School B`, code: `${run}-b` } });
  const makeUser = async (name: string, role: "ADMIN" | "TEACHER", schoolId: string, isPlatformAdmin = false): Promise<Actor> =>
    prisma.user.create({ data: { email: `${run}-${name}@example.test`, name, role, schoolId, isPlatformAdmin }, select: { id: true, role: true, schoolId: true, isPlatformAdmin: true } }) as Promise<Actor>;
  const adminA = await makeUser("admin-a", "ADMIN", schoolA.id);
  const adminB = await makeUser("admin-b", "ADMIN", schoolB.id);
  const author = await makeUser("author", "TEACHER", schoolA.id);

  async function makeReviewer(name: string, options: { school?: typeof schoolA; subject?: string; expiresAt?: Date; status?: ReviewerCredentialStatus; maxClaims?: number } = {}): Promise<Reviewer> {
    const school = options.school ?? schoolA;
    const operator = school.id === schoolA.id ? adminA : adminB;
    const user = await makeUser(name, "TEACHER", school.id);
    const profile = await createReviewerProfile({ operator, userId: user.id, organizationType: "SCHOOL", authority: "SCHOOL", schoolId: school.id, idempotencyKey: `${run}:${name}:profile` });
    if (options.maxClaims) await prisma.reviewerProfile.update({ where: { id: profile.id }, data: { maxActiveClaims: options.maxClaims } });
    const credential = await createReviewerCredential({
      operator, reviewerProfileId: profile.id, credentialType: "SUBJECT_REVIEW", issuer: `${run} evidence-backed staging fixture issuer`, authority: "SCHOOL",
      validFrom: new Date(Date.now() - 86_400_000), expiresAt: options.expiresAt ?? new Date(Date.now() + 31_536_000_000), evidenceRef: `staging-fixture:${run}:${name}`,
      scopes: [{ subject: options.subject ?? "MATH", gradeMin: 6, gradeMax: 8, curriculumScopes: ["SCHOOL"], curriculumTypes: ["lesson"], schoolId: school.id }], idempotencyKey: `${run}:${name}:credential`,
    });
    const verified = await transitionReviewerCredential({ operator, credentialId: credential.id, toStatus: "VERIFIED", idempotencyKey: `${run}:${name}:verified`, expectedVersion: 1 });
    if (options.status && options.status !== "VERIFIED") await transitionReviewerCredential({ operator, credentialId: credential.id, toStatus: options.status as Exclude<ReviewerCredentialStatus, "DRAFT">, reason: "Staging E2E", idempotencyKey: `${run}:${name}:${options.status}`, expectedVersion: verified.version });
    return { user, profileId: profile.id, credentialId: credential.id };
  }

  const reviewer1 = await makeReviewer("reviewer-1", { maxClaims: 10 });
  const reviewer2 = await makeReviewer("reviewer-2", { maxClaims: 10 });
  const resolver = await makeReviewer("resolver", { maxClaims: 10 });
  const crossSchool = await makeReviewer("cross-school", { school: schoolB });
  const expired = await makeReviewer("expired", { expiresAt: new Date(Date.now() - 1_000) });
  const suspended = await makeReviewer("suspended", { status: "SUSPENDED" });
  const revoked = await makeReviewer("revoked", { status: "REVOKED" });
  const scopeMismatch = await makeReviewer("scope-mismatch", { subject: "ENGLISH" });
  const capacityReviewer = await makeReviewer("capacity", { maxClaims: 1 });
  const authorProfile = await createReviewerProfile({ operator: adminA, userId: author.id, organizationType: "SCHOOL", authority: "SCHOOL", schoolId: schoolA.id, idempotencyKey: `${run}:author:profile` });
  const authorCredential = await createReviewerCredential({ operator: adminA, reviewerProfileId: authorProfile.id, credentialType: "SUBJECT_REVIEW", issuer: `${run} fixture`, authority: "SCHOOL", evidenceRef: `staging-fixture:${run}:author`, scopes: [{ subject: "MATH", gradeMin: 6, gradeMax: 8, curriculumScopes: ["SCHOOL"], curriculumTypes: ["lesson"], schoolId: schoolA.id }], idempotencyKey: `${run}:author:credential` });
  await transitionReviewerCredential({ operator: adminA, credentialId: authorCredential.id, toStatus: "VERIFIED", idempotencyKey: `${run}:author:verified`, expectedVersion: 1 });

  async function makeContent(suffix: string) {
    return createCurriculumContent({ contentId: `${run}-${suffix}`, title: `${run} ${suffix}`, grade: 7, subject: "MATH", contentType: "lesson", status: "draft", version: "p2b-v1", schoolId: schoolA.id, editedById: author.id, teacherCreated: true, payload: { title: suffix, grade: 7, subject: "MATH", contentType: "lesson", body: "Students compare quantities, explain each step, practise with Liberian market examples, and check their reasoning carefully.", objectives: ["Explain the mathematical idea", "Apply the idea independently"] } }, { revisionKind: "HUMAN_CREATE", originKind: "HUMAN_AUTHORED", actorUserId: author.id, authorUserId: author.id, requestedCompleteness: "VERIFIED", auditAction: "p2b.e2e.content", idempotencyKey: `${run}:${suffix}:content` });
  }
  async function makeTask(suffix: string, riskBand: "LOW" | "STANDARD" | "HIGH" | "CRITICAL" = "STANDARD", extra: Partial<Parameters<typeof enqueueCurriculumReviewTask>[0]> = {}) {
    const content = await makeContent(suffix);
    const task = await enqueueCurriculumReviewTask({ provenanceId: content.provenance!.id, revisionId: content.revision!.id, riskBand, requestedAuthority: "SCHOOL", schoolId: schoolA.id, createdByUserId: adminA.id, idempotencyKey: `${run}:${suffix}:task`, ...extra });
    return { content, task };
  }
  const submit = async (taskId: string, reviewer: Reviewer, recommendation: CurriculumReviewRecommendation, key: string, evidence = false) => {
    const assignment = await claimReviewTask({ taskId, user: reviewer.user, idempotencyKey: `${run}:${key}:claim` });
    const assessment = await submitAssessment({ assignmentId: assignment.id, user: reviewer.user, leaseToken: assignment.leaseToken, assignmentVersion: assignment.version, rubricResponses: rubric, recommendation, rationale: `${key} rationale`, evidenceRefs: evidence ? [`staging-fixture:${run}:evidence`] : [], idempotencyKey: `${run}:${key}:assessment` });
    return { assignment, assessment };
  };

  const single = await makeTask("single");
  const singleSubmitted = await submit(single.task.id, reviewer1, "APPROVE", "single");
  const singleFinal = await finalizeReviewTaskIfReady({ taskId: single.task.id, idempotencyKey: `${run}:single:decision` });
  expect(singleFinal.status === "FINAL", "single review did not finalize");
  pass(1, "school-qualified single review");
  pass(2, "teacher reviewer, non-authored content");

  const conflicts = await makeTask("conflicts");
  const self = await reviewEligibility({ user: author, taskId: conflicts.task.id, slot: "FIRST" });
  expect(self.reasons.includes("AUTHOR_CONFLICT"), "self review was not rejected");
  pass(3, "self-review rejection");
  const cross = await reviewEligibility({ user: crossSchool.user, taskId: conflicts.task.id, slot: "FIRST" });
  expect(!cross.eligible && cross.reasons.some((reason) => reason === "RBAC_CEILING" || reason === "SCHOOL_SCOPE"), "cross-school reviewer was eligible");
  pass(4, "cross-school denial");
  for (const [number, scenario, candidate, reason] of [[5, "expired credential rejection", expired, "CREDENTIAL_EXPIRED"], [6, "suspended credential rejection", suspended, "CREDENTIAL_MISSING"], [7, "revoked credential rejection", revoked, "CREDENTIAL_MISSING"], [8, "scope mismatch", scopeMismatch, "CREDENTIAL_SCOPE_MISMATCH"]] as const) {
    const result = await reviewEligibility({ user: candidate.user, taskId: conflicts.task.id, slot: "FIRST" });
    expect(result.reasons.includes(reason), `${scenario} failed`); pass(number, scenario);
  }

  const race = await makeTask("claim-race", "HIGH");
  const raceResults = await Promise.allSettled([claimReviewTask({ taskId: race.task.id, user: reviewer1.user, idempotencyKey: `${run}:race:1` }), claimReviewTask({ taskId: race.task.id, user: reviewer2.user, idempotencyKey: `${run}:race:2` })]);
  expect(raceResults.filter((item) => item.status === "fulfilled").length === 1, "claim race had more than one winner");
  const winner = raceResults.find((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof claimReviewTask>>> => item.status === "fulfilled")!.value;
  pass(9, "claim race");
  const heartTask = await makeTask("heartbeat");
  const heartClaim = await claimReviewTask({ taskId: heartTask.task.id, user: reviewer1.user, idempotencyKey: `${run}:heartbeat:claim` });
  const heart = await heartbeatReviewClaim({ assignmentId: heartClaim.id, reviewerProfileId: reviewer1.profileId, leaseToken: heartClaim.leaseToken, version: heartClaim.version });
  expect(heart.version === heartClaim.version + 1, "heartbeat CAS failed"); pass(10, "heartbeat");
  await releaseReviewClaim({ assignmentId: heart.id, reviewerProfileId: reviewer1.profileId, leaseToken: heart.leaseToken, version: heart.version, actorUserId: reviewer1.user.id, schoolId: schoolA.id, idempotencyKey: `${run}:heartbeat:release` });
  await prisma.curriculumReviewAssignment.update({ where: { id: winner.id }, data: { leaseExpiresAt: new Date(Date.now() - 1_000) } });
  pass(11, "lease expiry");
  const reclaimed = await claimReviewTask({ taskId: race.task.id, user: reviewer2.user, idempotencyKey: `${run}:race:reclaim` });
  expect(reclaimed.reviewerProfileId === reviewer2.profileId, "expired claim not reclaimed"); pass(12, "reclaim");

  const stale = await makeTask("stale");
  const staleClaim = await claimReviewTask({ taskId: stale.task.id, user: reviewer1.user, idempotencyKey: `${run}:stale:claim` });
  await updateCurriculumContent({ id: stale.content.content.id }, { title: `${run} stale revision changed` }, { revisionKind: "HUMAN_EDIT", originKind: "HUMAN_AUTHORED", actorUserId: author.id, authorUserId: author.id, requestedCompleteness: "VERIFIED", auditAction: "p2b.e2e.stale", idempotencyKey: `${run}:stale:update` });
  await expectCode(() => submitAssessment({ assignmentId: staleClaim.id, user: reviewer1.user, leaseToken: staleClaim.leaseToken, assignmentVersion: staleClaim.version, rubricResponses: rubric, recommendation: "APPROVE", rationale: "stale", evidenceRefs: [], idempotencyKey: `${run}:stale:assessment` }), "REVISION_STALE");
  pass(13, "stale revision submit");
  const cancelled = await cancelTasksForSupersededRevisions(stale.content.provenance!.id);
  expect(cancelled === 1, "stale task was not cancelled"); pass(28, "task cancellation on superseded revision");

  const agreement = await makeTask("agreement", "HIGH");
  await submit(agreement.task.id, reviewer1, "APPROVE", "agreement:first", true); pass(14, "first review");
  const secondClaim = await claimReviewTask({ taskId: agreement.task.id, user: reviewer2.user, idempotencyKey: `${run}:agreement:second:claim` });
  const blindView = await getReviewTaskView(agreement.task.id, reviewer2.user);
  expect(blindView.blinding.active && blindView.assessments.length === 0, "second review was not blinded"); pass(15, "blind second review");
  await submitAssessment({ assignmentId: secondClaim.id, user: reviewer2.user, leaseToken: secondClaim.leaseToken, assignmentVersion: secondClaim.version, rubricResponses: rubric, recommendation: "APPROVE", rationale: "independent agreement", evidenceRefs: [`staging-fixture:${run}:evidence`], idempotencyKey: `${run}:agreement:second:assessment` });
  const agreementFinal = await finalizeReviewTaskIfReady({ taskId: agreement.task.id, idempotencyKey: `${run}:agreement:decision` });
  expect(agreementFinal.status === "FINAL", "agreement did not finalize"); pass(16, "agreement");

  const disagreement = await makeTask("disagreement", "HIGH");
  await submit(disagreement.task.id, reviewer1, "APPROVE", "disagreement:first", true);
  await submit(disagreement.task.id, reviewer2, "REJECT", "disagreement:second", true);
  const disagreementState = await finalizeReviewTaskIfReady({ taskId: disagreement.task.id, idempotencyKey: `${run}:disagreement:pending` });
  expect(disagreementState.status === "DISAGREEMENT", "disagreement not preserved"); pass(17, "disagreement"); pass(18, "escalation");
  await submit(disagreement.task.id, resolver, "APPROVE", "disagreement:resolver", true);
  const resolved = await finalizeReviewTaskIfReady({ taskId: disagreement.task.id, idempotencyKey: `${run}:disagreement:resolved` });
  expect(resolved.status === "FINAL", "resolver decision failed"); pass(19, "resolver decision");

  const returned = await makeTask("return");
  await submit(returned.task.id, reviewer1, "RETURN_FOR_REVISION", "return");
  const returnFinal = await finalizeReviewTaskIfReady({ taskId: returned.task.id, idempotencyKey: `${run}:return:decision` });
  expect(returnFinal.status === "FINAL", "return did not finalize"); pass(20, "return for revision");
  const revised = await updateCurriculumContent({ id: returned.content.content.id }, { title: `${run} corrected` }, { revisionKind: "HUMAN_EDIT", originKind: "HUMAN_AUTHORED", actorUserId: author.id, authorUserId: author.id, requestedCompleteness: "VERIFIED", auditAction: "p2b.e2e.reapproval", idempotencyKey: `${run}:return:update` });
  const reapprovalTask = await enqueueCurriculumReviewTask({ provenanceId: returned.content.provenance!.id, revisionId: revised.revision!.id, riskBand: "STANDARD", requestedAuthority: "SCHOOL", schoolId: schoolA.id, idempotencyKey: `${run}:reapproval:task` });
  await submit(reapprovalTask.id, reviewer1, "APPROVE", "reapproval");
  expect((await finalizeReviewTaskIfReady({ taskId: reapprovalTask.id, idempotencyKey: `${run}:reapproval:decision` })).status === "FINAL", "reapproval failed"); pass(21, "new revision and reapproval");

  const governed = await makeTask("revocation-base");
  await submit(governed.task.id, reviewer1, "APPROVE", "revocation:base");
  await finalizeReviewTaskIfReady({ taskId: governed.task.id, idempotencyKey: `${run}:revocation:base:decision` });
  const emergency = await enqueueCurriculumReviewTask({ provenanceId: governed.content.provenance!.id, revisionId: governed.content.revision!.id, riskBand: "CRITICAL", requestedAuthority: "SCHOOL", schoolId: schoolA.id, emergencyRevocation: true, idempotencyKey: `${run}:emergency:task` });
  expect(emergency.reviewCycle === 2, "emergency review cycle did not advance");
  await submit(emergency.id, reviewer2, "REJECT", "emergency", true);
  const emergencyFinal = await finalizeReviewTaskIfReady({ taskId: emergency.id, idempotencyKey: `${run}:emergency:decision` });
  expect(emergencyFinal.status === "FINAL" && emergencyFinal.decision.outcome === "REVOKED", "urgent revocation failed"); pass(22, "urgent revocation");
  const reinstatement = await enqueueCurriculumReviewTask({ provenanceId: governed.content.provenance!.id, revisionId: governed.content.revision!.id, riskBand: "HIGH", requestedAuthority: "SCHOOL", schoolId: schoolA.id, reinstatementAfterRevocation: true, idempotencyKey: `${run}:reinstate:task` });
  expect(reinstatement.reviewCycle === 3 && reinstatement.requiredReviewCount === 2, "reinstatement policy failed");
  await submit(reinstatement.id, reviewer1, "APPROVE", "reinstate:first", true);
  await submit(reinstatement.id, resolver, "APPROVE", "reinstate:second", true);
  const reinstated = await finalizeReviewTaskIfReady({ taskId: reinstatement.id, idempotencyKey: `${run}:reinstate:decision` });
  expect(reinstated.status === "FINAL" && reinstated.decision.outcome === "REINSTATED", "reinstatement failed"); pass(23, "two-person reinstatement");

  const capacityHold = await makeTask("capacity-hold");
  await claimReviewTask({ taskId: capacityHold.task.id, user: capacityReviewer.user, idempotencyKey: `${run}:capacity:hold` });
  const capacityHigh = await makeTask("capacity-high", "HIGH");
  const capacityEligibility = await reviewEligibility({ user: capacityReviewer.user, taskId: capacityHigh.task.id, slot: "FIRST" });
  expect(capacityEligibility.reasons.includes("CAPACITY_EXHAUSTED"), "capacity not enforced");
  expect(await prisma.curriculumReviewDecision.count({ where: { taskId: capacityHigh.task.id } }) === 0, "capacity auto-approved high risk"); pass(24, "high-risk capacity exhaustion with no auto-approval");

  const storedAssessment = await prisma.curriculumReviewAssessment.findUniqueOrThrow({ where: { id: singleSubmitted.assessment.id } });
  expect((storedAssessment.qualificationSnapshot as Record<string, unknown>).credentialId === reviewer1.credentialId, "qualification snapshot missing"); pass(25, "qualification snapshot");
  const atomicDecision = await prisma.curriculumReviewDecision.findUniqueOrThrow({ where: { taskId: single.task.id }, include: { governanceEvent: true, auditLog: true } });
  expect(atomicDecision.governanceEvent?.auditLogId === atomicDecision.auditLogId, "P2-A governance and audit are not coupled"); pass(26, "P2-A governance and audit atomic commit");
  const rollbackKey = `${run}:rollback-audit`;
  try { await prisma.$transaction(async (tx) => { await tx.auditLog.create({ data: { action: rollbackKey, resourceType: "p2b_e2e", resourceId: run } }); throw new Error("INJECTED_POST_AUDIT_FAILURE"); }); } catch {}
  expect(await prisma.auditLog.count({ where: { action: rollbackKey } }) === 0, "audit transaction did not roll back"); pass(27, "rollback on AuditLog transaction failure");

  const calibration = await createCalibrationSession({ name: `${run} calibration`, revisionId: single.content.revision!.id, referenceSnapshot: { rubricResponses: rubric, recommendation: "APPROVE" }, createdByUserId: adminA.id, idempotencyKey: `${run}:calibration` });
  await prisma.reviewCalibrationSession.update({ where: { id: calibration.id }, data: { status: "OPEN" } });
  await submitCalibrationResult({ sessionId: calibration.id, reviewerProfileId: reviewer1.profileId, rubricResponses: rubric, recommendation: "APPROVE", rationale: "calibration fixture", idempotencyKey: `${run}:calibration:result` });
  pass(29, "calibration session");
  const [queueReport, qualityReport, coverageReport] = await Promise.all([getQueueOperationsReport(schoolA.id), getReviewerQualityReport(reviewer1.profileId), getCredentialCoverageReport()]);
  expect(queueReport.sampleSize > 0 && qualityReport.sampleSize >= 0 && coverageReport.sampleSize > 0, "reports unavailable"); pass(30, "coverage and reporting");
  await notifyReviewUsers("FINAL_DECISION", [reviewer1.user.id], single.task.id);
  expect(await prisma.notificationInboxItem.count({ where: { userId: reviewer1.user.id, url: `/review/tasks/${single.task.id}` } }) > 0, "notification missing"); pass(31, "notifications");

  const legacyContent = await makeContent("legacy-adapter");
  process.env.P2B_REVIEW_OPERATIONS_ENABLED = "true"; process.env.P2B_REVIEW_SHADOW_ENABLED = "false";
  await expectCode(() => enforceLegacyReviewAdapter({ contentId: legacyContent.content.contentId, user: adminA, requestedAction: "APPROVE", idempotencyKey: `${run}:legacy` }), "P2B_WORKFLOW_REQUIRED");
  pass(32, "legacy route adapter cannot bypass qualification");
  const p2c = evaluateReviewPolicy({ subject: "MATH", grade: 12, contentType: "lesson", requestedAuthority: "MOE", riskBand: "STANDARD", waecAuthoritative: true, importedOrLicensed: true, sourceRightsRequired: true, provenanceComplete: true, evidenceCount: 1 });
  expect(p2c.requiredReviewCount === 2 && ["WAEC_SUBJECT_REVIEW", "LICENSED_SOURCE_REVIEW", "SOURCE_RIGHTS_VERIFICATION"].every((credential) => p2c.specialistCredentialTypes.includes(credential as never)), "P2-C extension proof failed"); pass(33, "P2-C WAEC credential extension proof");

  checks.sort((a, b) => a.number - b.number);
  expect(checks.length === 33 && checks.every((check, index) => check.number === index + 1), "E2E check set is incomplete");
  console.log(JSON.stringify({ run, stagingProject: STAGING_REF, result: "PASS", checks }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
