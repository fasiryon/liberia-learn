import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { randomUUID } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generatePin } from "@/lib/credentials";
import { normalizeCredentialPhone, slugifyLoginSeed } from "@/lib/login-identifiers";
import { generateStudentId } from "@/lib/studentId";
import { createUniqueHumanReadableStudentId } from "@/lib/students/humanReadableId";

export const dynamic = "force-dynamic";

export async function GET(req?: Request) {
  let user: any;
  try {
    user = await requireRole("ADMIN");
  } catch (err: any) {
    const status = err?.status === 403 ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "forbidden" : "unauthorized" }, { status });
  }

  const schoolId = user.schoolId ?? null;
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId required" }, { status: 400 });
  }

  try {
    const rows = await prisma.student.findMany({
      where: { user: { schoolId } },
      select: {
        id: true,
        currentGrade: true,
        enrollments: {
          take: 1,
          select: {
            classId: true,
            Class: { select: { name: true, subject: true } },
          },
        },
        user: { select: { id: true, name: true, email: true, loginId: true, guardianPhoneE164: true } },
      },
    });

    const students = rows.map((s) => {
      const enrollment = (s as any).enrollments?.[0] ?? null;
      return {
        id: s.id,
        userId: s.user.id,
        name: s.user?.name ?? s.user?.email ?? "Student",
        email: s.user?.email ?? null,
        loginId: s.user?.loginId ?? null,
        phone: s.user?.guardianPhoneE164 ?? null,
        currentGrade: s.currentGrade ?? null,
        classId: enrollment?.classId ?? null,
        className: enrollment?.Class?.name ?? null,
        subject: enrollment?.Class?.subject ? String(enrollment.Class.subject) : null,
      };
    });

    await logAudit({
      userId: user.id,
      action: "admin.students.listed",
      resourceType: "student_roster",
      schoolId,
      details: { count: students.length },
    });

    return NextResponse.json({ students }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  grade: z.number().int().min(1).max(12),
  classId: z.string().min(1),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  studentId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    const { firstName, lastName, grade, classId, email, phone, dateOfBirth } = parsed.data;

    const [cls, school, existingStudentCount] = await Promise.all([
      prisma.class.findUnique({ where: { id: classId }, select: { id: true, schoolId: true } }),
      prisma.school.findUnique({ where: { id: user.schoolId }, select: { id: true, code: true } }),
      prisma.user.count({ where: { schoolId: user.schoolId, role: "STUDENT" } }),
    ]);

    if (!cls || cls.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Invalid class" }, { status: 400 });
    }

    if (!school?.code) {
      return NextResponse.json({ error: "School code is required before creating student accounts" }, { status: 400 });
    }

    const dob = dateOfBirth ? new Date(`${dateOfBirth}T00:00:00.000Z`) : null;
    if (dob && Number.isNaN(dob.getTime())) {
      return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
    }

    if (dob) {
      const duplicate = await prisma.student.findFirst({
        where: {
          dateOfBirth: dob,
          user: {
            schoolId: user.schoolId,
            name: { equals: `${firstName} ${lastName}`.trim(), mode: "insensitive" },
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ error: "Duplicate student with same name and date of birth" }, { status: 409 });
      }
    }

    let sequence = existingStudentCount + 1;
    let loginId = generateStudentId({
      schoolCode: school.code,
      year: new Date().getFullYear(),
      sequence,
    });

    while (await prisma.user.findFirst({ where: { loginId }, select: { id: true } })) {
      sequence += 1;
      loginId = generateStudentId({
        schoolCode: school.code,
        year: new Date().getFullYear(),
        sequence,
      });
    }

    const baseEmailLocal = slugifyLoginSeed(loginId) || `student-${Date.now()}`;
    let candidate = (email ?? `${baseEmailLocal}@student.local`).toLowerCase();

    let attempt = 0;
    while (attempt < 5) {
      const existing = await prisma.user.findUnique({ where: { email: candidate } });
      if (!existing) break;
      attempt += 1;
      candidate = `${baseEmailLocal}-${attempt}@student.local`;
    }

    const tempPin = generatePin();
    const hashedPwd = await bcrypt.hash(tempPin, 10);
    const phoneE164 = phone ? normalizeCredentialPhone(phone) : null;

    const [created, student] = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: candidate,
          loginId,
          name: `${firstName} ${lastName}`.trim(),
          role: "STUDENT",
          hashedPwd,
          mustChangePIN: true,
          schoolId: user.schoolId,
          guardianCountryCode: "+231",
          guardianPhone: phone || null,
          guardianPhoneE164: phoneE164,
          preferredChannel: phoneE164 ? "SMS" : "EMAIL",
        },
      });

      const humanReadableStudentId = await createUniqueHumanReadableStudentId(tx);
      const newStudent = await tx.student.create({
        data: { userId: newUser.id, currentGrade: grade, dateOfBirth: dob, humanReadableStudentId },
      });

      await tx.enrollment.create({ data: { studentId: newStudent.id, classId } });

      return [newUser, newStudent] as const;
    });

    await logAudit({
      userId: user.id,
      action: "admin.students.created",
      resourceType: "student",
      resourceId: student.id,
      schoolId: user.schoolId,
      traceId,
      details: {
        classId,
        currentGrade: grade,
        loginId,
        hasPhone: Boolean(phoneE164),
      },
    });

    return NextResponse.json({
      ok: true,
      student: {
        id: student.id,
        userId: created.id,
        name: created.name,
        email: created.email,
        loginId,
        phone: phoneE164,
        currentGrade: student.currentGrade,
        classId,
      },
      tempPin,
      loginId,
      userId: created.id,
      phone: phoneE164,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}

