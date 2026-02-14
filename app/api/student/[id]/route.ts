// app/api/student/[id]/route.ts
// FIXED: was completely unauthenticated. Now requires valid session.
// Sprint 1: Security only. (School isolation enforcement is Sprint 2.)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    // Students can only see themselves
    if (user.role === "STUDENT") {
      const self = await prisma.student.findFirst({ where: { userId: user.id } });
      if (!self || self.id !== params.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

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