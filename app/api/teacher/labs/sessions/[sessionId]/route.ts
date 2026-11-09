// route-policy: auth=session; scope=record; authority=class-teacher-subject-coteacher-or-school-admin; rationale=one learner's lab session of a class's scheduled work: GET needs class.read.learning and PATCH (a teacher score 0-100 with feedback, an assessment judgement) needs class.assessment.review from lib/authz/classAuthority for that class (class teacher or an ADMIN of its school; a subject co-teacher only when VirtualLab.subject is exactly the assigned Subject); other teachers 403 before any lab read or write; no scheduled work, another school or unknown session 404 (AT-GRADE-01-LSID)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, type SessionUser } from "@/lib/auth";
import { authorizeClassAccess, isClassAccessDenied, isExactSubjectValue, type ClassFunction } from "@/lib/authz/classAuthority";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const ReviewSchema = z.object({
  score: z.number().int().min(0).max(100),
  teacherFeedback: z.string().trim().min(10).max(2000),
});

type AuthorizedSessionResult =
  | {
      ok: true;
      session: any;
      scheduledWork: any;
      lab: { labId: string; title: string; payload: unknown; subject: string } | null;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

/**
 * The session, its scheduled work and its lab, when this user holds `fn` for the session's class (AT-GRADE-01-LSID):
 * whole-class authority (class teacher or school ADMIN), or a subject co-teacher of that class when the lab's subject is
 * exactly their assigned Subject. Unknown, unscheduled or other-school sessions are 404; no class basis is 403.
 */
async function resolveAuthorizedSession(
  sessionId: string,
  user: SessionUser,
  schoolId: string,
  fn: ClassFunction
): Promise<AuthorizedSessionResult> {
  const session = await prisma.labSession.findUnique({
    where: { id: sessionId },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
  });

  if (!session || session.schoolId !== schoolId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  if (!session.scheduledWorkId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  const scheduledWork = await prisma.scheduledWork.findUnique({
    where: { id: session.scheduledWorkId },
    include: {
      class: { select: { teacherId: true, schoolId: true, name: true } },
    },
  });

  if (!scheduledWork || scheduledWork.class.schoolId !== schoolId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  // Whole-class authority, or a co-teacher of this class (subject_required) decided by the lab's exact subject.
  const classAccess = await authorizeClassAccess(user, { classId: scheduledWork.classId, fn });
  if (isClassAccessDenied(classAccess) && classAccess.reason !== "subject_required") {
    return { ok: false, error: "Forbidden", status: 403 };
  }
  const lab = await prisma.virtualLab.findUnique({
    where: { labId: session.labId },
    select: { labId: true, title: true, payload: true, subject: true },
  });
  if (!classAccess.allowed && !(lab && isExactSubjectValue(lab.subject) &&
      (await authorizeClassAccess(user, { classId: scheduledWork.classId, subject: lab.subject, fn })).allowed)) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  return { ok: true, session, scheduledWork, lab };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    const authorized = await resolveAuthorizedSession(params.sessionId, user, user.schoolId, "class.read.learning");
    if ("error" in authorized) {
      return NextResponse.json({ error: authorized.error }, { status: authorized.status });
    }

    const lab = authorized.lab ? { labId: authorized.lab.labId, title: authorized.lab.title, payload: authorized.lab.payload } : null;

    return NextResponse.json({
      session: authorized.session,
      className: authorized.scheduledWork.class.name,
      lab,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load lab session" }, { status: err?.status ?? 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    // A teacher score is an assessment judgement (CoS ruling): class.assessment.review, not class.feedback.
    const authorized = await resolveAuthorizedSession(params.sessionId, user, user.schoolId, "class.assessment.review");
    if ("error" in authorized) {
      return NextResponse.json({ error: authorized.error }, { status: authorized.status });
    }

    const parsed = ReviewSchema.parse(await req.json());
    const updated = await prisma.labSession.update({
      where: { id: params.sessionId },
      data: {
        score: parsed.score,
        teacherFeedback: parsed.teacherFeedback,
      },
    });

    await logAudit({
      userId: user.id,
      action: "lab.session.reviewed",
      resourceType: "labSession",
      resourceId: params.sessionId,
      schoolId: user.schoolId,
      details: { score: parsed.score },
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to review lab session" }, { status: err?.status ?? 500 });
  }
}
