import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { waecSubjectFromSlug } from "@/lib/waec/syllabus";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";
import { buildPracticeSession, gradePracticeSession } from "@/lib/waec/practice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function resolveStudent() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string } } | null;
  if (!session?.user?.id) return null;
  const student = await prisma.student.findFirst({
    where: { userId: session.user.id },
    select: { id: true, currentGrade: true, enrollments: { include: { Class: { select: { schoolId: true } } } } },
  });
  if (!student || (student.currentGrade ?? 0) < WAEC_MIN_GRADE) return null;
  return student;
}

export async function GET(_req: Request, { params }: { params: { subject: string } }) {
  const subject = waecSubjectFromSlug(params.subject);
  if (!subject || subject.masterySubject === null) {
    return NextResponse.json({ error: "Subject not available for practice" }, { status: 404 });
  }
  const student = await resolveStudent();
  if (!student) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await buildPracticeSession(student.id, subject.id, 6, student.currentGrade ?? 11);
  if (!session) {
    return NextResponse.json({ error: "No practice questions available yet. Please try again shortly." }, { status: 503 });
  }
  return NextResponse.json(session);
}

export async function POST(req: Request, { params }: { params: { subject: string } }) {
  const subject = waecSubjectFromSlug(params.subject);
  if (!subject || subject.masterySubject === null) {
    return NextResponse.json({ error: "Subject not available" }, { status: 404 });
  }
  const student = await resolveStudent();
  if (!student) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const answers = Array.isArray(body?.answers) ? body.answers : null;
  if (!answers) return NextResponse.json({ error: "Invalid answers" }, { status: 400 });

  const schoolId = student.enrollments[0]?.Class?.schoolId ?? "";
  const clean = answers
    .filter((a: any) => typeof a?.id === "string")
    .map((a: any) => ({ id: a.id as string, chosen: Number.isInteger(a.chosen) ? (a.chosen as number) : null }));

  const result = await gradePracticeSession(student.id, schoolId, subject.id, student.currentGrade ?? 11, clean);
  return NextResponse.json(result);
}
