import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildClassDifferentiationRollup } from "@/lib/teacher/classDifferentiation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { classId: string } }) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const classRecord = await prisma.class.findUnique({
      where: { id: params.classId },
      select: { id: true, schoolId: true, teacherId: true },
    });
    if (!classRecord || classRecord.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    if (user.role === "TEACHER" && classRecord.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await buildClassDifferentiationRollup(params.classId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to build differentiation view" }, { status: err?.status ?? 500 });
  }
}
