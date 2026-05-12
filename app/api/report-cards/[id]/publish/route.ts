import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("ADMIN");

    const card = await prisma.reportCard.findUnique({ where: { id: params.id } });
    if (!card || card.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Report card not found" }, { status: 404 });
    }
    if (card.status === "PUBLISHED") {
      return NextResponse.json({ error: "Already published" }, { status: 400 });
    }

    const updated = await prisma.reportCard.update({
      where: { id: params.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    void logAudit({
      userId: user.id,
      action: "report_card.published",
      resourceType: "ReportCard",
      resourceId: params.id,
      schoolId: user.schoolId ?? undefined,
    });

    return NextResponse.json({ reportCard: updated });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}
