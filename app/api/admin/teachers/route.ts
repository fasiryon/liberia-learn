import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { generatePin } from "@/lib/credentials";
import { normalizeCredentialPhone, normalizeLoginId, slugifyLoginSeed } from "@/lib/login-identifiers";

const CreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  loginId: z.string().optional(),
  phone: z.string().optional(),
});

async function buildUniqueLoginId(preferred: string | undefined, fallbackSeed: string) {
  const base = normalizeLoginId(preferred && preferred.trim() ? preferred : fallbackSeed);
  let candidate = base;
  let attempt = 1;

  while (attempt <= 10) {
    const existing = await prisma.user.findFirst({ where: { loginId: candidate }, select: { id: true } });
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now().toString().slice(-4)}`;
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
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    const { fullName, email, loginId: requestedLoginId, phone } = parsed.data;
    const loginId = await buildUniqueLoginId(requestedLoginId, `TCH-${new Date().getFullYear()}-${slugifyLoginSeed(fullName) || Date.now().toString().slice(-4)}`);
    const baseEmailLocal = slugifyLoginSeed(loginId) || `teacher-${Date.now()}`;
    let candidate = (email ?? `${baseEmailLocal}@teacher.local`).toLowerCase();
    let attempt = 0;

    while (attempt < 5) {
      const existing = await prisma.user.findUnique({ where: { email: candidate } });
      if (!existing) break;
      attempt += 1;
      candidate = `${baseEmailLocal}-${attempt}@teacher.local`;
    }

    const tempPin = generatePin();
    const hashedPwd = await bcrypt.hash(tempPin, 10);
    const phoneE164 = phone ? normalizeCredentialPhone(phone) : null;

    const created = await prisma.user.create({
      data: {
        email: candidate,
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
            permissions: null,
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

