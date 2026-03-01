import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { logAudit } from "@/lib/audit";
import { findInviteByToken } from "@/lib/inviteTokens";
import { isEnrollmentInvitesEnabled } from "@/lib/serverFlags";

const Schema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const traceId = crypto.randomUUID();
  try {
    const body = await req.json();
    const parsed = Schema.parse(body);

    const invite = await findInviteByToken(parsed.token);

    if (!invite) {
      await logAudit({
        action: "invite.accept.failed",
        resourceType: "InviteToken",
        details: { reason: "not_found" },
        traceId,
      });
      return NextResponse.json({ error: "Invalid or already used invite link" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      await logAudit({
        action: "invite.accept.failed",
        resourceType: "InviteToken",
        resourceId: invite.id,
        schoolId: invite.schoolId,
        details: { reason: "expired", tokenType: invite.tokenType },
        traceId,
      });
      return NextResponse.json({ error: "Invite link has expired" }, { status: 400 });
    }

    if (invite.usedAt) {
      await logAudit({
        action: "invite.accept.failed",
        resourceType: "InviteToken",
        resourceId: invite.id,
        schoolId: invite.schoolId,
        details: { reason: "already_used", tokenType: invite.tokenType },
        traceId,
      });
      return NextResponse.json({ error: "Invite link has already been used" }, { status: 400 });
    }

    if (
      invite.tokenType &&
      !["ONBOARD", "GUARDIAN_LINK", "ENROLL_TEACHER", "ENROLL_STUDENT"].includes(invite.tokenType)
    ) {
      await logAudit({
        action: "invite.accept.failed",
        resourceType: "InviteToken",
        resourceId: invite.id,
        schoolId: invite.schoolId,
        details: { reason: "invalid_type", tokenType: invite.tokenType },
        traceId,
      });
      return NextResponse.json({ error: "Invalid invite type" }, { status: 400 });
    }

    if (["ENROLL_TEACHER", "ENROLL_STUDENT"].includes(invite.tokenType)) {
      if (!isEnrollmentInvitesEnabled()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const hashedPwd = await bcrypt.hash(parsed.password, 12);

    const role = invite.role as "TEACHER" | "STUDENT" | "GUARDIAN" | "ADMIN";
    if (invite.tokenType === "GUARDIAN_LINK" && role !== "GUARDIAN") {
      return NextResponse.json({ error: "Invalid guardian invite" }, { status: 400 });
    }
    if (invite.tokenType === "ENROLL_TEACHER" && role !== "TEACHER") {
      return NextResponse.json({ error: "Invalid teacher invite" }, { status: 400 });
    }
    if (invite.tokenType === "ENROLL_STUDENT" && role !== "STUDENT") {
      return NextResponse.json({ error: "Invalid student invite" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: parsed.name,
          email: invite.email!,
          hashedPwd,
          role,
          schoolId: invite.schoolId,
        },
      });

      if (role === "STUDENT") {
        await tx.student.create({
          data: { userId: newUser.id },
        });
      }

      if (role === "GUARDIAN" && invite.tokenType === "GUARDIAN_LINK" && invite.studentId) {
        const student = await tx.student.findUnique({
          where: { id: invite.studentId },
          include: { user: { select: { schoolId: true } } },
        });
        if (!student || student.user.schoolId !== invite.schoolId) {
          throw Object.assign(new Error("Student not found"), { status: 404 });
        }
        await tx.studentGuardian.upsert({
          where: { studentId_guardianId: { studentId: student.id, guardianId: newUser.id } },
          create: {
            studentId: student.id,
            guardianId: newUser.id,
            relation: invite.relation ?? null,
          },
          update: {
            relation: invite.relation ?? undefined,
          },
        });
      }

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      return newUser;
    });

    await logAudit({
      userId: result.id,
      action: "invite.accepted",
      resourceType: "InviteToken",
      resourceId: invite.id,
      schoolId: invite.schoolId,
      traceId,
      details: {
        role: result.role,
        tokenType: invite.tokenType,
      },
    });

    return NextResponse.json({ ok: true, role: result.role });
  } catch (err: any) {
    if (err?.code === "P2002") {
      await logAudit({
        action: "invite.accept.failed",
        resourceType: "InviteToken",
        details: { reason: "duplicate_email" },
        traceId,
      });
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }
    await logAudit({
      action: "invite.accept.failed",
      resourceType: "InviteToken",
      details: { reason: "error" },
      traceId,
    });
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}
