import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { randomUUID } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let user: any;
  try {
    user = await requireRole("ADMIN");
  } catch (err: any) {
    const status = err?.status === 403 ? 403 : 401;
    return NextResponse.json(
      { error: status === 403 ? "forbidden" : "unauthorized" },
      { status }
    );
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
        user: { select: { name: true, email: true } },
      },
    });

    const students = rows.map((s) => ({
      id: s.id,
      name: s.user?.name ?? s.user?.email ?? "Student",
      email: s.user?.email ?? null,
    }));

    await logAudit({
      userId: user.id,
      action: "admin.students.listed",
      resourceType: "student_roster",
      schoolId,
      details: { count: students.length },
    });

    return NextResponse.json({ students }, { status: 200 });
  } catch (err: any) {
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
});

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      firstName,
      lastName,
      grade,
      classId,
      studentId,
      email,
    } = parsed.data;

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, schoolId: true },
    });
    if (!cls || cls.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Invalid class" }, { status: 400 });
    }

    const baseEmailLocal =
      (studentId && slugify(studentId)) ||
      slugify(`${firstName}.${lastName}`) ||
      `student-${Date.now()}`;
    let candidate = (email ?? `${baseEmailLocal}@student.local`).toLowerCase();

    // Ensure unique email
    let attempt = 0;
    while (attempt < 5) {
      const existing = await prisma.user.findUnique({ where: { email: candidate } });
      if (!existing) break;
      attempt++;
      candidate = `${baseEmailLocal}-${attempt}@student.local`;
    }

    const tempPin = generatePin();
    const hashedPwd = await bcrypt.hash(tempPin, 10);

    const created = await prisma.user.create({
      data: {
        email: candidate,
        name: `${firstName} ${lastName}`.trim(),
        role: "STUDENT",
        hashedPwd,
        schoolId: user.schoolId,
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: created.id,
        currentGrade: grade,
      },
    });

    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        classId,
      },
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
      },
    });

    return NextResponse.json({
      ok: true,
      student: {
        id: student.id,
        name: created.name,
        email: created.email,
        currentGrade: student.currentGrade,
        classId,
      },
      tempPin,
      loginId: created.email,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
