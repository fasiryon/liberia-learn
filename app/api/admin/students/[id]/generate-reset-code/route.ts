import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";
import crypto from "crypto";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireRole("ADMIN");

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, schoolId: true } },
        guardians: {
          take: 1,
          include: {
            guardian: {
              select: { id: true, guardianPhoneE164: true, smsOptIn: true },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (student.user.schoolId !== admin.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate 6-digit code using crypto for randomness
    const codeNum = crypto.randomInt(100000, 1000000);
    const adminCode = String(codeNum).padStart(6, "0");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const token = await prisma.passwordResetToken.create({
      data: { userId: student.user.id, adminCode, expiresAt },
    });

    logAudit({
      userId: admin.id,
      action: "auth.admin_reset_code.generated",
      resourceType: "PasswordResetToken",
      resourceId: token.id,
      schoolId: admin.schoolId,
      details: { studentId: params.id },
    });

    // Fire-and-forget SMS to linked guardian
    const guardianLink = student.guardians?.[0];
    if (guardianLink && admin.schoolId) {
      const guardianId = guardianLink.guardian.id;
      sendGuardianSMS({
        schoolId: admin.schoolId,
        studentId: params.id,
        guardianId,
        messageType: "custom",
        payload: {
          message: `Your child's LiberiaLearn password was reset by school admin. Code expires in 1 hour. If you did not request this, contact school.`,
        },
        idempotencyKey: `admin-reset-${token.id}`,
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, adminCode, expiresAt: expiresAt.toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[generate-reset-code]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
