import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-config";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isTeacher = user.role === "TEACHER";
    const isAdmin = user.role === "ADMIN";
    if (!isTeacher && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const homeworkId = url.searchParams.get("homeworkId");
    if (!homeworkId) {
      return NextResponse.json({ error: "homeworkId is required" }, { status: 400 });
    }

    const hw = await prisma.homework.findUnique({
      where: { id: homeworkId },
      select: { id: true, classId: true },
    });
    if (!hw) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

    if (isTeacher) {
      const cls = await prisma.class.findUnique({
        where: { id: hw.classId },
        select: { teacherId: true },
      });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
      if (cls.teacherId !== user.id) {
        return NextResponse.json({ error: "Not your class" }, { status: 403 });
      }
    }

    // IMPORTANT: Student model does NOT have `name` in your schema.
    // We'll return student.user.name if relation exists, otherwise minimal fields.
    const submissions = await prisma.homeworkSubmission.findMany({
      where: { homeworkId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        homeworkId: true,
        studentId: true,
        status: true,
        score: true,
        feedback: true,
        gradedAt: true,
        gradedById: true,
        createdAt: true,
        content: true,

        // Schema-safe: select Student + nested User (if relation exists in your schema)
        student: {
          select: {
            id: true,
            userId: true,
            county: true,
            community: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ submissions });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
