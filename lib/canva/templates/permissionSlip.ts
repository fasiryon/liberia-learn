import { generateCanvaAsset } from "@/lib/canva/canvaMcp";
import { hasCanvaMcpAuthorizationToken } from "@/lib/canva/config";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export interface PermissionSlipData {
  studentName: string;
  guardianName: string;
  eventTitle: string;
  eventDate: string;
  schoolName: string;
  returnDate?: string;
}

export async function generatePermissionSlip(
  data: PermissionSlipData,
  schoolId: string,
  studentId: string,
  requestedBy: string
) {
  const doc = await prisma.generatedDocument.create({
    data: {
      schoolId,
      studentId,
      type: "PERMISSION_SLIP",
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
      details: { docId: doc.id, type: "PERMISSION_SLIP", reason: "token_not_configured" },
    });
    return prisma.generatedDocument.findUniqueOrThrow({ where: { id: doc.id } });
  }

  await prisma.generatedDocument.update({ where: { id: doc.id }, data: { status: "GENERATING" } });

  try {
    const result = await generateCanvaAsset(
      `Create a parent permission slip in Canva with the following details:

Student Name: ${data.studentName}
Parent/Guardian: ${data.guardianName}
Event: ${data.eventTitle}
Event Date: ${data.eventDate}
School: ${data.schoolName}
${data.returnDate ? `Return Date: ${data.returnDate}` : ""}

The permission slip should:
- Have the school name at the top
- Clearly state the event name and date
- Include a guardian signature section with date
- Have a tear-off section at the bottom for parents to sign and return
- Include student name and class
- Be clear and easy to read
- Include "LiberiaLearn" branding

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
      details: { docId: doc.id, type: "PERMISSION_SLIP" },
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
      details: { docId: doc.id, type: "PERMISSION_SLIP", error: errorMessage },
    });
    return updated;
  }
}
