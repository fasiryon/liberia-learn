import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGuardianLinkingEnabled } from "@/lib/serverFlags";
import { parseGuardianLinkToken } from "@/lib/guardian/linkTokens";

const Schema = z.object({
  token: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    if (!isGuardianLinkingEnabled()) {
      return NextResponse.json({ error: "guardian_linking_disabled" }, { status: 404 });
    }

    const user = await requireRole("GUARDIAN");
    const body = await req.json();
    const parsed = Schema.parse(body);

    const invite = await prisma.inviteToken.findUnique({
      where: { token: parsed.token, usedAt: null },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid or already used link" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link has expired" }, { status: 400 });
    }

    if (invite.role !== "GUARDIAN_LINK" && invite.role !== "GUARDIAN") {
      return NextResponse.json({ error: "Invalid guardian link" }, { status: 400 });
    }

    const payload = parseGuardianLinkToken(invite.token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid guardian link" }, { status: 400 });
    }

    if (!user.schoolId || payload.schoolId !== user.schoolId || invite.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { id: payload.studentId },
      include: { user: { select: { schoolId: true } } },
    });

    if (!student || student.user.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Student not found in your school" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentGuardian.upsert({
        where: {
          studentId_guardianId: {
            studentId: payload.studentId,
            guardianId: user.id,
          },
        },
        create: {
          studentId: payload.studentId,
          guardianId: user.id,
          relation: payload.relation ?? null,
        },
        update: {},
      });

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}
