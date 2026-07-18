/**
 * lib/certificates/certificateProgress.ts, Sprint 6.7
 *
 * Read-only "how close is this student to a certificate" check, for the
 * /student/today "what you unlock" surface. Mirrors the exact completion
 * query and 80% threshold in lib/certificates/autoAwardCertificate.ts.
 * Kept separate on purpose: this never creates or mutates a Certificate
 * row, only reads progress toward the same real threshold.
 */
import { prisma } from "@/lib/db";

const APPROVED_STATUSES = ["APPROVED", "published", "approved"];
const CERTIFICATE_THRESHOLD = 0.8;

export type CertificateProximity = {
  subject: string;
  grade: number;
  completedLessons: number;
  totalLessons: number;
  completionPct: number;
  remainingLessons: number;
  alreadyAwarded: boolean;
};

export async function getCertificateProximity(
  studentId: string,
  studentUserId: string,
  subject: string,
  grade: number,
  schoolId: string | null
): Promise<CertificateProximity | null> {
  const totalLessons = await prisma.curriculumContent.count({
    where: { subject, grade, status: { in: APPROVED_STATUSES } },
  });
  if (totalLessons === 0) return null;

  const [completedLessons, existing] = await Promise.all([
    prisma.studentProgress.count({
      where: {
        studentId: studentUserId,
        completedAt: { not: null },
        scheduledWork: {
          content: { subject, grade, status: { in: APPROVED_STATUSES } },
          ...(schoolId ? { class: { schoolId } } : {}),
        },
      },
    }),
    prisma.certificate.findUnique({
      where: { studentId_type_referenceId: { studentId, type: "SUBJECT", referenceId: subject } },
      select: { id: true },
    }),
  ]);

  const completionPct = Math.round((completedLessons / totalLessons) * 100);
  const remainingLessons = Math.max(0, Math.ceil(totalLessons * CERTIFICATE_THRESHOLD) - completedLessons);

  return {
    subject,
    grade,
    completedLessons,
    totalLessons,
    completionPct,
    remainingLessons,
    alreadyAwarded: Boolean(existing),
  };
}
