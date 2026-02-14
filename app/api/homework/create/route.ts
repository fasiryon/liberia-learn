import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";

export async function POST(req: Request) {
  const { schoolId } = await requireTenant();
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const body = await req.json();
    const classId = body?.classId as string | undefined;
    const title = body?.title as string | undefined;
    const description = (body?.description ?? body?.body) as string | undefined;
    const dueAt = (body?.dueAt ?? body?.dueAt) ? new Date(body.dueAt ?? body.dueAt) : null;

    if (!classId || !title) {
      return NextResponse.json({ error: "classId and title are required" }, { status: 400 });
    }

    // Teacher can only create for their own class (admin can create for any)
    if (user.role === "TEACHER") {
      const cls = await prisma.class.findUnique({ where: { id: classId }, select: { teacherId: true } });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
      if (cls.teacherId !== user.id) return NextResponse.json({ error: "Not your class" }, { status: 403 });
    }

    const hw = await prisma.homework.create({
      data: {
        title,
        description: description ?? null,
        dueAt,
        classId,
        createdById: user.id,
      },
    });

    return NextResponse.json({ homework: hw });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}




