// route-policy: auth=session; scope=record; authority=class-teacher-subject-coteacher-or-school-admin; rationale=the class's primary teacher or an ADMIN of its school reads all of the class's lab-session aggregates; a subject co-teacher reads only labs of the subjects their TeacherAssignment gives for that class (only when VirtualLab.subject is exactly the assigned Subject value; unclassified labs (free-text subject) are withheld from co-teachers); other same-school teachers and other schools are refused (AT-GRADE-01); decided by lib/authz/classAuthority (class.read.learning); only sessions whose ScheduledWork belongs to the requested class are returned, never another class's or unscheduled sessions of the same learners; scores and the class average count teacher-reviewed labs only
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { authorizeClassAccess, isClassAccessDenied, isExactSubjectValue } from "@/lib/authz/classAuthority";
import { prisma } from "@/lib/db";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";
import { isTeacherReviewed, labReviewSummary } from "@/lib/labs/labReview";

export const dynamic = "force-dynamic";

// VirtualLab.subject is free text: a co-teacher's lab access applies only when it is exactly the assigned Subject value
// (isExactSubjectValue, founder decision 3); unclassified labs are withheld from co-teachers.

/**
 * GET /api/teacher/labs/sessions?classId=
 * Part 7: Aggregate lab session data for all students in a class.
 * No student identifiers above teacher scope — aggregates only per lab.
 * AT-GRADE-01: class authority is checked before any roster or lab row is read.
 */
export async function GET(req: NextRequest) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json({ error: "classId required" }, { status: 400 });
    }

    // Whole class (CLASS_TEACHER / SCHOOL_ADMIN), or, for a co-teacher (subject_required), only the labs of the
    // subjects they are assigned for this class, decided per lab subject below. Any other denial stops here.
    const classAccess = await authorizeClassAccess(user, { classId, fn: "class.read.learning" });
    if (isClassAccessDenied(classAccess) && classAccess.reason !== "subject_required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { classId },
      select: { Student: { select: { userId: true } } },
    });
    const studentIds = enrollments.map((e) => e.Student.userId);

    if (studentIds.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Record scope: authority over class A covers A's records only. A session belongs to this class when its scheduled
    // work does; another class's session of the same learner, or a session scheduled for no class, is not returned.
    const classWork = await prisma.scheduledWork.findMany({ where: { classId }, select: { id: true } });
    if (classWork.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const allSessions = await prisma.labSession.findMany({
      where: {
        studentId: { in: studentIds },
        schoolId: user.schoolId!,
        scheduledWorkId: { in: classWork.map((w) => w.id) },
      },
      select: {
        id: true,
        labId: true,
        startedAt: true,
        completedAt: true,
        score: true,
        teacherFeedback: true,
      },
    });

    // Fetch lab titles and subjects; a subject co-teacher keeps only the labs of their assigned subjects.
    const labs = await prisma.virtualLab.findMany({
      where: { labId: { in: Array.from(new Set(allSessions.map((s) => s.labId))) } },
      select: { labId: true, title: true, subject: true },
    });
    const labById = new Map(labs.map((l) => [l.labId, l]));
    const subjectAllowed = new Map<string, boolean>();
    if (!classAccess.allowed) for (const subject of new Set(labs.map((l) => l.subject))) {
      subjectAllowed.set(subject, isExactSubjectValue(subject) && (await authorizeClassAccess(user, { classId, subject, fn: "class.read.learning" })).allowed);
    }
    // A lab with no lab record has no subject, so only whole-class viewers see it.
    const labSessions = allSessions.filter((s) => {
      if (classAccess.allowed) return true;
      const subject = labById.get(s.labId)?.subject;
      return subject !== undefined && subjectAllowed.get(subject) === true;
    });

    // Aggregate by labId. Only teacher-reviewed sessions are scored (AT-R-LAB); the rest are pending, never zero.
    const labMap = new Map<string, { labId: string; totalStudents: number; rows: typeof labSessions; sessions: any[] }>();
    for (const s of labSessions) {
      const entry = labMap.get(s.labId) ?? { labId: s.labId, totalStudents: 0, rows: [], sessions: [] };
      entry.totalStudents += 1;
      entry.rows.push(s);
      entry.sessions.push({ sessionId: s.id, startedAt: s.startedAt, completedAt: s.completedAt, score: isTeacherReviewed(s) ? s.score : null, reviewed: isTeacherReviewed(s) });
      labMap.set(s.labId, entry);
    }

    const result = Array.from(labMap.values()).map((entry) => ({
      labId: entry.labId,
      title: labById.get(entry.labId)?.title ?? entry.labId,
      totalStudents: entry.totalStudents,
      ...labReviewSummary(entry.rows),
      sessions: entry.sessions,
    }));

    return NextResponse.json({ sessions: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to get sessions" },
      { status: err?.status ?? 500 }
    );
  }
}
