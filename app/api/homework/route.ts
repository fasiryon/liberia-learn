import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-config";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Student feed: only show homework for classes student is enrolled in
    if (user.role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) return NextResponse.json({ items: [] });

      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: student.id },
        select: { classId: true },
      });

      const classIds = enrollments.map(e => e.classId);
      if (classIds.length === 0) return NextResponse.json({ items: [] });

      const items = await prisma.homework.findMany({
        where: { classId: { in: classIds } },
        orderBy: { createdAt: "desc" },
        include: {
          Class: { select: { id: true, name: true, subject: true } },
          submissions: {
            where: { studentId: student.id },
            select: { id: true, status: true, score: true, feedback: true, gradedAt: true, updatedAt: true },
          },
        },
      });

      return NextResponse.json({ items });
    }

    // Teacher/Admin view: return recent homework they created
    const items = await prisma.homework.findMany({
      where: { createdById: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        Class: { select: { id: true, name: true, subject: true } },
        _count: { select: { submissions: true } },
      },
    });

    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}

