import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isTextbookCompilerEnabled } from "@/lib/serverFlags";
import { getStudentTextbook, getStudentTextbookSubjects } from "@/lib/ai/textbook/studentTextbook";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  checkRateLimit,
  RATE_LIMIT_POLICIES,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const SUBJECT_REGEX = /^[A-Z0-9_]{1,40}$/;

export async function GET(_req: NextRequest, { params }: { params: { subject: string } }) {
  try {
    if (!isTextbookCompilerEnabled()) {
      return NextResponse.json({ error: "textbook_compiler_disabled" }, { status: 503 });
    }

    const user = await requireRole("STUDENT");

    const limit = await checkRateLimit(`textbook:${user.id}`, {
      windowMs: RATE_LIMIT_POLICIES.AI_HEAVY.windowMs,
      limit: RATE_LIMIT_POLICIES.AI_HEAVY.student,
      namespace: "ai",
    });
    if (!limit.allowed) {
      return rateLimitExceededResponse(limit);
    }

    let subject: string;
    try {
      subject = decodeURIComponent(params.subject).trim().toUpperCase();
    } catch {
      return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
    }
    if (!SUBJECT_REGEX.test(subject)) {
      return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { currentGrade: true },
    });
    if (!student?.currentGrade) {
      return NextResponse.json({ error: "Student grade is not set" }, { status: 400 });
    }

    const allowedSubjects = await getStudentTextbookSubjects({
      gradeLevel: student.currentGrade,
      schoolId: user.schoolId ?? null,
    });
    if (!allowedSubjects.includes(subject)) {
      return NextResponse.json({ error: "Subject not available" }, { status: 404 });
    }

    const textbook = await getStudentTextbook({
      subject,
      gradeLevel: student.currentGrade,
      schoolId: user.schoolId ?? null,
    });
    if (textbook.units.length === 0) {
      return NextResponse.json({ error: "No textbook found for this subject" }, { status: 404 });
    }

    return NextResponse.json(textbook);
  } catch (error) {
    return handleApiError(error, { route: "/api/student/textbook/[subject]", method: "GET" });
  }
}
