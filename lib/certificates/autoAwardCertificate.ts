import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isCertificationAssetGenerationEnabled } from "@/lib/serverFlags";
import { generateCertificate } from "./canvaCertificate";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BYTE_LIMIT = 256 - (256 % CHARSET.length);

function makeCertCode(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  let code = "";
  while (code.length < 8) {
    for (const byte of randomBytes(8)) {
      if (byte >= BYTE_LIMIT) continue;
      code += CHARSET[byte % CHARSET.length];
      if (code.length === 8) break;
    }
  }
  return code;
}

/**
 * Called fire-and-forget after a lesson is marked complete.
 * Awards a SUBJECT certificate when the student reaches ≥80% completion
 * of approved lessons for that subject+grade. Never throws.
 */
export async function checkAndAwardCertificate(
  studentId: string,  // Student.id
  subject: string,
  grade: number,
  actingUserId: string, // User.id (for audit)
): Promise<void> {
  try {
    // Idempotency: skip if SUBJECT cert already exists for this subject
    const existing = await prisma.certificate.findUnique({
      where: {
        studentId_type_referenceId: {
          studentId,
          type: "SUBJECT",
          referenceId: subject,
        },
      },
      select: { id: true },
    });
    if (existing) return;

    // Total approved lessons for this subject+grade
    const totalLessons = await prisma.curriculumContent.count({
      where: { subject, grade, status: "approved" },
    });
    if (totalLessons === 0) return;

    // Student record — need userId for StudentProgress queries
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        userId: true,
        user: { select: { name: true, schoolId: true } },
      },
    });
    if (!student) return;

    const schoolId = student.user?.schoolId ?? null;

    // Completed lessons: StudentProgress uses userId, completedAt != null
    const completedLessons = await prisma.studentProgress.count({
      where: {
        studentId: student.userId,
        completedAt: { not: null },
        scheduledWork: {
          content: { subject, grade, status: "approved" },
          ...(schoolId ? { class: { schoolId } } : {}),
        },
      },
    });

    if (completedLessons / totalLessons < 0.8) return;

    // Get school name for certificate (best-effort)
    const schoolName = schoolId
      ? ((await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }))?.name ?? "LiberiaLearn Academy")
      : "LiberiaLearn Academy";

    // Create DB record — pending if Canva generation is enabled
    let cert;
    try {
      cert = await prisma.certificate.create({
        data: {
          studentId,
          schoolId,
          type: "SUBJECT",
          referenceId: subject,
          certificateCode: makeCertCode(),
          status: isCertificationAssetGenerationEnabled() ? "pending" : "completed",
          completedAt: new Date(),
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") return; // race: another request already created it
      throw err;
    }

    await logAudit({
      userId: actingUserId,
      schoolId: schoolId ?? undefined,
      action: "student.certificate.awarded",
      resourceType: "certificate",
      resourceId: cert.id,
      details: {
        certificateType: "SUBJECT",
        referenceId: subject,
        title: `${subject} Subject`,
        subject,
        studentId,
        completionPct: Math.round((completedLessons / totalLessons) * 100),
        trigger: "auto_80pct_lesson_complete",
      },
    });

    // Fire-and-forget Canva certificate
    if (isCertificationAssetGenerationEnabled()) {
      generateCertificate({
        studentName: student.user?.name ?? "Student",
        schoolName,
        grade,
        subject,
        completionDate: new Date().toLocaleDateString("en-LR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        certificateId: cert.certificateCode,
      })
        .then(async (result) => {
          await prisma.certificate.update({
            where: { id: cert.id },
            data: {
              canvaUrl: result.canvaUrl,
              designId: result.designId,
              status: "completed",
              generatedAt: new Date(),
            },
          });
        })
        .catch(async (err) => {
          console.error("[autoAwardCertificate] Canva generation failed:", err?.message);
          await prisma.certificate.update({
            where: { id: cert.id },
            data: { status: "failed" },
          }).catch(() => null);
        });
    }
  } catch (err) {
    // Never throw — certificate failure must not break lesson completion
    console.error("[autoAwardCertificate] error:", err);
  }
}
