import { NextResponse } from "next/server";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { generateTokenPair } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireMoePlatformAdmin();
    const body = await req.json().catch(() => ({}));
    const intendedUserId =
      typeof body?.intendedUserId === "string" ? body.intendedUserId.trim() : "";

    if (!intendedUserId) {
      return NextResponse.json({ error: "intendedUserId required" }, { status: 400 });
    }

    const intendedUser = await prisma.user.findUnique({
      where: { id: intendedUserId },
      select: { id: true },
    });

    if (!intendedUser) {
      return NextResponse.json({ error: "Intended recipient not found" }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const { token: rawToken, tokenHash } = generateTokenPair();

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.platformTransferToken.create({
        data: {
          token: `transfer:${tokenHash.slice(0, 32)}`,
          tokenHash,
          createdBy: user.id,
          intendedUserId,
          expiresAt,
        },
      });
      await logAuditRequired({
        userId: user.id,
        action: "platform.transfer.generate",
        resourceType: "platform",
        resourceId: created.id,
        details: { intendedUserId },
      }, tx);
      return created;
    });

    return NextResponse.json({ ok: true, token: rawToken, expiresAt: expiresAt.toISOString() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
