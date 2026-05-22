import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { randomBytes } from "crypto";

const CreateInviteSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(["TEACHER", "ADMIN"]).default("TEACHER"),
});

// POST /api/admin/invites — create an SSO_INVITE for a teacher's email
export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const { email, role } = parsed.data;

    // Prevent duplicate active invites for the same email
    const existing = await prisma.inviteToken.findFirst({
      where: {
        email,
        tokenType: "SSO_INVITE",
        schoolId: user.schoolId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Active invite already exists for this email" }, { status: 409 });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const token = randomBytes(24).toString("hex");

    const invite = await prisma.inviteToken.create({
      data: {
        token,
        email,
        role,
        tokenType: "SSO_INVITE",
        schoolId: user.schoolId,
        expiresAt,
      },
    });

    await logAudit({
      userId: user.id,
      action: "admin.sso_invite.created",
      resourceType: "invite_token",
      resourceId: invite.id,
      schoolId: user.schoolId,
      details: { email, role },
    });

    return NextResponse.json({ id: invite.id, email, role, expiresAt, token }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

// GET /api/admin/invites — list active SSO invites for admin's school
export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const invites = await prisma.inviteToken.findMany({
      where: {
        schoolId: user.schoolId,
        tokenType: "SSO_INVITE",
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invites });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}
