import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let issues = 0;

  // 1. Published lessons must have publishedAt
  const missingPublishedAt = await prisma.curriculumContent.count({
    where: { teacherCreated: true, editReviewStatus: "APPROVED", publishedAt: null },
  });
  if (missingPublishedAt > 0) {
    console.error(`[FAIL] ${missingPublishedAt} approved teacher lessons missing publishedAt`);
    issues++;
  }

  // 2. Teacher lessons must have editedById
  const missingAuthor = await prisma.curriculumContent.count({
    where: { teacherCreated: true, editedById: null },
  });
  if (missingAuthor > 0) {
    console.error(`[FAIL] ${missingAuthor} teacher lessons have no editedById`);
    issues++;
  }

  // 3. lessonVersion > 1 must have parentLessonId
  const versionedWithoutParent = await prisma.curriculumContent.count({
    where: { teacherCreated: true, lessonVersion: { gt: 1 }, parentLessonId: null },
  });
  if (versionedWithoutParent > 0) {
    console.error(`[FAIL] ${versionedWithoutParent} teacher lessons have lessonVersion > 1 but no parentLessonId`);
    issues++;
  }

  // 4. Orphan assignments
  const allAssignments = await prisma.teacherLessonAssignment.findMany({
    select: { id: true, contentId: true },
  });
  for (const a of allAssignments) {
    const exists = await prisma.curriculumContent.count({ where: { contentId: a.contentId } });
    if (!exists) {
      console.error(`[FAIL] Orphan TeacherLessonAssignment ${a.id} references missing contentId ${a.contentId}`);
      issues++;
    }
  }

  // 5. Warn on lessons stuck PENDING > 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stuckPending = await prisma.curriculumContent.count({
    where: { teacherCreated: true, editReviewStatus: "PENDING", editedAt: { lt: sevenDaysAgo } },
  });
  if (stuckPending > 0) {
    console.warn(`[WARN] ${stuckPending} teacher lessons stuck in PENDING > 7 days`);
  }

  if (issues === 0) {
    console.log("[PASS] Wave 4 audit clean — 0 issues");
  } else {
    console.error(`[FAIL] Wave 4 audit found ${issues} issue(s)`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
