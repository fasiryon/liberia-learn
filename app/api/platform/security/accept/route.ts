import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { token, demoteSender } = body;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const record = await prisma.platformTransferToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    if (record.usedAt) {
      return NextResponse.json({ error: "Token already used" }, { status: 400 });
    }
    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // Promote the accepting user
    await prisma.user.update({
      where: { id: user.id },
      data: { isPlatformAdmin: true },
    });

    // Mark token as used
    await prisma.platformTransferToken.update({
      where: { token },
      data: { usedAt: new Date(), usedBy: user.id },
    });

    // Optionally demote sender
    if (demoteSender) {
      // Ensure at least 2 platform admins remain after demote
      const adminCount = await prisma.user.count({ where: { isPlatformAdmin: true } });
      if (adminCount >= 2) {
        await prisma.user.update({
          where: { id: record.createdBy },
          data: { isPlatformAdmin: false },
        });
      }
    }

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
