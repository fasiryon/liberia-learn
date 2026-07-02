/**
 * PHASE 5A — read-only data audit for WAEC Prep track feasibility.
 * Answers: WAEC-tagged content volume, per-student mastery data existence,
 * essay-grading history, and Grade 9+ demo students.
 * SELECT-only. No writes.
 */
import { prisma } from "@/lib/db";

async function main() {
  const out: Record<string, unknown> = {};

  // 1. CurriculumContent WAEC tagging (waecAlignment lives in payload JSON)
  const approved = await prisma.curriculumContent.findMany({
    where: { status: { in: ["accepted", "published", "APPROVED"] } },
    select: { id: true, subject: true, grade: true, payload: true, moeAlignments: true },
  });
  const examStyleCounts: Record<string, number> = {};
  const waecBySubjectGrade: Record<string, number> = {};
  let waecTaggedTotal = 0;
  for (const c of approved) {
    const p = (c.payload ?? {}) as any;
    const wa = p.waecAlignment as any;
    const style = wa?.examStyle ?? "none";
    examStyleCounts[style] = (examStyleCounts[style] ?? 0) + 1;
    const isWaec = wa?.required === true || (typeof style === "string" && style !== "none");
    if (isWaec && (c.grade ?? 0) >= 9) {
      waecTaggedTotal++;
      const k = `${c.subject}:G${c.grade}`;
      waecBySubjectGrade[k] = (waecBySubjectGrade[k] ?? 0) + 1;
    }
  }
  out.approvedContentTotal = approved.length;
  out.examStyleCounts = examStyleCounts;
  out.waecTaggedG9plusTotal = waecTaggedTotal;
  out.waecBySubjectGrade = waecBySubjectGrade;

  // Grade 9+ approved content by subject (regardless of tag)
  const g9plus = approved.filter((c) => (c.grade ?? 0) >= 9);
  const g9BySubject: Record<string, number> = {};
  for (const c of g9plus) g9BySubject[c.subject] = (g9BySubject[c.subject] ?? 0) + 1;
  out.g9plusApprovedTotal = g9plus.length;
  out.g9plusBySubject = g9BySubject;

  // 2. StudentMasteryProfile — the per-student readiness signal
  const masteryTotal = await prisma.studentMasteryProfile.count();
  const masteryAssessed = await prisma.studentMasteryProfile.count({
    where: { lastAssessedAt: { not: null } },
  });
  out.studentMasteryProfileTotal = masteryTotal;
  out.studentMasteryProfileAssessed = masteryAssessed;
  const masteryBySubject = await prisma.studentMasteryProfile.groupBy({
    by: ["subject"],
    _count: true,
  });
  out.masteryBySubject = masteryBySubject;

  // StrandCatalog with waecRef
  const strandTotal = await prisma.strandCatalog.count();
  const strandWithWaec = await prisma.strandCatalog.count({ where: { waecRef: { not: null } } });
  out.strandCatalogTotal = strandTotal;
  out.strandCatalogWithWaecRef = strandWithWaec;

  // 3. Essay grading history (GradedSubmission)
  try {
    const gradedTotal = await (prisma as any).gradedSubmission.count();
    out.gradedSubmissionTotal = gradedTotal;
  } catch (e: any) {
    out.gradedSubmissionTotal = `model missing: ${e?.message}`;
  }

  // 4. Grade 9+ students (Student.grade)
  const students = await prisma.student.findMany({
    select: { id: true, currentGrade: true, user: { select: { email: true, name: true } } },
  });
  const g9students = students.filter((s) => (s.currentGrade ?? 0) >= 9);
  out.totalStudents = students.length;
  out.g9plusStudents = g9students.map((s) => ({
    grade: s.currentGrade,
    email: s.user?.email,
    name: s.user?.name,
  }));

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error("AUDIT ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
