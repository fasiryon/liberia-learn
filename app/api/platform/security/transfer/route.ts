import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requirePlatformAdmin();

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const record = await prisma.platformTransferToken.create({
      data: {
        createdBy: user.id,
        expiresAt,
      },
    });

    const base = process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app";
    const acceptUrl = `${base}/platform/security/accept?token=${record.token}`;

    await logAudit({
      userId: user.id,
      action: "platform.transfer.generate",
      resourceType: "platform",
      resourceId: record.id,
    });

    return NextResponse.json({ ok: true, token: record.token, acceptUrl, expiresAt: expiresAt.toISOString() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

