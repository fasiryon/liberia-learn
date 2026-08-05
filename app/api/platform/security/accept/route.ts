import crypto from "crypto";
import { NextResponse } from "next/server";
import { requirePrivilegedStepUp, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { hashToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await requireUser();
    await requirePrivilegedStepUp(user);
    const body = await req.json();
    const { token, demoteSender } = body;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const record = await prisma.platformTransferToken.findFirst({
      where: { tokenHash },
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    if (!record.tokenHash || !crypto.timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(tokenHash))) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    if (record.usedAt) {
      return NextResponse.json({ error: "Token already used" }, { status: 400 });
    }
    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    if (!record.intendedUserId) {
      return NextResponse.json({ error: "Token has no intended recipient" }, { status: 403 });
    }

    if (record.intendedUserId !== user.id) {
      return NextResponse.json({ error: "Token not issued to this user" }, { status: 403 });
    }

    // Wrap entire promote → mark-used → optional demote in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { isPlatformAdmin: true },
      });

      await tx.platformTransferToken.update({
        where: { id: record.id },
        data: { usedAt: new Date(), usedBy: user.id },
      });

      if (demoteSender) {
        const adminCount = await tx.user.count({ where: { isPlatformAdmin: true } });
        if (adminCount >= 2) {
          await tx.user.update({
            where: { id: record.createdBy },
            data: { isPlatformAdmin: false },
          });
        }
      }
      await logAuditRequired({
        userId: user.id,
        action: "platform.transfer.accept",
        resourceType: "platform",
        details: {
          fromUserId: record.createdBy,
          toUserId: user.id,
          demotedSender: !!demoteSender,
        },
      }, tx);
    });

    return NextResponse.json({ ok: true, promoted: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
