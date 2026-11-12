// route-policy: auth=session; scope=record; authority=class-assessment-review; rationale=a current teacher reviews only a same-school active student's capstone through locked class authority; status, portfolio and required audit commit together; push follows commit
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizeClassAccessWithClient } from "@/lib/authz/classAuthority";
import { logAuditRequired } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";

const schema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), feedback: z.string().max(16000).optional() });
const fail = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }); };

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (user.role !== "TEACHER" || !user.schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid review" }, { status: 400 });
    const { decision, feedback } = parsed.data;
    if (decision === "REJECTED" && !feedback?.trim()) return NextResponse.json({ error: "Feedback is required when rejecting" }, { status: 400 });

    const result = await prisma.$transaction(async tx => {
      const current = (await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "User" WHERE "id"=${user.id} AND "role"::text='TEACHER'
        AND "schoolId"=${user.schoolId} FOR SHARE`))[0];
      if (!current) fail(403, "Forbidden");
      const project = await tx.capstoneProject.findUnique({ where: { id: params.id }, include: {
        Student: { include: { user: { select: { schoolId: true } } } },
      } });
      if (!project || project.Student.deletedAt || project.Student.user.schoolId !== user.schoolId) fail(404, "Not found");
      const student = (await tx.$queryRaw<Array<{ id: string; userId: string }>>(Prisma.sql`
        SELECT s."id",s."userId" FROM "Student" s JOIN "User" u ON u."id"=s."userId"
        WHERE s."id"=${project.studentId} AND s."deletedAt" IS NULL AND u."schoolId"=${user.schoolId} FOR SHARE OF s,u`))[0];
      if (!student) fail(404, "Not found");
      const enrollments = await tx.$queryRaw<Array<{ classId: string }>>(Prisma.sql`
        SELECT "classId" FROM "Enrollment" WHERE "studentId"=${project.studentId} ORDER BY "classId" FOR SHARE`);
      let authorized = false;
      for (const enrollment of enrollments) {
        const cls = (await tx.$queryRaw<Array<{ subject: string }>>(Prisma.sql`
          SELECT "subject"::text AS "subject" FROM "Class"
          WHERE "id"=${enrollment.classId} AND "schoolId"=${user.schoolId} FOR SHARE`))[0];
        if (!cls) continue;
        const authority = await authorizeClassAccessWithClient(tx, user, {
          classId: enrollment.classId, subject: cls.subject, fn: "class.assessment.review",
        });
        if (authority.allowed) { authorized = true; break; }
      }
      if (!authorized) fail(404, "Not found");
      if (project.status !== "SUBMITTED") fail(400, "Only SUBMITTED projects can be reviewed");
      const changed = await tx.capstoneProject.updateMany({
        where: { id: project.id, status: "SUBMITTED", studentId: project.studentId,
          Student: { deletedAt: null, user: { schoolId: user.schoolId } } },
        data: { status: decision, teacherId: user.id, teacherFeedback: feedback ?? null, reviewedAt: new Date() },
      });
      if (changed.count !== 1) fail(409, "Project changed. Refresh before reviewing.");
      if (decision === "APPROVED") await tx.portfolioItem.create({ data: {
        studentId: project.studentId, kind: "CAPSTONE", title: project.title, capstoneProjectId: project.id,
      } });
      await logAuditRequired({ userId: user.id, schoolId: user.schoolId, action: "teacher.capstone.reviewed",
        resourceType: "capstone_project", resourceId: project.id,
        details: { studentId: project.studentId, previousStatus: "SUBMITTED", decision } }, tx);
      return { updated: await tx.capstoneProject.findUniqueOrThrow({ where: { id: project.id } }), studentUserId: student.userId };
    });

    const pushPayload = decision === "APPROVED"
      ? { title: "Your capstone was approved! \u{1F389}", body: "Great work! Check your portfolio.", url: "/student/capstone" }
      : { title: "Your capstone needs revision", body: "Your teacher left feedback. Revise and resubmit.", url: "/student/capstone" };
    void sendPushToUser(result.studentUserId, pushPayload).catch(() => null);
    return NextResponse.json(result.updated);
  } catch (error: unknown) {
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: status >= 500 ? "Review could not be saved" : error instanceof Error ? error.message : "Forbidden" }, { status });
  }
}
