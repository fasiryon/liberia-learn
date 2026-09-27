import fs from "node:fs";
import { createHash } from "node:crypto";
import { createCurriculumContent } from "../lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "../lib/curriculum/mutations/governanceWriter";
import { GRADE4_FRACTIONS_LESSON, GRADE4_FRACTIONS_LESSON_2026_2 } from "../lib/curriculum/authority/grade4FractionsLesson";

/**
 * Publishes one founder-reviewed Grade 4 fractions lesson through the
 * canonical curriculum workflow.
 *
 *   --lesson=ll-g4-math-fractions-equal-parts-2026.1   bound by release 2026.1
 *   --lesson=ll-g4-math-fractions-equal-parts-2026.2   bound by the 2026.2 candidate
 *
 * Dry run by default (prints the plan, touches no database). Writing needs
 * `--apply` AND CONFIRM_PRODUCTION_WRITE=<contentId> AND a founder APPROVE
 * decision in curriculum/review/g4-math/review-ledger.json whose
 * `reviewedContentId` names this exact lesson. The script never labels the
 * lesson MOE-approved and never writes the projection directly.
 *
 * Idempotent: every write carries an idempotency key derived from
 * contentId + version, so a re-run after a partial failure does not duplicate.
 */
const LESSONS = [GRADE4_FRACTIONS_LESSON, GRADE4_FRACTIONS_LESSON_2026_2] as const;
const OBJECTIVE = "moe-math-g4-s1-p3-number-theory-and-fraction-obj4";
const LEDGER = "curriculum/review/g4-math/review-ledger.json";

async function main() {
  const contentId = process.argv.find((arg) => arg.startsWith("--lesson="))?.slice("--lesson=".length);
  const lesson = LESSONS.find((candidate) => candidate.contentId === contentId);
  if (!lesson) throw new Error(`--lesson must be one of: ${LESSONS.map((candidate) => candidate.contentId).join(", ")}`);
  const apply = process.argv.includes("--apply");

  const ledger = JSON.parse(fs.readFileSync(LEDGER, "utf8")) as Record<string, { decision: string; reviewer: string | null; reviewedAt: string | null; reviewedContentId?: string }>;
  const review = ledger[OBJECTIVE];
  const reviewed = review?.decision === "APPROVE" && !!review.reviewer?.trim() && Number.isFinite(Date.parse(review.reviewedAt ?? "")) &&
    review.reviewedContentId === lesson.contentId;
  const payloadSha256 = createHash("sha256").update(JSON.stringify(lesson.payload)).digest("hex");
  const keys = { create: `curriculum:${lesson.contentId}:${lesson.version}`, submitted: `curriculum:${lesson.contentId}:submitted`, approved: `curriculum:${lesson.contentId}:approved` };

  if (!apply) {
    console.log(JSON.stringify({ result: "DRY_RUN", contentId: lesson.contentId, version: lesson.version, payloadSha256, idempotencyKeys: keys,
      founderReview: reviewed ? "APPROVE recorded for this lesson" : `missing: ${LEDGER} ${OBJECTIVE} needs decision APPROVE, reviewer, reviewedAt and reviewedContentId=${lesson.contentId}`,
      applyRequires: ["--apply", `CONFIRM_PRODUCTION_WRITE=${lesson.contentId}`, "LIBERIALEARN_FOUNDER_REVIEWER_ID=<founder User.id>"] }, null, 2));
    return;
  }
  if (process.env.CONFIRM_PRODUCTION_WRITE !== lesson.contentId) throw new Error(`--apply requires CONFIRM_PRODUCTION_WRITE=${lesson.contentId}`);
  if (!reviewed) throw new Error(`precondition_failed: no founder APPROVE for ${lesson.contentId} in ${LEDGER}`);
  const actorUserId = process.env.LIBERIALEARN_FOUNDER_REVIEWER_ID?.trim();
  if (!actorUserId) throw new Error("LIBERIALEARN_FOUNDER_REVIEWER_ID is required");

  const created = await createCurriculumContent({
    contentId: lesson.contentId,
    title: lesson.title,
    grade: lesson.grade,
    subject: lesson.subject,
    contentType: lesson.contentType,
    status: "draft",
    version: lesson.version,
    payload: lesson.payload,
    learningObjectives: lesson.payload.objectives,
    moeAlignments: [{ code: lesson.standardCode, source: "LiberiaLearn curriculum authority" }],
    schoolId: null,
    visibility: "public",
  }, {
    revisionKind: "HUMAN_CREATE",
    originKind: "HUMAN_AUTHORED",
    actorUserId,
    authorUserId: actorUserId,
    actorLabel: "LiberiaLearn founder curriculum authority",
    requestedCompleteness: "VERIFIED",
    auditAction: "curriculum.grade4_fractions.authority_create",
    idempotencyKey: keys.create,
  });

  if (!created.revision || !created.provenance) throw new Error("curriculum_provenance_not_created");

  await appendCurriculumGovernanceEvent({
    contentId: lesson.contentId,
    revisionId: created.revision.id,
    eventType: "SUBMITTED",
    actorType: "USER",
    actorUserId,
    actorLabel: "LiberiaLearn founder curriculum authority",
    reason: "Submit the complete Grade 4 fractions lesson for human review.",
    idempotencyKey: keys.submitted,
  });

  await appendCurriculumGovernanceEvent({
    contentId: lesson.contentId,
    revisionId: created.revision.id,
    eventType: "APPROVED",
    actorType: "USER",
    actorUserId,
    actorLabel: "LiberiaLearn founder curriculum authority",
    approvalBasis: "HUMAN_REVIEW",
    reviewAuthority: "PLATFORM",
    reviewerRoleSnapshot: "FOUNDER_CURRICULUM_REVIEWER",
    reviewerQualificationRef: `founder-reviewer:${actorUserId}`,
    reviewerQualificationSnapshot: { schemaVersion: 1, basis: "LIBERIALEARN_FOUNDER_REVIEW", userId: actorUserId },
    reason: "Reviewed for Grade 4 accessibility, completeness, offline activities, and alignment to LR-MATH-G4_6-02.",
    idempotencyKey: keys.approved,
  });

  console.log(JSON.stringify({
    contentId: lesson.contentId,
    version: lesson.version,
    payloadSha256,
    approval: "HUMAN_REVIEW",
    authority: "PLATFORM",
    provenance: lesson.provenance,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
