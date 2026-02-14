// app/api/student/[id]/route.ts
// FIXED: was completely unauthenticated. Now requires valid session.
// Sprint 1: Security only. (School isolation enforcement is Sprint 2.)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        enrollments: { include: { Class: { include: { School: true } } } },
        grades: { include: { Class: true }, orderBy: { computedAt: "desc" }, take: 20 },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // TEACHER scoping comes in Sprint 2 when User.schoolId exists.
    // For Sprint 1, just prevent unauthenticated access.

    return NextResponse.json(student);
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status });
  }
}