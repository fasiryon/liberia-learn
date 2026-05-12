import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGuardianDashboardEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";

export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 1000;

function sanitizeBody(raw: string): string {
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

function buildMessageResponse(message: {
  id: string;
  guardianId: string;
  teacherId: string;
  studentId: string;
  fromRole: string;
  body: string;
  sentAt: Date;
  read: boolean;
  guardian: { name: string | null };
  teacher: { name: string | null };
  student?: {
    user?: { name: string | null } | null;
    enrollments?: Array<{
      Class: { name: string; subject: string } | null;
    }>;
  };
}) {
  const primaryClass = message.student?.enrollments?.[0]?.Class ?? null;

  return {
    messageId: message.id,
    guardianId: message.guardianId,
    teacherId: message.teacherId,
    studentId: message.studentId,
    guardianName: message.guardian.name ?? "Guardian",
    teacherName: message.teacher.name ?? "Teacher",
    studentName: message.student?.user?.name ?? "Student",
    className: primaryClass?.name ?? null,
    subject: primaryClass?.subject ?? null,
    fromRole: message.fromRole as "guardian" | "teacher",
    fromName:
      message.fromRole === "guardian"
        ? (message.guardian.name ?? "Guardian")
        : (message.teacher.name ?? "Teacher"),
    body: message.body,
    sentAt: message.sentAt.toISOString(),
    read: message.read,
  };
}

export async function GET() {
  try {
    if (!isGuardianDashboardEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("GUARDIAN", "TEACHER");
    const where = user.role === "TEACHER" ? { teacherId: user.id } : { guardianId: user.id };

    const messages = await prisma.guardianMessage.findMany({
      where,
      orderBy: { sentAt: "asc" },
      include: {
        guardian: { select: { name: true } },
        teacher: { select: { name: true } },
        student: {
          select: {
            user: { select: { name: true } },
            enrollments: {
              where: user.role === "TEACHER" ? { Class: { teacherId: user.id } } : undefined,
              select: {
                Class: { select: { name: true, subject: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    return NextResponse.json(messages.map(buildMessageResponse));
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();

  try {
    if (!isGuardianDashboardEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("GUARDIAN", "TEACHER");

    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      teacherId,
      guardianId,
      studentId,
      body: rawBody,
    } = requestBody as Record<string, unknown>;

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

    let resolvedGuardianId: string;
    let resolvedTeacherId: string;
    let schoolId: string;

    if (user.role === "GUARDIAN") {
      if (!teacherId || typeof teacherId !== "string") {
        return NextResponse.json({ error: "teacherId is required" }, { status: 400 });
      }

      const guardianLink = await prisma.studentGuardian.findFirst({
        where: { guardianId: user.id, studentId },
      });
      if (!guardianLink) {
        return NextResponse.json(
          { error: "You do not have access to this student" },
          { status: 403 }
        );
      }

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

      resolvedGuardianId = user.id;
      resolvedTeacherId = teacherId;
      schoolId = enrollment.Class.schoolId;
    } else {
      if (!guardianId || typeof guardianId !== "string") {
        return NextResponse.json({ error: "guardianId is required" }, { status: 400 });
      }

      const enrollment = await prisma.enrollment.findFirst({
        where: {
          studentId,
          Class: { teacherId: user.id },
        },
        include: { Class: { select: { schoolId: true } } },
      });
      if (!enrollment) {
        return NextResponse.json({ error: "You do not teach this student" }, { status: 403 });
      }

      const guardianLink = await prisma.studentGuardian.findFirst({
        where: { guardianId, studentId },
      });
      if (!guardianLink) {
        return NextResponse.json(
          { error: "Guardian is not linked to this student" },
          { status: 403 }
        );
      }

      resolvedGuardianId = guardianId;
      resolvedTeacherId = user.id;
      schoolId = enrollment.Class.schoolId;
    }

    const message = await prisma.guardianMessage.create({
      data: {
        guardianId: resolvedGuardianId,
        teacherId: resolvedTeacherId,
        studentId,
        schoolId,
        fromRole: user.role === "TEACHER" ? "teacher" : "guardian",
        body: sanitized,
      },
    });

    void logAudit({
      userId: user.id,
      action: user.role === "TEACHER" ? "teacher.message.sent" : "guardian.message.sent",
      resourceType: "guardian_message",
      resourceId: message.id,
      schoolId,
      traceId,
    });

    const recipientId = user.role === "TEACHER" ? resolvedGuardianId : resolvedTeacherId;
    sendPushToUser(recipientId, {
      title: "New message",
      body: sanitized.length > 80 ? sanitized.slice(0, 77) + "…" : sanitized,
      url: user.role === "TEACHER" ? "/guardian/messages" : "/teacher/messages",
    }).catch(() => null);

    return NextResponse.json({ messageId: message.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
