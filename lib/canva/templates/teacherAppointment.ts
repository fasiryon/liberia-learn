import { generateCanvaAsset } from "@/lib/canva/canvaMcp";
import { hasCanvaMcpAuthorizationToken } from "@/lib/canva/config";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export interface TeacherAppointmentData {
  teacherName: string;
  position: string;
  schoolName: string;
  startDate: string;
  principalName?: string;
  academicYear: string;
}

export async function generateTeacherAppointment(
  data: TeacherAppointmentData,
  schoolId: string,
  teacherId: string,
  requestedBy: string
) {
  const doc = await prisma.generatedDocument.create({
    data: {
      schoolId,
      studentId: teacherId,
      type: "TEACHER_APPOINTMENT",
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
      details: { docId: doc.id, type: "TEACHER_APPOINTMENT", reason: "token_not_configured" },
    });
    return prisma.generatedDocument.findUniqueOrThrow({ where: { id: doc.id } });
  }

  await prisma.generatedDocument.update({ where: { id: doc.id }, data: { status: "GENERATING" } });

  try {
    const result = await generateCanvaAsset(
      `Create a formal teacher appointment letter in Canva with the following details:

Teacher Name: ${data.teacherName}
Position: ${data.position}
School: ${data.schoolName}
Start Date: ${data.startDate}
Academic Year: ${data.academicYear}
${data.principalName ? `Principal: ${data.principalName}` : ""}

The letter should:
- Be on official school letterhead
- Formally appoint the teacher to their position
- Include start date and academic year
- Include terms of appointment
- Have a professional signature block
- Use formal appointment letter formatting
- Include "LiberiaLearn" footer

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
      details: { docId: doc.id, type: "TEACHER_APPOINTMENT" },
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
      details: { docId: doc.id, type: "TEACHER_APPOINTMENT", error: errorMessage },
    });
    return updated;
  }
}
