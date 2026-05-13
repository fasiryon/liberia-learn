import { generateCanvaAsset } from "@/lib/canva/canvaMcp";
import { hasCanvaMcpAuthorizationToken } from "@/lib/canva/config";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export interface EnrollmentLetterData {
  studentName: string;
  guardianName: string;
  grade: string;
  schoolName: string;
  enrollmentDate: string;
  academicYear: string;
  principalName?: string;
}

export async function generateEnrollmentLetter(
  data: EnrollmentLetterData,
  schoolId: string,
  studentId: string,
  requestedBy: string
) {
  const doc = await prisma.generatedDocument.create({
    data: {
      schoolId,
      studentId,
      type: "ENROLLMENT_LETTER",
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
      details: { docId: doc.id, type: "ENROLLMENT_LETTER", reason: "token_not_configured" },
    });
    return prisma.generatedDocument.findUniqueOrThrow({ where: { id: doc.id } });
  }

  await prisma.generatedDocument.update({ where: { id: doc.id }, data: { status: "GENERATING" } });

  try {
    const result = await generateCanvaAsset(
      `Create a formal enrollment letter in Canva with the following details:

Student Name: ${data.studentName}
Guardian/Parent Name: ${data.guardianName}
Grade: ${data.grade}
School: ${data.schoolName}
Enrollment Date: ${data.enrollmentDate}
Academic Year: ${data.academicYear}
${data.principalName ? `Principal: ${data.principalName}` : ""}

The letter should:
- Be on letterhead with school name at top
- Confirm student enrollment in the specified grade
- Include enrollment date and academic year
- Be addressed to the guardian
- Include a signature block for the principal
- Use formal letter formatting
- Include "LiberiaLearn" in the footer

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
      details: { docId: doc.id, type: "ENROLLMENT_LETTER" },
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
      details: { docId: doc.id, type: "ENROLLMENT_LETTER", error: errorMessage },
    });
    return updated;
  }
}
