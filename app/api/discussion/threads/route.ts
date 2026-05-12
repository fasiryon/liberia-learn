import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await requireRole("STUDENT", "TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const contentId = searchParams.get("contentId");

  if (!classId) return NextResponse.json({ error: "classId required" }, { status: 400 });

  // Scope check: student must be enrolled, teacher/admin must be in same school
  if (user.role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: { classId, Student: { userId: user.id } },
    });
    if (!enrollment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    // TEACHER or ADMIN
    const cls = await prisma.class.findFirst({ where: { id: classId, schoolId: user.schoolId! } });
    if (!cls) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = { classId };
  if (contentId) where.contentId = contentId;

  const threads = await prisma.discussionThread.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    include: {
      author: { select: { id: true, name: true } },
      _count: { select: { posts: true } },
    },
  });

  return NextResponse.json(threads);
}

export async function POST(req: NextRequest) {
  const user = await requireRole("STUDENT", "TEACHER", "ADMIN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { classId, title, body: postBody, contentId } = body;

  if (!classId || !title?.trim() || !postBody?.trim()) {
    return NextResponse.json({ error: "classId, title, and body are required" }, { status: 400 });
  }

  // Scope check
  let gradeLevel: number | null = null;
  if (user.role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: { classId, Student: { userId: user.id } },
      include: { Class: { select: { gradeLevel: true, schoolId: true } } },
    });
    if (!enrollment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    gradeLevel = enrollment.Class.gradeLevel;
  } else {
    const cls = await prisma.class.findFirst({ where: { id: classId, schoolId: user.schoolId! } });
    if (!cls) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isPending = user.role === "STUDENT" && gradeLevel !== null && gradeLevel <= 6;

  const thread = await prisma.discussionThread.create({
    data: {
      classId,
      schoolId: user.schoolId!,
      title: title.trim(),
      authorId: user.id,
      authorRole: user.role,
      contentId: contentId ?? null,
      posts: {
        create: {
          authorId: user.id,
          authorRole: user.role,
          body: postBody.trim(),
          pending: isPending,
        },
      },
    },
  });

  logAudit({ userId: user.id, action: "discussion.thread.create", details: { threadId: thread.id, classId } });

  return NextResponse.json(thread, { status: 201 });
}
