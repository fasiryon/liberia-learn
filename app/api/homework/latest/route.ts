import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user.schoolId) return NextResponse.json({ error: "User missing schoolId" }, { status: 403 });

    const url = new URL(req.url);
    const take = Math.min(Math.max(parseInt(url.searchParams.get("take") ?? "10", 10) || 10, 1), 50);
    const classId = url.searchParams.get("classId") ?? undefined;

    if (classId) {
      const ok = await prisma.class.findFirst({
        where: { id: classId, schoolId: user.schoolId },
        select: { id: true },
      });
      if (!ok) return NextResponse.json({ error: "Class not found (or not in your school)" }, { status: 404 });

      const hw = await prisma.homework.findFirst({
        where: { classId, Class: { schoolId: user.schoolId } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, classId: true, title: true, description: true, instructions: true,
          dueAt: true, createdAt: true, createdById: true,
          Class: { select: { id: true, name: true, subject: true } },
        },
      });

      return NextResponse.json({ ok: true, homework: hw });
    }

    const rows = await prisma.homework.findMany({
      where: { Class: { schoolId: user.schoolId } },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, classId: true, title: true, description: true, instructions: true,
        dueAt: true, createdAt: true, createdById: true,
        Class: { select: { id: true, name: true, subject: true } },
      },
    });

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal Server Error" }, { status: e?.status ?? 500 });
  }
}