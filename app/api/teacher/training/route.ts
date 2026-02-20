import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("moduleId");

    const modules = await prisma.trainingModule.findMany({
      where: { isActive: true, ...(moduleId ? { id: moduleId } : {}) },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        sortOrder: true,
        estimatedMinutes: true,
        isActive: true,
      },
    });

    const progress = await prisma.trainingProgress.findMany({
      where: {
        teacherUserId: user.id,
        moduleId: { in: modules.map((m) => m.id) },
      },
      select: {
        moduleId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ modules, progress });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
