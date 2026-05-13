import { generateCanvaAsset } from "@/lib/canva/canvaMcp";
import { hasCanvaMcpAuthorizationToken } from "@/lib/canva/config";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export interface StudentIdCardData {
  studentName: string;
  studentNumber: string;
  grade: string;
  schoolName: string;
  academicYear: string;
  photoUrl?: string;
}

export async function generateStudentIdCard(
  data: StudentIdCardData,
  schoolId: string,
  studentId: string,
  requestedBy: string
) {
  const doc = await prisma.generatedDocument.create({
    data: {
      schoolId,
      studentId,
      type: "STUDENT_ID_CARD",
      status: "PENDING",
      requestedBy,
      metadata: { ...data },
    },
  });

  if (!hasCanvaMcpAuthorizationToken()) {
    await prisma.generatedDocument.update({
      where: { id: doc.id },
      data: { status: "FAILED", metadata: { ...data, error: "Canva MCP token not configured" } },
    });
    logAudit({
      userId: requestedBy,
      action: "document.generate.failed",
      details: { docId: doc.id, type: "STUDENT_ID_CARD", reason: "token_not_configured" },
    });
    return prisma.generatedDocument.findUniqueOrThrow({ where: { id: doc.id } });
  }

  await prisma.generatedDocument.update({ where: { id: doc.id }, data: { status: "GENERATING" } });

  try {
    const result = await generateCanvaAsset(
      `Create a student ID card in Canva with the following details:

Student Name: ${data.studentName}
Student Number: ${data.studentNumber}
Grade: ${data.grade}
School: ${data.schoolName}
Academic Year: ${data.academicYear}

Design requirements:
- Student name should be large and prominent
- Include school name at top
- Show grade level and student ID number
- Include academic year
- Add a placeholder box for student photo
- Include a "LiberiaLearn" branding footer
- Use professional school ID card layout with school colors

Return the Canva design URL.`
    );

    const updated = await prisma.generatedDocument.update({
      where: { id: doc.id },
      data: {
        status: "COMPLETED",
        canvaDesignId: result.designId,
        canvaUrl: result.canvaUrl,
        downloadUrl: result.canvaUrl,
      },
    });
    logAudit({
      userId: requestedBy,
      action: "document.generate.completed",
      details: { docId: doc.id, type: "STUDENT_ID_CARD" },
    });
    return updated;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Generation failed";
    const updated = await prisma.generatedDocument.update({
      where: { id: doc.id },
      data: { status: "FAILED", metadata: { ...data, error: errorMessage } },
    });
    logAudit({
      userId: requestedBy,
      action: "document.generate.failed",
      details: { docId: doc.id, type: "STUDENT_ID_CARD", error: errorMessage },
    });
    return updated;
  }
}
