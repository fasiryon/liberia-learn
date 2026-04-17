import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { sendStudentWelcome } from "@/lib/email";
import { normalizeCredentialPhone, slugifyLoginSeed, normalizeLoginId } from "@/lib/login-identifiers";
import { checkRateLimit, RATE_LIMIT_POLICIES, rateLimitExceededResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

async function buildUniqueLoginId(seed: string) {
  const base = normalizeLoginId(slugifyLoginSeed(seed) || "STUDENT");
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

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkRateLimit(`register:student:${ip}`, {
    windowMs: RATE_LIMIT_POLICIES.AI_HEAVY.windowMs,
    limit: 10,
    namespace: "student_registration",
  });
  if (!rateLimit.allowed) return rateLimitExceededResponse(rateLimit);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    fullName,
    dateOfBirth,
    grade,
    schoolCode,
    email,
    phone,
    password,
    confirmPassword,
  } = body as Record<string, string>;

  // Server-side validation
  if (!fullName?.trim()) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  if (!dateOfBirth) return NextResponse.json({ error: "Date of birth is required" }, { status: 400 });
  const gradeNum = Number(grade);
  if (!grade || isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) {
    return NextResponse.json({ error: "Grade must be between 1 and 12" }, { status: 400 });
  }
  if (!schoolCode?.trim()) return NextResponse.json({ error: "School code is required" }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  const emailNorm = email?.trim().toLowerCase() || null;
  const phoneE164 = phone?.trim() ? normalizeCredentialPhone(phone.trim()) : null;

  // Validate school code maps to ACTIVE school
  const school = await prisma.school.findUnique({
    where: { code: schoolCode.trim().toUpperCase() },
    select: { id: true, name: true, status: true },
  });
  if (!school || school.status !== "ACTIVE") {
    return NextResponse.json({ error: "Invalid or inactive school code" }, { status: 400 });
  }

  // Duplicate check by email or phone
  if (emailNorm) {
    const existing = await prisma.user.findFirst({ where: { email: emailNorm }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  if (phoneE164) {
    const existing = await prisma.user.findFirst({ where: { guardianPhoneE164: phoneE164 }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "An account with this phone number already exists" }, { status: 409 });
  }

  const hashedPwd = await bcrypt.hash(password, 10);
  const loginId = await buildUniqueLoginId(fullName.trim());
  const dob = new Date(dateOfBirth);

  // Find matching class for this grade in the school (first available)
  const matchingClass = await prisma.class.findFirst({
    where: { schoolId: school.id, gradeLevel: gradeNum },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: emailNorm ?? `${loginId.toLowerCase()}@no-email.liberialearn.internal`,
        loginId,
        name: fullName.trim(),
        role: "STUDENT",
        hashedPwd,
        schoolId: school.id,
        guardianPhone: phone?.trim() || null,
        guardianPhoneE164: phoneE164,
        preferredChannel: phoneE164 ? "SMS" : "EMAIL",
      },
      select: { id: true, email: true, loginId: true },
    });

    const student = await tx.student.create({
      data: {
        userId: user.id,
        dateOfBirth: dob,
        currentGrade: gradeNum,
      },
      select: { id: true },
    });

    if (matchingClass) {
      await tx.enrollment.create({
        data: { studentId: student.id, classId: matchingClass.id },
      });
    }

    return { user, student };
  });

  await logAudit({
    action: "USER_CREATED",
    resourceType: "user",
    resourceId: result.user.id,
    schoolId: school.id,
    details: { role: "STUDENT", method: "self_registration", loginId },
  });

  await logLearningEvent({
    schoolId: school.id,
    userId: result.user.id,
    studentId: result.student.id,
    eventType: "STUDENT_SELF_REGISTERED",
    source: "self-registration",
    metadata: { grade: gradeNum, schoolCode: schoolCode.trim().toUpperCase() },
  });

  if (emailNorm && !emailNorm.endsWith("@no-email.liberialearn.internal")) {
    const loginUrl = `${process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app"}/login`;
    await sendStudentWelcome({
      to: emailNorm,
      studentName: fullName.trim(),
      schoolName: school.name,
      loginId: result.user.loginId!,
      loginUrl,
    }).catch(() => null);
  }

  return NextResponse.json({ loginId: result.user.loginId }, { status: 201 });
}
