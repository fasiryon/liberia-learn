import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { normalizeCredentialPhone, slugifyLoginSeed, normalizeLoginId } from "@/lib/login-identifiers";
import { checkRateLimit, RATE_LIMIT_POLICIES, rateLimitExceededResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Same safe login-id builder used in student route and school-operations
async function buildUniqueLoginId(seed: string) {
  const base = normalizeLoginId(slugifyLoginSeed(seed) || "GUARDIAN");
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
  const rateLimit = await checkRateLimit(`register:guardian:${ip}`, {
    windowMs: RATE_LIMIT_POLICIES.AI_HEAVY.windowMs,
    limit: 10,
    namespace: "guardian_registration",
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
    email,
    phone,
    schoolCode,
    studentFullName,
    studentDateOfBirth,
    password,
    confirmPassword,
  } = body as Record<string, string>;

  // Server-side validation
  if (!fullName?.trim()) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  if (!email?.trim() && !phone?.trim()) {
    return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
  }
  if (!schoolCode?.trim()) return NextResponse.json({ error: "School code is required" }, { status: 400 });
  if (!studentFullName?.trim()) return NextResponse.json({ error: "Student full name is required" }, { status: 400 });
  if (!studentDateOfBirth) return NextResponse.json({ error: "Student date of birth is required" }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  const emailNorm = email?.trim().toLowerCase() || null;
  const phoneE164 = phone?.trim() ? normalizeCredentialPhone(phone.trim()) : null;

  // Validate school code → ACTIVE school
  const school = await prisma.school.findUnique({
    where: { code: schoolCode.trim().toUpperCase() },
    select: { id: true, name: true, status: true },
  });
  if (!school || school.status !== "ACTIVE") {
    // Generic error — do not reveal whether school or student match failed
    return NextResponse.json({ error: "Could not verify student details. Please check the school code, student name, and date of birth." }, { status: 400 });
  }

  // Duplicate check for guardian account
  if (emailNorm) {
    const existing = await prisma.user.findFirst({ where: { email: emailNorm }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  if (phoneE164) {
    const existing = await prisma.user.findFirst({ where: { guardianPhoneE164: phoneE164 }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "An account with this phone number already exists" }, { status: 409 });
  }

  // Match student by school + name (case-insensitive trim) + DOB
  // Use date range spanning the full day to be tolerant of time-zone offsets
  const dobStart = new Date(studentDateOfBirth);
  dobStart.setUTCHours(0, 0, 0, 0);
  const dobEnd = new Date(dobStart.getTime() + 86400000);

  const studentNameNorm = studentFullName.trim().toLowerCase();

  const matchedStudent = await prisma.student.findFirst({
    where: {
      user: {
        schoolId: school.id,
        name: { equals: studentFullName.trim(), mode: "insensitive" },
      },
      dateOfBirth: { gte: dobStart, lt: dobEnd },
    },
    select: { id: true, userId: true },
  });

  // Always return the same error whether student not found or school not found
  // to prevent student existence enumeration
  if (!matchedStudent) {
    return NextResponse.json(
      { error: "Could not verify student details. Please check the school code, student name, and date of birth." },
      { status: 400 }
    );
  }

  const hashedPwd = await bcrypt.hash(password, 10);
  const loginId = await buildUniqueLoginId(fullName.trim());

  const result = await prisma.$transaction(async (tx) => {
    const guardianUser = await tx.user.create({
      data: {
        email: emailNorm ?? `${loginId.toLowerCase()}@no-email.liberialearn.internal`,
        loginId,
        name: fullName.trim(),
        role: "GUARDIAN",
        hashedPwd,
        schoolId: school.id,
        guardianPhone: phone?.trim() || null,
        guardianPhoneE164: phoneE164,
        preferredChannel: phoneE164 ? "SMS" : "EMAIL",
      },
      select: { id: true, loginId: true },
    });

    await tx.studentGuardian.create({
      data: {
        studentId: matchedStudent.id,
        guardianId: guardianUser.id,
      },
    });

    return { guardianUser };
  });

  await logAudit({
    action: "USER_CREATED",
    resourceType: "user",
    resourceId: result.guardianUser.id,
    schoolId: school.id,
    details: { role: "GUARDIAN", method: "self_registration", loginId },
  });

  await logLearningEvent({
    schoolId: school.id,
    userId: result.guardianUser.id,
    eventType: "GUARDIAN_SELF_REGISTERED",
    source: "self-registration",
    metadata: { schoolCode: schoolCode.trim().toUpperCase() },
  });

  return NextResponse.json({ loginId: result.guardianUser.loginId }, { status: 201 });
}
