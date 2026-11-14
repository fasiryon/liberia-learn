import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export const dynamic = "force-dynamic";

// route-policy: auth=session; scope=record; authority=teacher-class-or-school-admin; rationale=SMS student data requires own-school administrator or assigned-class teacher authority at lookup and response query
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
  const user = await requireRole("TEACHER", "ADMIN");
  if (!user.schoolId) {
    return NextResponse.json({ error: "School context required" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: params.id },
    include: { Class: { select: { schoolId: true, teacherId: true } } },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (assignment.Class.schoolId !== user.schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.role === "TEACHER" && assignment.Class.teacherId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await prisma.smsSession.findMany({
    where: {
      assignmentId: params.id,
      assignment: { Class: { schoolId: user.schoolId, ...(user.role === "TEACHER" ? { teacherId: user.id } : {}) } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      studentPhone: true,
      studentId: true,
      currentIndex: true,
      score: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      questions: true,
    },
  });

  const rows = sessions.map((s) => {
    const qs = Array.isArray(s.questions) ? s.questions : [];
    return {
      id: s.id,
      studentPhone: s.studentPhone,
      studentId: s.studentId,
      score: s.score,
      total: qs.length,
      status: s.status,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    };
  });

  return NextResponse.json({ sessions: rows });
  } catch (error) {
    return handleApiError(error, { route: "/api/teacher/assignments/[id]/sms-status", method: "GET" });
  }
}
