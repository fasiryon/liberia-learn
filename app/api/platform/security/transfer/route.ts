// route-policy: auth=session; scope=platform; authority=platform-admin-step-up; rationale=issues a platform transfer token; refused on any deployed Preview/staging after authority and before body or data work (PREVIEW_IDENTITY_FROZEN)
import { NextResponse } from "next/server";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { generateTokenPair } from "@/lib/tokens";
import { requirePrivilegedStepUp } from "@/lib/auth";
import { previewIdentityFrozen } from "@/lib/preview/identityFreeze";
import { previewSafeErrorResponse } from "@/lib/preview/safeError";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireMoePlatformAdmin();
    await requirePrivilegedStepUp(user);
    const frozen = previewIdentityFrozen();
    if (frozen) return frozen;
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
    const safe = previewSafeErrorResponse(err);
    if (safe) return safe;
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
