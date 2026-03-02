// app/api/guardian/messages/route.ts
//
// GET  /api/guardian/messages  — list message thread for this guardian
// POST /api/guardian/messages  — send a message to a teacher
//
// Feature flag : ENABLE_GUARDIAN_DASHBOARD (default OFF → 404)
// Auth         : GUARDIAN role
// Scope        : guardian sees only messages involving their linked students' teachers

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGuardianDashboardEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 1000;

// Basic sanitizer: strip null bytes and control characters, trim whitespace
function sanitizeBody(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    if (!isGuardianDashboardEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("GUARDIAN");

    // Fetch all guardian-teacher messages for this guardian
    const messages = await prisma.guardianMessage.findMany({
      where: { guardianId: user.id },
      orderBy: { sentAt: "asc" },
      include: {
        guardian: { select: { name: true } },
        teacher: { select: { name: true } },
      },
    });

    const result = messages.map((m) => ({
      messageId: m.id,
      fromRole: m.fromRole as "guardian" | "teacher",
      fromName:
        m.fromRole === "guardian"
          ? (m.guardian.name ?? "Guardian")
          : (m.teacher.name ?? "Teacher"),
      body: m.body,
      sentAt: m.sentAt.toISOString(),
      read: m.read,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isGuardianDashboardEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("GUARDIAN");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { teacherId, studentId, body: rawBody } = body as Record<string, unknown>;

    // ── Input validation ───────────────────────────────────────────────────
    if (!teacherId || typeof teacherId !== "string") {
      return NextResponse.json({ error: "teacherId is required" }, { status: 400 });
    }
    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }
    if (!rawBody || typeof rawBody !== "string") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const sanitized = sanitizeBody(rawBody);
    if (sanitized.length === 0) {
      return NextResponse.json({ error: "Message body cannot be empty" }, { status: 400 });
    }
    if (sanitized.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { error: `Message body must be ${MAX_BODY_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    // ── Verify studentId is linked to this guardian ────────────────────────
    const guardianLink = await prisma.studentGuardian.findFirst({
      where: { guardianId: user.id, studentId },
    });
    if (!guardianLink) {
      return NextResponse.json(
        { error: "You do not have access to this student" },
        { status: 403 }
      );
    }

    // ── Verify teacherId teaches a class the student is enrolled in ────────
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        Class: { teacherId },
      },
      include: { Class: { select: { schoolId: true } } },
    });
    if (!enrollment) {
      return NextResponse.json(
        { error: "Teacher is not associated with this student's classes" },
        { status: 403 }
      );
    }

    const schoolId = enrollment.Class.schoolId;

    // ── Create the message ─────────────────────────────────────────────────
    const message = await prisma.guardianMessage.create({
      data: {
        guardianId: user.id,
        teacherId,
        studentId,
        schoolId,
        fromRole: "guardian",
        body: sanitized,
      },
    });

    void logAudit({
      userId: user.id,
      action: "guardian.message.sent",
      resourceType: "guardian_message",
      resourceId: message.id,
      schoolId,
      traceId,
    });

    return NextResponse.json({ messageId: message.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
