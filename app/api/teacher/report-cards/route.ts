import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ draftWithoutComment: 0 });
    }

    // Find classes taught by this teacher
    const classes = await prisma.class.findMany({
      where: { teacherId: user.id, schoolId: user.schoolId },
      select: { id: true },
    });
    const classIds = classes.map((c) => c.id);

    if (classIds.length === 0) {
      return NextResponse.json({ draftWithoutComment: 0 });
    }

    const draftWithoutComment = await prisma.reportCard.count({
      where: {
        classId: { in: classIds },
        status: "DRAFT",
        teacherComment: null,
        schoolId: user.schoolId,
      },
    });

    return NextResponse.json({ draftWithoutComment });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}
