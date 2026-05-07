import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateCertificate } from "@/lib/certificates/canvaCertificate";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isCanvaCertificatesEnabled, isCertificatesEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  studentId: z.string().min(1),
  subject: z.string().min(1),
});

function certificateCode() {
  return crypto.randomBytes(6).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8);
}

async function createUniqueCertificate(input: {
  studentId: string;
  schoolId: string;
  subject: string;
  completedAt: Date;
}) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await prisma.certificate.upsert({
        where: {
          studentId_type_referenceId: {
            studentId: input.studentId,
            type: "SUBJECT",
            referenceId: input.subject,
          },
        },
        update: {
          schoolId: input.schoolId,
          status: "pending",
          completedAt: input.completedAt,
        },
        create: {
          studentId: input.studentId,
          schoolId: input.schoolId,
          type: "SUBJECT",
          referenceId: input.subject,
          certificateCode: certificateCode(),
          status: "pending",
          completedAt: input.completedAt,
        },
      });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
    }
  }
  throw new Error("certificate_code_generation_failed");
}

export async function POST(req: Request) {
  try {
    if (
      !isCertificatesEnabled() ||
      typeof isCanvaCertificatesEnabled !== "function" ||
      !isCanvaCertificatesEnabled()
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const actor = await requireRole("STUDENT", "ADMIN");
    const body = RequestSchema.parse(await req.json());
    const student = await prisma.student.findUnique({
      where: { id: body.studentId },
      select: {
        id: true,
        currentGrade: true,
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            schoolId: true,
            school: { select: { id: true, name: true } },
          },
        },
        enrollments: { select: { classId: true } },
      },
    });

    if (!student?.user.schoolId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (actor.role === "STUDENT" && student.userId !== actor.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (actor.role === "ADMIN" && !actor.isPlatformAdmin && actor.schoolId !== student.user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const classIds = student.enrollments.map((enrollment) => enrollment.classId);
    const scheduledWork = await prisma.scheduledWork.findMany({
      where: {
        classId: { in: classIds },
        class: { schoolId: student.user.schoolId },
        content: { subject: body.subject },
      },
      select: { id: true },
    });
    const totalLessons = scheduledWork.length;
    if (totalLessons === 0) {
      return NextResponse.json({ error: "No lessons available for subject" }, { status: 400 });
    }

    const workIds = scheduledWork.map((work) => work.id);
    const completed = await prisma.studentProgress.count({
      where: {
        studentId: student.userId,
        scheduledWorkId: { in: workIds },
        completedAt: { not: null },
      },
    });
    const completionRate = completed / totalLessons;
    if (completionRate < 0.8) {
      return NextResponse.json(
        { error: "Certificate requires 80% subject completion", completionRate },
        { status: 400 }
      );
    }

    const completedAt = new Date();
    const certificate = await createUniqueCertificate({
      studentId: student.id,
      schoolId: student.user.schoolId,
      subject: body.subject,
      completedAt,
    });

    try {
      const generated = await generateCertificate({
        studentName: student.user.name ?? "Student",
        schoolName: student.user.school?.name ?? "School",
        grade: student.currentGrade ?? 0,
        subject: body.subject,
        completionDate: completedAt.toISOString().slice(0, 10),
        certificateId: certificate.certificateCode,
      });
      await prisma.certificate.update({
        where: { id: certificate.id },
        data: {
          canvaUrl: generated.canvaUrl,
          designId: generated.designId,
          status: "completed",
          generatedAt: new Date(),
        },
      });
      await logAudit({
        userId: actor.id,
        schoolId: student.user.schoolId,
        action: "certificate.canva.generated",
        resourceType: "certificate",
        resourceId: certificate.id,
        details: { subject: body.subject, studentId: student.id, completionRate },
      });
      return NextResponse.json({ certificateUrl: generated.canvaUrl });
    } catch (error) {
      await prisma.certificate.update({
        where: { id: certificate.id },
        data: { status: "failed" },
      });
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
