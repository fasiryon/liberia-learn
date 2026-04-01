import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { generatePin } from "@/lib/credentials";
import {
  normalizeCredentialPhone,
  normalizeLoginId,
  slugifyLoginSeed,
} from "@/lib/login-identifiers";

const CreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  loginId: z.string().optional(),
  phone: z.string().optional(),
  subjectSpecialty: z.string().optional(),
});

const PatchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["edit", "deactivate", "resendInvite"]),
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  subjectSpecialty: z.string().optional().or(z.literal("")),
});

type TeacherSettings = {
  active?: boolean;
  subjectSpecialty?: string | null;
};

function readTeacherSettings(value: unknown): TeacherSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    active: typeof record.active === "boolean" ? record.active : undefined,
    subjectSpecialty:
      typeof record.subjectSpecialty === "string" ? record.subjectSpecialty : null,
  };
}

function mergeTeacherSettings(value: unknown, updates: TeacherSettings) {
  const current = readTeacherSettings(value);
  return {
    ...current,
    ...updates,
  };
}

async function buildUniqueLoginId(preferred: string | undefined, fallbackSeed: string) {
  const base = normalizeLoginId(preferred && preferred.trim() ? preferred : fallbackSeed);
  let candidate = base;
  let attempt = 1;

  while (attempt <= 10) {
    const existing = await prisma.user.findFirst({
      where: { loginId: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now().toString().slice(-4)}`;
}

async function buildUniqueEmail(baseSeed: string, email?: string) {
  const baseEmailLocal = slugifyLoginSeed(baseSeed) || `teacher-${Date.now()}`;
  let candidate = (email ?? `${baseEmailLocal}@teacher.local`).toLowerCase();
  let attempt = 0;

  while (attempt < 5) {
    const existing = await prisma.user.findUnique({ where: { email: candidate } });
    if (!existing) break;
    attempt += 1;
    candidate = `${baseEmailLocal}-${attempt}@teacher.local`;
  }

  return candidate;
}

export async function GET() {
  try {
    const admin = await requireRole("ADMIN");
    if (!admin.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const teachers = await prisma.user.findMany({
      where: { schoolId: admin.schoolId, role: "TEACHER" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        loginId: true,
        guardianPhoneE164: true,
        TeacherProfile: {
          select: {
            fullName: true,
            phone: true,
            permissions: true,
          },
        },
        teacherOf: {
          select: { id: true, name: true, subject: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      teachers: teachers.map((teacher) => {
        const settings = readTeacherSettings(teacher.TeacherProfile?.permissions);
        return {
          id: teacher.id,
          name: teacher.TeacherProfile?.fullName ?? teacher.name ?? "Teacher",
          email: teacher.email,
          loginId: teacher.loginId,
          phone: teacher.TeacherProfile?.phone ?? teacher.guardianPhoneE164 ?? null,
          contact:
            teacher.TeacherProfile?.phone ??
            teacher.guardianPhoneE164 ??
            teacher.email ??
            null,
          classes: teacher.teacherOf.map((cls) => ({
            id: cls.id,
            name: cls.name,
            subject: cls.subject,
          })),
          subjectSpecialty: settings.subjectSpecialty ?? null,
          status: settings.active === false ? "INACTIVE" : "ACTIVE",
        };
      }),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    if (!admin.schoolId) {
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

    const { fullName, email, loginId: requestedLoginId, phone, subjectSpecialty } = parsed.data;
    const loginId = await buildUniqueLoginId(
      requestedLoginId,
      `TCH-${new Date().getFullYear()}-${slugifyLoginSeed(fullName) || Date.now().toString().slice(-4)}`
    );
    const candidateEmail = await buildUniqueEmail(loginId, email);
    const tempPin = generatePin();
    const hashedPwd = await bcrypt.hash(tempPin, 10);
    const phoneE164 = phone ? normalizeCredentialPhone(phone) : null;

    const created = await prisma.user.create({
      data: {
        email: candidateEmail,
        loginId,
        name: fullName.trim(),
        role: "TEACHER",
        hashedPwd,
        schoolId: admin.schoolId,
        guardianCountryCode: "+231",
        guardianPhone: phone || null,
        guardianPhoneE164: phoneE164,
        preferredChannel: phoneE164 ? "SMS" : "EMAIL",
        TeacherProfile: {
          create: {
            id: randomUUID(),
            schoolId: admin.schoolId,
            fullName: fullName.trim(),
            phone: phoneE164,
            permissions: mergeTeacherSettings(null, {
              active: true,
              subjectSpecialty: subjectSpecialty?.trim() || null,
            }),
            gradesTaught: [],
            subjectsTaught: [],
            isOnboarded: false,
            updatedAt: new Date(),
          },
        },
      },
      select: {
        id: true,
        email: true,
        loginId: true,
        name: true,
        guardianPhoneE164: true,
      },
    });

    void logAudit({
      userId: admin.id,
      schoolId: admin.schoolId,
      action: "admin.teachers.created",
      resourceType: "user",
      resourceId: created.id,
    });

    return NextResponse.json({
      ok: true,
      teacher: created,
      tempPin,
      loginId,
      userId: created.id,
      phone: created.guardianPhoneE164,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    if (!admin.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, action, fullName, email, phone, subjectSpecialty } = parsed.data;

    const teacher = await prisma.user.findFirst({
      where: { id, schoolId: admin.schoolId, role: "TEACHER" },
      select: {
        id: true,
        email: true,
        loginId: true,
        guardianPhoneE164: true,
        TeacherProfile: {
          select: { fullName: true, phone: true, permissions: true },
        },
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    if (action === "deactivate") {
      await prisma.$transaction([
        prisma.teacherProfile.update({
          where: { userId: id },
          data: {
            permissions: mergeTeacherSettings(teacher.TeacherProfile?.permissions, { active: false }),
            updatedAt: new Date(),
          },
        }),
      ]);

      void logAudit({
        userId: admin.id,
        schoolId: admin.schoolId,
        action: "admin.teachers.deactivated",
        resourceType: "user",
        resourceId: id,
      });

      return NextResponse.json({ ok: true, status: "INACTIVE" });
    }

    if (action === "edit") {
      const trimmedName = fullName?.trim();
      const trimmedPhone = phone?.trim() || null;
      const normalizedPhone = trimmedPhone ? normalizeCredentialPhone(trimmedPhone) : null;
      const trimmedEmail = email?.trim();

      await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data: {
            name: trimmedName,
            email: trimmedEmail || teacher.email,
            guardianPhone: trimmedPhone,
            guardianPhoneE164: normalizedPhone,
            preferredChannel: normalizedPhone ? "SMS" : "EMAIL",
          },
        }),
        prisma.teacherProfile.update({
          where: { userId: id },
          data: {
            fullName: trimmedName ?? teacher.TeacherProfile?.fullName ?? "Teacher",
            phone: normalizedPhone,
            permissions: mergeTeacherSettings(teacher.TeacherProfile?.permissions, {
              active: true,
              subjectSpecialty: subjectSpecialty?.trim() || null,
            }),
            updatedAt: new Date(),
          },
        }),
      ]);

      void logAudit({
        userId: admin.id,
        schoolId: admin.schoolId,
        action: "admin.teachers.updated",
        resourceType: "user",
        resourceId: id,
      });

      return NextResponse.json({ ok: true });
    }

    // resendInvite — reset password
    const tempPin = generatePin();
    const hashedPwd = await bcrypt.hash(tempPin, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          hashedPwd,
          preferredChannel:
            (teacher.TeacherProfile?.phone ?? teacher.guardianPhoneE164) ? "SMS" : "EMAIL",
        },
      }),
      prisma.teacherProfile.update({
        where: { userId: id },
        data: {
          permissions: mergeTeacherSettings(teacher.TeacherProfile?.permissions, {
            active: true,
            subjectSpecialty:
              subjectSpecialty?.trim() ??
              readTeacherSettings(teacher.TeacherProfile?.permissions).subjectSpecialty ??
              null,
          }),
          updatedAt: new Date(),
        },
      }),
    ]);

    void logAudit({
      userId: admin.id,
      schoolId: admin.schoolId,
      action: "admin.teachers.password_reset",
      resourceType: "user",
      resourceId: id,
    });

    return NextResponse.json({
      ok: true,
      userId: id,
      loginId: teacher.loginId,
      tempPin,
      phone: teacher.TeacherProfile?.phone ?? teacher.guardianPhoneE164 ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
