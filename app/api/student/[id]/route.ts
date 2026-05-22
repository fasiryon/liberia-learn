// app/api/student/[id]/route.ts
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

    const student = await prisma.student.findFirst({
      where: { id: params.id, user: { schoolId: user.schoolId } },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        enrollments: { include: { Class: { include: { School: true } } } },
        grades: { include: { Class: true }, orderBy: { computedAt: "desc" }, take: 20 },
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