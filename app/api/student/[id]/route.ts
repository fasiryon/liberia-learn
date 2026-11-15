// route-policy: auth=session; scope=record; authority=teacher-class-or-school-admin; rationale=student and returned grade/enrollment rows require own-school administrator or assigned-class teacher authority
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { checkSchoolAccess } from "@/lib/tenant/assert-school-access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const classScope = { schoolId: user.schoolId, ...(user.role === "TEACHER" ? { teacherId: user.id } : {}) };
    const student = await prisma.student.findFirst({
      where: {
        id: params.id,
        user: { schoolId: user.schoolId },
        ...(user.role === "TEACHER" ? { enrollments: { some: { Class: classScope } } } : {}),
      },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        enrollments: { where: { Class: classScope }, include: { Class: { include: { School: true } } } },
        grades: { where: { Class: classScope }, include: { Class: true }, orderBy: { computedAt: "desc" }, take: 20 },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status });
  }
}
