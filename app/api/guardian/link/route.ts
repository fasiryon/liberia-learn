import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGuardianLinkingEnabled } from "@/lib/serverFlags";
import { findInviteByToken } from "@/lib/inviteTokens";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function nameScore(input: string, candidate: string | null) {
  const inputTokens = normalizeName(input);
  const candidateTokens = normalizeName(candidate ?? "");
  if (inputTokens.length === 0 || candidateTokens.length === 0) return 0;
  const candidateSet = new Set(candidateTokens);
  const matched = inputTokens.filter((token) => candidateSet.has(token)).length;
  const joinedInput = inputTokens.join(" ");
  const joinedCandidate = candidateTokens.join(" ");
  const containsBoost =
    joinedCandidate.includes(joinedInput) || joinedInput.includes(joinedCandidate) ? 0.35 : 0;
  return matched / Math.max(inputTokens.length, candidateTokens.length) + containsBoost;
}

function dateRange(value: string) {
  const start = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// HMAC-signed confirmation token — binds studentId + guardianId with 10-minute expiry.
// Stateless: no Redis dependency. timingSafeEqual prevents timing attacks on sig comparison.
function createConfirmToken(studentId: string, guardianId: string): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET not configured");
  const payload = { s: studentId, g: guardianId, exp: Date.now() + 10 * 60 * 1000 };
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", jwtSecret).update(raw).digest("hex");
  return `${raw}.${sig}`;
}

function verifyConfirmToken(token: string, guardianId: string): string | null {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return null;
    const dot = token.lastIndexOf(".");
    if (dot < 0) return null;
    const raw = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = crypto.createHmac("sha256", jwtSecret).update(raw).digest("hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    const actualBuf = Buffer.from(sig, "hex");
    if (
      expectedBuf.length !== actualBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString());
    if (payload.g !== guardianId) return null;
    if (Date.now() > payload.exp) return null;
    return payload.s as string;
  } catch {
    return null;
  }
}

async function handleSelfServiceLink(
  req: Request,
  user: Awaited<ReturnType<typeof requireRole>>,
  body: Record<string, unknown>,
) {
  // Rate limit: 10 attempts per hour per guardian (GC-002)
  const rateLimitResult = await checkRateLimit(`guardian-link:${user.id}`, {
    windowMs: 3_600_000,
    limit: 10,
    namespace: "guardian",
  });
  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  const schoolCode = typeof body.schoolCode === "string" ? body.schoolCode.trim().toUpperCase() : "";
  const studentFullName = typeof body.studentFullName === "string" ? body.studentFullName.trim() : "";
  const dateOfBirth = typeof body.dateOfBirth === "string" ? body.dateOfBirth.trim() : "";
  const confirmToken = typeof body.confirmToken === "string" ? body.confirmToken.trim() : "";
  const relation = typeof body.relation === "string" && body.relation.trim() ? body.relation.trim() : "Guardian";
  const range = dateRange(dateOfBirth);

  if (!schoolCode || !studentFullName || !range) {
    return NextResponse.json(
      { error: "Student full name, date of birth, and school code are required." },
      { status: 400 },
    );
  }

  const school = await prisma.school.findUnique({
    where: { code: schoolCode },
    select: { id: true, name: true, status: true },
  });
  if (!school || school.status !== "ACTIVE") {
    return NextResponse.json({ error: "No matching active school was found." }, { status: 404 });
  }
  if (user.schoolId && user.schoolId !== school.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Confirmation step: verify the HMAC token instead of accepting a raw UUID (GC-003)
  if (confirmToken) {
    const studentId = verifyConfirmToken(confirmToken, user.id);
    if (!studentId) {
      return NextResponse.json(
        { error: "Confirmation token is invalid or has expired. Please search again." },
        { status: 400 },
      );
    }

    const confirmedStudent = await prisma.student.findFirst({
      where: { id: studentId, user: { schoolId: school.id } },
      select: {
        id: true,
        currentGrade: true,
        user: { select: { name: true } },
      },
    });
    if (!confirmedStudent) {
      return NextResponse.json({ error: "Student confirmation no longer matches." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentGuardian.upsert({
        where: {
          studentId_guardianId: {
            studentId: confirmedStudent.id,
            guardianId: user.id,
          },
        },
        create: {
          studentId: confirmedStudent.id,
          guardianId: user.id,
          relation,
        },
        update: { relation },
      });

      if (!user.schoolId) {
        await tx.user.update({
          where: { id: user.id },
          data: { schoolId: school.id },
        });
      }
    });

    await logAudit({
      userId: user.id,
      action: "GUARDIAN_LINKED_STUDENT",
      resourceType: "student",
      resourceId: confirmedStudent.id,
      schoolId: school.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      details: { method: "self_service", schoolCode },
    });

    return NextResponse.json({
      ok: true,
      linked: {
        studentId: confirmedStudent.id,
        name: confirmedStudent.user.name,
        grade: confirmedStudent.currentGrade,
      },
    });
  }

  // Search step: use a higher threshold for guardians with no existing schoolId (GC-010)
  const matchThreshold = user.schoolId ? 0.55 : 0.80;

  const candidates = await prisma.student.findMany({
    where: {
      dateOfBirth: { gte: range.start, lt: range.end },
      user: { schoolId: school.id },
    },
    select: {
      id: true,
      currentGrade: true,
      user: { select: { name: true } },
    },
    take: 20,
  });

  const matches = candidates
    .map((student) => ({
      student,
      score: nameScore(studentFullName, student.user.name),
    }))
    .filter((match) => match.score >= matchThreshold)
    .sort((left, right) => right.score - left.score);

  // Return only first name + grade — never the full name or database UUID (GC-003).
  // Each match gets a short-lived HMAC confirmation token bound to this guardian.
  return NextResponse.json({
    ok: true,
    requiresConfirmation: matches.length > 0,
    matches: matches.map((match) => ({
      confirmToken: createConfirmToken(match.student.id, user.id),
      firstName: match.student.user.name?.split(" ")[0] ?? "Student",
      gradeLabel: match.student.currentGrade ? `Grade ${match.student.currentGrade}` : null,
      schoolName: school.name,
    })),
  });
}

export async function POST(req: Request) {
  try {
    if (!isGuardianLinkingEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("GUARDIAN");
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return handleSelfServiceLink(req, user, body);
    }

    if (typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invite = await findInviteByToken(token);

    if (!invite || invite.tokenType !== "GUARDIAN_LINK") {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }
    if (invite.usedAt) {
      return NextResponse.json({ error: "Token has already been used" }, { status: 400 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token has expired" }, { status: 400 });
    }
    if (!invite.studentId) {
      return NextResponse.json({ error: "Token missing student link" }, { status: 400 });
    }
    if (invite.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { id: invite.studentId },
      include: { user: { select: { schoolId: true } } },
    });

    if (!student || student.user.schoolId !== invite.schoolId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId: user.id } },
        create: { studentId: student.id, guardianId: user.id, relation: invite.relation ?? null },
        update: { relation: invite.relation ?? undefined },
      }),
      prisma.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true, studentId: student.id });
  } catch (err) {
    return handleApiError(err, { route: "/api/guardian/link", method: "POST" });
  }
}
