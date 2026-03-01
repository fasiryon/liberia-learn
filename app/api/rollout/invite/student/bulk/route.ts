import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateTokenPair } from "@/lib/tokens";
import { sendStudentInvite } from "@/lib/email";
import { isEnrollmentInvitesEnabled } from "@/lib/serverFlags";

const EntrySchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

const BodySchema = z.object({
  students: z.array(EntrySchema).min(1).max(200),
});

type Entry = z.infer<typeof EntrySchema>;

export async function POST(req: Request) {
  const traceId = crypto.randomUUID();
  try {
    if (!isEnrollmentInvitesEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("TEACHER");
    if (!user.schoolId) {
      return NextResponse.json({ error: "No school" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = Array.isArray(body)
      ? { students: body }
      : body;
    const payload = BodySchema.parse(parsed);

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true },
    });

    const results = await Promise.all(
      payload.students.map(async (entry: Entry) => {
        const { token: rawToken, tokenHash } = generateTokenPair();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const invite = await prisma.inviteToken.create({
          data: {
            schoolId: user.schoolId!,
            email: entry.email,
            role: "STUDENT",
            tokenType: "ENROLL_STUDENT",
            tokenHash,
            expiresAt,
          },
        });

        const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        const inviteUrl = `${baseUrl}/onboard/accept?token=${rawToken}`;
        const emailResult = await sendStudentInvite({
          to: entry.email,
          name: entry.name,
          schoolName: school?.name ?? "LiberiaLearn",
          inviteUrl,
        });

        return {
          id: invite.id,
          email: entry.email,
          inviteUrl,
          emailSent: emailResult.ok,
          expiresAt: invite.expiresAt,
        };
      })
    );

    await logAudit({
      userId: user.id,
      action: "invite.created",
      resourceType: "InviteToken",
      schoolId: user.schoolId,
      traceId,
      details: {
        role: "STUDENT",
        tokenType: "ENROLL_STUDENT",
        count: results.length,
      },
    });

    return NextResponse.json({
      ok: true,
      invited: results.length,
      results,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}
