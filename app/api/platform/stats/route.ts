import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePlatformAdmin();

    const [schoolCount, userCount, studentCount, teacherCount, curriculumCount] =
      await Promise.all([
        prisma.school.count(),
        prisma.user.count(),
        prisma.user.count({ where: { role: "STUDENT" } }),
        prisma.user.count({ where: { role: "TEACHER" } }),
        prisma.curriculumContent.count(),
      ]);

    // Per-school breakdown
    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        county: true,
        createdAt: true,
        _count: { select: { users: true, classes: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      totals: { schoolCount, userCount, studentCount, teacherCount, curriculumCount },
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        county: s.county,
        createdAt: s.createdAt,
        userCount: s._count.users,
        classCount: s._count.classes,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

