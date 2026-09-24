// route-policy: auth=session; scope=tenant; authority=class-membership; rationale=packs bind to a class the caller belongs to and students always receive the answer-free edition
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generatePack, resolveWeekBounds } from "@/lib/packs/generatePack";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await requireRole("TEACHER", "STUDENT", "ADMIN");
  const body = await req.json().catch(() => ({})) as {
    classId?: string;
    weekStart?: string;
    audience?: "student" | "teacher";
  };

  const { weekStart, weekEnd } = resolveWeekBounds(body.weekStart);
  // Students always receive the stripped (answer-key-free) audience; only
  // staff may request the teacher edition.
  const audience =
    user.role === "STUDENT"
      ? "student"
      : body.audience === "student"
        ? "student"
        : "teacher";

  // Every pack is bound to one class the caller may see. Without a class the
  // generator's scheduled-work query is unscoped (platform-wide).
  let classId: string | null = null;
  let studentId: string | null = null;

  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true, enrollments: { select: { classId: true } } },
    });
    const enrolled = student?.enrollments.map((e) => e.classId) ?? [];
    classId = body.classId ? (enrolled.includes(body.classId) ? body.classId : null) : enrolled[0] ?? null;
    if (body.classId && !classId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    studentId = student?.id ?? null;
  } else {
    if (!user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const cls = await prisma.class.findFirst({
      where: body.classId
        ? { id: body.classId, schoolId: user.schoolId }
        : { schoolId: user.schoolId, teacherId: user.id },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (body.classId && !cls) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    classId = cls?.id ?? null;
  }

  if (!classId) {
    return NextResponse.json(
      { error: "No class found for this offline pack. Join or select a class first." },
      { status: 400 }
    );
  }

  const pack = await prisma.offlinePack.create({
    data: {
      requestedById: user.id,
      classId,
      studentId,
      weekStart,
      weekEnd,
      audience,
      status: "pending",
    },
  });

  try {
    const result = await generatePack(pack.id);
    return NextResponse.json({
      packId: result.packId,
      status: "ready",
      downloadUrl: `/api/packs/${result.packId}/download`,
      sizeBytes: result.sizeBytes,
      lessonCount: result.lessonCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Pack generation failed" },
      { status: err?.status ?? 500 }
    );
  }
}
