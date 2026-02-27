import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGuardianLinkingEnabled } from "@/lib/serverFlags";
import { findInviteByToken } from "@/lib/inviteTokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!isGuardianLinkingEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("GUARDIAN");
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
