import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  createClassForSchool,
  deactivateTeacherForSchool,
  getPrincipalSchoolDashboard,
  inviteTeacherToSchool,
  moveStudentBetweenClasses,
} from "@/lib/school-operations";

export const dynamic = "force-dynamic";

const SubjectSchema = z.enum([
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
]);

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("inviteTeacher"),
    fullName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    subjectSpecialty: z.string().optional(),
  }),
  z.object({
    action: z.literal("deactivateTeacher"),
    teacherId: z.string().min(1),
  }),
  z.object({
    action: z.literal("createClass"),
    name: z.string().min(2),
    subject: SubjectSchema,
    gradeLevel: z.coerce.number().int().min(1).max(12).optional(),
    teacherId: z.string().optional(),
  }),
  z.object({
    action: z.literal("moveStudent"),
    studentId: z.string().min(1),
    targetClassId: z.string().min(1),
  }),
  z.object({
    action: z.literal("updateProfile"),
    name: z.string().min(2).optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    district: z.string().optional(),
  }),
]);

async function requireSchoolAdmin() {
  const user = await requireRole("ADMIN");
  if (!user.schoolId) {
    throw Object.assign(new Error("School context required"), { status: 400 });
  }
  return user;
}

export async function GET() {
  try {
    const user = await requireSchoolAdmin();
    const dashboard = await getPrincipalSchoolDashboard(user.schoolId!);
    return NextResponse.json({ ok: true, dashboard });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireSchoolAdmin();
    const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    const schoolId = user.schoolId!;
    const body = parsed.data;

    if (body.action === "inviteTeacher") {
      const result = await inviteTeacherToSchool({
        actorUserId: user.id,
        schoolId,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
        subjectSpecialty: body.subjectSpecialty,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "deactivateTeacher") {
      await deactivateTeacherForSchool({ actorUserId: user.id, schoolId, teacherId: body.teacherId });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "createClass") {
      const result = await createClassForSchool({
        actorUserId: user.id,
        schoolId,
        name: body.name,
        subject: body.subject,
        gradeLevel: body.gradeLevel,
        teacherId: body.teacherId || null,
      });
      return NextResponse.json({ ok: true, classId: result.id });
    }

    if (body.action === "moveStudent") {
      await moveStudentBetweenClasses({
        actorUserId: user.id,
        schoolId,
        studentId: body.studentId,
        targetClassId: body.targetClassId,
      });
      return NextResponse.json({ ok: true });
    }

    const data: Record<string, string> = {};
    if (body.name) data.name = body.name.trim();
    if (body.contactName !== undefined) data.contactName = body.contactName.trim();
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail.trim();
    if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone.trim();
    if (body.district !== undefined) data.district = body.district.trim();

    await prisma.school.update({ where: { id: schoolId }, data });
    await logAudit({
      userId: user.id,
      schoolId,
      action: "school.profile.updated",
      resourceType: "school",
      resourceId: schoolId,
      details: data,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}
