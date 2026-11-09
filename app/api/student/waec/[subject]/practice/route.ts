import { NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=student-membership; rationale=Student identity and current school/enrollment bind a signed provisional practice attempt with no official or mastery writes.
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { waecSubjectFromSlug } from "@/lib/waec/syllabus";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";
import { buildPracticeSession, gradePracticeSession } from "@/lib/waec/practice";
import {
  assertPracticeSigningAvailable, issuePracticeSession, validatePracticeItems,
  WAEC_PRACTICE_COOKIE, WAEC_PRACTICE_TTL_SECONDS,
} from "@/lib/waec/practiceSession";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function resolveStudent() {
  const user = await requireRole("STUDENT");
  if (!user.schoolId) return null;
  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: {
      id: true, currentGrade: true, user: { select: { schoolId: true } },
      enrollments: { include: { Class: { select: { schoolId: true } } } },
    },
  });
  const schoolId = student?.user.schoolId;
  if (!student || !schoolId || schoolId !== user.schoolId || !student.enrollments.some(enrollment => enrollment.Class.schoolId === schoolId) ||
    !Number.isInteger(student.currentGrade) || student.currentGrade < WAEC_MIN_GRADE || student.currentGrade > 12) return null;
  return { userId: user.id, studentId: student.id, schoolId, grade: student.currentGrade };
}

function safeError(error: unknown) {
  const declared = error !== null && typeof error === "object" && "status" in error && typeof error.status === "number"
    ? error.status : 503;
  const status = [400, 401, 403, 409, 503].includes(declared) ? declared : 503;
  const errorMessage = status === 503 ? "Practice is temporarily unavailable. Please try again later."
    : status === 401 || status === 403 ? "Forbidden"
      : error instanceof Error ? error.message : "Invalid practice attempt. Reload to start a new attempt.";
  return NextResponse.json({ error: errorMessage }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_req: Request, { params }: { params: { subject: string } }) {
  try {
    const subject = waecSubjectFromSlug(params.subject);
    if (!subject || subject.masterySubject === null) return NextResponse.json({ error: "Subject not available for practice" }, { status: 404 });
    const student = await resolveStudent();
    if (!student) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    assertPracticeSigningAvailable();
    const session = await buildPracticeSession(student.studentId, subject.id, 6, student.grade);
    if (!session) return NextResponse.json({ error: "No practice questions available yet. Please try again shortly." }, { status: 503 });
    const context = { ...student, subjectId: subject.id };
    const ids = session.questions.map(question => question.id);
    const rows = await prisma.waecPracticeItem.findMany({ where: { id: { in: ids }, subjectId: subject.id, grade: student.grade } });
    const items = validatePracticeItems(rows, context, ids);
    const token = issuePracticeSession(context, items);
    // Display the exact validated revision bound by the token, even if the bank
    // changed after the earlier selection query. Explicit projection omits keys.
    const questions = [...items].sort((left, right) => ids.indexOf(left.id) - ids.indexOf(right.id)).map(item => ({
      id: item.id, topicId: item.topicId, topicName: subject.topics.find(topic => topic.id === item.topicId)?.name ?? item.topicId,
      prompt: item.prompt, options: item.options,
    }));
    const response = NextResponse.json({ subjectId: subject.id, subjectName: subject.name, questions }, { headers: { "cache-control": "no-store" } });
    response.cookies.set(WAEC_PRACTICE_COOKIE, token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: `/api/student/waec/${params.subject}/practice`, maxAge: WAEC_PRACTICE_TTL_SECONDS,
    });
    return response;
  } catch (error: unknown) { return safeError(error); }
}

export async function POST(req: Request, { params }: { params: { subject: string } }) {
  try {
    const subject = waecSubjectFromSlug(params.subject);
    if (!subject || subject.masterySubject === null) return NextResponse.json({ error: "Subject not available" }, { status: 404 });
    const student = await resolveStudent();
    if (!student) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !("answers" in body)) return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
    const cookie = req.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${WAEC_PRACTICE_COOKIE}=`));
    let token = "";
    try { token = cookie ? decodeURIComponent(cookie.slice(WAEC_PRACTICE_COOKIE.length + 1)) : ""; } catch { /* Invalid token follows the same fail-closed path. */ }
    const result = await gradePracticeSession(student.studentId, student.schoolId, subject.id, student.grade, body.answers, { token, userId: student.userId });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error: unknown) { return safeError(error); }
}
