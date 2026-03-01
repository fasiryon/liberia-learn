// app/api/onboard/invite/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateTokenPair } from "@/lib/tokens";
import { findInviteByToken } from "@/lib/inviteTokens";
import {
  sendTeacherInvite,
  sendStudentInvite,
  sendGuardianInvite,
} from "@/lib/email";
import { z } from "zod";
import crypto from "crypto";

const Schema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.enum(["TEACHER", "STUDENT", "GUARDIAN"]).default("TEACHER"),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const traceId = crypto.randomUUID();

    const body = await req.json();
    const parsed = Schema.parse(body);

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId! },
      select: { name: true },
    });
    const schoolName = school?.name ?? "LiberiaLearn";

    const { token: rawToken, tokenHash } = generateTokenPair();
    const token = await prisma.inviteToken.create({
      data: {
        schoolId: user.schoolId!,
        email: parsed.email ?? null,
        role: parsed.role,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl}/onboard/accept?token=${rawToken}`;

    let emailSent = false;

    if (parsed.email) {
      let result: { ok: boolean };

      switch (parsed.role) {
        case "STUDENT":
          result = await sendStudentInvite({
            to: parsed.email,
            name: parsed.name,
            schoolName,
            inviteUrl,
          });
          break;
        case "GUARDIAN":
          result = await sendGuardianInvite({
            to: parsed.email,
            guardianName: parsed.name,
            studentName: "your student",
            schoolName,
            inviteUrl,
          });
          break;
        default:
          result = await sendTeacherInvite({
            to: parsed.email,
            name: parsed.name,
            schoolName,
            inviteUrl,
          });
      }
      emailSent = result.ok;
    }

    await logAudit({
      userId: user.id,
      action: "invite.created",
      resourceType: "InviteToken",
      resourceId: token.id,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        role: parsed.role,
        tokenType: token.tokenType,
        emailProvided: Boolean(parsed.email),
        emailSent,
      },
    });

    return NextResponse.json({
      ok: true,
      token: rawToken,
      inviteUrl,
      expiresAt: token.expiresAt,
      emailSent,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenValue = searchParams.get("token");

    if (!tokenValue) {
      return NextResponse.json(
        { error: "token query param required" },
        { status: 400 }
      );
    }

    const invite = await findInviteByToken(tokenValue);

    if (!invite) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    if (invite.usedAt) {
      return NextResponse.json(
        { error: "Token already used" },
        { status: 410 }
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 410 });
    }

    return NextResponse.json({
      ok: true,
      role: invite.role,
      email: invite.email,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
