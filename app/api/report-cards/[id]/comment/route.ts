import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const card = await prisma.reportCard.findUnique({ where: { id: params.id } });
    if (!card || card.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Report card not found" }, { status: 404 });
    }

    const body = await req.json();
    const { teacherComment, principalComment } = body as {
      teacherComment?: string;
      principalComment?: string;
    };

    const data: { teacherComment?: string; principalComment?: string } = {};

    if (teacherComment !== undefined) data.teacherComment = teacherComment;
    // Only ADMIN may set principalComment
    if (principalComment !== undefined) {
      if (user.role !== "ADMIN") {
        return NextResponse.json({ error: "Only admins may set the principal comment" }, { status: 403 });
      }
      data.principalComment = principalComment;
    }

    const updated = await prisma.reportCard.update({
      where: { id: params.id },
      data,
    });

    void logAudit({
      userId: user.id,
      action: "report_card.comment_updated",
      resourceType: "ReportCard",
      resourceId: params.id,
      schoolId: user.schoolId ?? undefined,
      details: { fields: Object.keys(data) },
    });

    return NextResponse.json({ reportCard: updated });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}
