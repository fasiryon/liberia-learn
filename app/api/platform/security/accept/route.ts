// route-policy: auth=session; scope=platform; authority=intended-recipient-transfer-token; rationale=only the signed-in intended recipient of an unexpired platform transfer token is promoted to platform admin (optionally demoting the sender while two admins remain); privileged step-up is enforced only when PRIVILEGED_MFA_ENFORCEMENT_ENABLED is set; the token is claimed atomically (conditional update on unused, unexpired and this recipient) as the first write of the privilege/audit transaction, so a consumed or racing token gets 409 and no privileged effect; each promotion or demotion advances that account's credential version; required audit in the same transaction; refused on any deployed Preview/staging after authority and before body or data work (PREVIEW_IDENTITY_FROZEN)
import crypto from "crypto";
import { NextResponse } from "next/server";
import { requirePrivilegedStepUp, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { advanceSecurityStamp } from "@/lib/auth/sessionRevocation";
import { logAuditRequired } from "@/lib/audit";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { hashToken } from "@/lib/tokens";
import { previewIdentityFrozen } from "@/lib/preview/identityFreeze";
import { previewSafeErrorResponse } from "@/lib/preview/safeError";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await requireUser();
    await requirePrivilegedStepUp(user);
    const frozen = previewIdentityFrozen();
    if (frozen) return frozen;
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

    // One transaction: claim → promote → optional demote → audit. The pre-checks above are for clear errors only;
    // the claim is the authority (Atlas P1: a stale read must never authorize a second privileged effect).
    await prisma.$transaction(async (tx) => {
      const claimedAt = new Date();
      const claim = await tx.platformTransferToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: claimedAt }, intendedUserId: user.id },
        data: { usedAt: claimedAt, usedBy: user.id },
      });
      if (claim.count !== 1) {
        throw Object.assign(new Error("Token already used or no longer valid"), { status: 409, code: "TOKEN_ALREADY_USED" });
      }

      await tx.user.update({
        where: { id: user.id },
        data: { isPlatformAdmin: true },
      });
      await advanceSecurityStamp(tx, user.id); // SR-07: the new platform admin signs in again

      if (demoteSender) {
        const adminCount = await tx.user.count({ where: { isPlatformAdmin: true } });
        if (adminCount >= 2) {
          await tx.user.update({
            where: { id: record.createdBy },
            data: { isPlatformAdmin: false },
          });
          await advanceSecurityStamp(tx, record.createdBy); // SR-07
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
    const safe = previewSafeErrorResponse(err);
    if (safe) return safe;
    return NextResponse.json(
      { error: err?.message ?? "Failed", ...(err?.code === "TOKEN_ALREADY_USED" ? { code: "TOKEN_ALREADY_USED" } : {}) },
      { status: err?.status ?? 500 }
    );
  }
}
