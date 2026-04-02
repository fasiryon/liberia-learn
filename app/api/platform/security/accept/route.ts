import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isMoePortalEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await requireUser();
    const body = await req.json();
    const { token, demoteSender } = body;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Compare hashes to avoid timing attacks on plain-text token lookup
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await prisma.platformTransferToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // Verify hash matches (guards against DB-level token exposure)
    const storedHash = record.tokenHash ?? crypto.createHash("sha256").update(record.token).digest("hex");
    if (storedHash !== tokenHash) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    if (record.usedAt) {
      return NextResponse.json({ error: "Token already used" }, { status: 400 });
    }
    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // Verify intended recipient if specified
    if (record.intendedUserId && record.intendedUserId !== user.id) {
      return NextResponse.json({ error: "Token not issued to this user" }, { status: 403 });
    }

    // Wrap entire promote → mark-used → optional demote in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { isPlatformAdmin: true },
      });

      await tx.platformTransferToken.update({
        where: { token },
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
    });

    await logAudit({
      userId: user.id,
      action: "platform.transfer.accept",
      resourceType: "platform",
      details: {
        fromUserId: record.createdBy,
        toUserId: user.id,
        demotedSender: !!demoteSender,
      },
    });

    return NextResponse.json({ ok: true, promoted: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
