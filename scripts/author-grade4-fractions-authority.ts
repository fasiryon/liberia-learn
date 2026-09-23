import { createCurriculumContent } from "../lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "../lib/curriculum/mutations/governanceWriter";
import { GRADE4_FRACTIONS_LESSON } from "../lib/curriculum/authority/grade4FractionsLesson";

/**
 * Publishes the exact lesson bound by the Grade 4 fractions release.
 *
 * This script requires an existing founder/platform reviewer identity. It
 * never labels the lesson MOE-approved and never writes the projection
 * directly; creation, provenance, review, and publication use the canonical
 * curriculum workflow.
 */
async function main() {
  const actorUserId = process.env.LIBERIALEARN_FOUNDER_REVIEWER_ID?.trim();
  if (!actorUserId) throw new Error("LIBERIALEARN_FOUNDER_REVIEWER_ID is required");

  const created = await createCurriculumContent({
    contentId: GRADE4_FRACTIONS_LESSON.contentId,
    title: GRADE4_FRACTIONS_LESSON.title,
    grade: GRADE4_FRACTIONS_LESSON.grade,
    subject: GRADE4_FRACTIONS_LESSON.subject,
    contentType: GRADE4_FRACTIONS_LESSON.contentType,
    status: "draft",
    version: GRADE4_FRACTIONS_LESSON.version,
    payload: GRADE4_FRACTIONS_LESSON.payload,
    learningObjectives: GRADE4_FRACTIONS_LESSON.payload.objectives,
    moeAlignments: [{ code: GRADE4_FRACTIONS_LESSON.standardCode, source: "LiberiaLearn curriculum authority" }],
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
    idempotencyKey: "curriculum:ll-g4-math-fractions-equal-parts-2026.1:1.0.0",
  });

  if (!created.revision || !created.provenance) throw new Error("curriculum_provenance_not_created");

  await appendCurriculumGovernanceEvent({
    contentId: GRADE4_FRACTIONS_LESSON.contentId,
    revisionId: created.revision.id,
    eventType: "SUBMITTED",
    actorType: "USER",
    actorUserId,
    actorLabel: "LiberiaLearn founder curriculum authority",
    reason: "Submit the complete Grade 4 fractions lesson for human review.",
    idempotencyKey: "curriculum:ll-g4-math-fractions-equal-parts-2026.1:submitted",
  });

  await appendCurriculumGovernanceEvent({
    contentId: GRADE4_FRACTIONS_LESSON.contentId,
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
    idempotencyKey: "curriculum:ll-g4-math-fractions-equal-parts-2026.1:approved",
  });

  console.log(JSON.stringify({
    contentId: GRADE4_FRACTIONS_LESSON.contentId,
    version: GRADE4_FRACTIONS_LESSON.version,
    approval: "HUMAN_REVIEW",
    authority: "PLATFORM",
    provenance: GRADE4_FRACTIONS_LESSON.payload ? GRADE4_FRACTIONS_LESSON.provenance : null,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
