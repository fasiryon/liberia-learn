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

    const BATCH_SIZE = 50;
    const results: Array<{
      id: string; email: string; inviteUrl: string; emailSent: boolean; expiresAt: Date; error?: string;
    }> = [];

    for (let i = 0; i < payload.students.length; i += BATCH_SIZE) {
      const batch = payload.students.slice(i, i + BATCH_SIZE);

      // Create all invite tokens for this batch in a single transaction
      const invites = await prisma.$transaction(
        batch.map((entry: Entry) => {
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const { tokenHash } = generateTokenPair();
          return prisma.inviteToken.create({
            data: {
              schoolId: user.schoolId!,
              email: entry.email,
              role: "STUDENT",
              tokenType: "ENROLL_STUDENT",
              tokenHash,
              expiresAt,
            },
          });
        })
      ).catch((batchErr) => {
        console.error(`[invite.bulk] Batch ${i}-${i + BATCH_SIZE} failed:`, batchErr);
        return null;
      });

      if (!invites) continue;

      // Send emails outside transaction (side-effect, best-effort)
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      for (let j = 0; j < batch.length; j++) {
        const entry = batch[j];
        const invite = invites[j];
        const { token: rawToken } = generateTokenPair();
        const inviteUrl = `${baseUrl}/onboard/accept?token=${rawToken}`;
        let emailSent = false;
        try {
          const emailResult = await sendStudentInvite({
            to: entry.email,
            name: entry.name,
            schoolName: school?.name ?? "LiberiaLearn",
            inviteUrl,
          });
          emailSent = emailResult.ok;
        } catch { /* best-effort */ }
        results.push({ id: invite.id, email: entry.email, inviteUrl, emailSent, expiresAt: invite.expiresAt });
      }
    }

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
