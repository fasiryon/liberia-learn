import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";
import { gradeToBand } from "@/lib/moe/alignment-engine";
import { updateMasteryProfile } from "@/lib/mastery/masteryService";
import type { Subject } from "@prisma/client";

export const dynamic = "force-dynamic";

const SUBJECT_MAP: Record<string, Subject> = {
  MATH: "MATH",
  MATHEMATICS: "MATH",
  SCIENCE: "SCIENCE",
  COMPUTER_SCIENCE: "COMPUTER_SCIENCE",
  CS: "COMPUTER_SCIENCE",
  ENGINEERING: "ENGINEERING",
  LITERACY: "LITERACY",
  ENGLISH: "LITERACY",
  CIVICS: "CIVICS",
  ARTS: "ARTS",
  PE: "PE",
  CAREER: "CAREER",
};

/**
 * PATCH /api/student/labs/sessions/[sessionId]
 * Part 7: Update a lab session with observations, conclusions, score, completion.
 * When completedAt + score are provided, triggers mastery update.
 * Body: { observations?, conclusions?, score?, completedAt? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("STUDENT");
    const { sessionId } = params;

    const session = await prisma.labSession.findUnique({ where: { id: sessionId } });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.studentId !== user.id || session.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { observations, conclusions, score, completedAt } = body;

    const isCompleting = !!completedAt && score != null;

    const updated = await prisma.labSession.update({
      where: { id: sessionId },
      data: {
        observations: observations !== undefined ? observations : undefined,
        conclusions: conclusions !== undefined ? conclusions : undefined,
        score: score !== undefined ? score : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
      },
    });

    await logAudit({
      userId: user.id,
      action: isCompleting ? "lab.session.complete" : "lab.session.update",
      resourceType: "labSession",
      resourceId: sessionId,
      schoolId: session.schoolId,
      details: { score: score ?? null, isCompleting },
    });

    // Mastery integration when completing with a score
    if (isCompleting && !session.masteryUpdated) {
      try {
        await triggerMasteryUpdate(updated, user.id, session.schoolId);
        await prisma.labSession.update({
          where: { id: sessionId },
          data: { masteryUpdated: true },
        });
      } catch {
        // Mastery update failures are non-fatal — session still completes
      }
    }

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to update session" },
      { status: err?.status ?? 500 }
    );
  }
}

async function triggerMasteryUpdate(
  session: { labId: string; scheduledWorkId?: string | null; score: number | null },
  userId: string,
  schoolId: string
) {
  if (session.score == null) return;

  // Resolve student record (mastery uses Student.id not User.id)
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) return;

  // Load content for subject + grade via scheduledWork chain
  let subject: string | null = null;
  let grade: number | null = null;
  let moeAlignments: Array<{ code: string }> = [];

  if (session.scheduledWorkId) {
    const sw = await prisma.scheduledWork.findUnique({
      where: { id: session.scheduledWorkId },
      include: {
        content: { select: { subject: true, grade: true, moeAlignments: true } },
      },
    });
    if (sw) {
      subject = sw.content.subject;
      grade = sw.content.grade;
      moeAlignments = (sw.content.moeAlignments as Array<{ code: string }>) ?? [];
    }
  }

  if (!subject || !grade) return;

  const prismaSubject = SUBJECT_MAP[subject.toUpperCase()];
  if (!prismaSubject) return;

  const gradeBand = gradeToBand(grade);
  const normalizedScore = Math.min(1, Math.max(0, session.score / 100));
  const codes = moeAlignments.map((a) => a.code).filter(Boolean);
  if (codes.length === 0) return;

  // Look up a strand in StrandCatalog that matches subject + gradeBand
  const strand = await prisma.strandCatalog.findFirst({
    where: { subject: prismaSubject, gradeBand, isActive: true },
    select: { strandKey: true },
  });
  if (!strand) return;

  await updateMasteryProfile({
    studentId: student.id,
    schoolId,
    subject: prismaSubject,
    strandKey: strand.strandKey,
    gradeBand,
    newScore: normalizedScore,
    wasAiAssisted: false,
    totalAttempts: 1,
    aiAssistedAttempts: 0,
  });
}
