// route-policy: auth=session; scope=record; authority=class-teacher-subject-coteacher-or-school-admin; rationale=linking a lab to scheduled work creates a LabSession per enrolled learner, so it needs class.lesson.support from lib/authz/classAuthority for the scheduled work's class: the class teacher, an ADMIN of the class's school, or a co-teacher assigned exactly the lab's Subject (free-text lab subjects grant co-teachers nothing); any other viewer, a missing or mismatched school, is refused before the roster is read or anything is written (AT-GRADE-01 batch 2b)
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { authorizeClassAccess, isClassAccessDenied, isExactSubjectValue } from "@/lib/authz/classAuthority";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * POST /api/teacher/schedule/[id]/lab
 * Part 7: Link a virtual lab to a scheduled work and create sessions for all enrolled students.
 * Body: { labId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { id } = params;
    if (!user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sw = await prisma.scheduledWork.findUnique({
      where: { id },
      include: { class: { select: { schoolId: true } } },
    });

    if (!sw || !sw.class.schoolId || sw.class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Whole-class authority, or a co-teacher of this class (subject_required) decided by the lab's subject below.
    const classAccess = await authorizeClassAccess(user, { classId: sw.classId, fn: "class.lesson.support" });
    if (isClassAccessDenied(classAccess) && classAccess.reason !== "subject_required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { labId } = await req.json();
    if (!labId) {
      return NextResponse.json({ error: "labId required" }, { status: 400 });
    }

    // Validate lab access (platform-wide or school-specific)
    const lab = await prisma.virtualLab.findUnique({ where: { labId } });
    if (!lab) {
      return NextResponse.json({ error: "Lab not found" }, { status: 404 });
    }
    if (lab.schoolId !== null && lab.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (lab.status !== "published") {
      return NextResponse.json({ error: "Lab is not published" }, { status: 400 });
    }
    if (!classAccess.allowed && !(isExactSubjectValue(lab.subject) &&
        (await authorizeClassAccess(user, { classId: sw.classId, subject: lab.subject, fn: "class.lesson.support" })).allowed)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all enrolled students for this class
    const enrollments = await prisma.enrollment.findMany({
      where: { classId: sw.classId },
      include: { Student: { select: { userId: true } } },
    });

    // Create a LabSession for each enrolled student
    const sessionData = enrollments.map((e) => ({
      labId: lab.labId,
      studentId: e.Student.userId,
      scheduledWorkId: sw.id,
      schoolId: user.schoolId!,
    }));

    const created = await prisma.labSession.createMany({
      data: sessionData,
      skipDuplicates: true,
    });

    // Update ScheduledWork.suggestedLabs to include/replace this lab
    const currentLabs = (sw.suggestedLabs as any[]) ?? [];
    const labEntry = {
      id: lab.id,
      labId: lab.labId,
      title: lab.title,
      labType: lab.labType,
      estimatedMinutes: lab.estimatedMinutes,
    };
    const updatedLabs = [
      ...currentLabs.filter((l: any) => l.labId !== lab.labId),
      labEntry,
    ];

    await prisma.scheduledWork.update({
      where: { id: sw.id },
      data: { suggestedLabs: updatedLabs },
    });

    await logAudit({
      userId: user.id,
      action: "lab.linked",
      resourceType: "scheduledWork",
      resourceId: sw.id,
      details: { labId: lab.labId, studentCount: created.count },
      schoolId: user.schoolId ?? undefined,
    });

    return NextResponse.json({ ok: true, sessionCount: created.count });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to link lab" },
      { status: err?.status ?? 500 }
    );
  }
}
