// route-policy: auth=session; scope=platform; authority=platform-admin; rationale=an allowlisted platform admin demotes only itself while at least two platform admins exist; privileged step-up is enforced only when PRIVILEGED_MFA_ENFORCEMENT_ENABLED is set; the demotion advances its credential version; required audit in the same transaction
import { NextResponse } from "next/server";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { prisma } from "@/lib/db";
import { advanceSecurityStamp } from "@/lib/auth/sessionRevocation";
import { logAuditRequired } from "@/lib/audit";
import { requirePrivilegedStepUp } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireMoePlatformAdmin();
    await requirePrivilegedStepUp(user);

    // Break-glass: require at least 2 platform admins
    const adminCount = await prisma.user.count({ where: { isPlatformAdmin: true } });
    if (adminCount < 2) {
      return NextResponse.json(
        { error: "Cannot demote: at least 2 platform admins required. Promote another admin first." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { isPlatformAdmin: false },
      });
      await advanceSecurityStamp(tx, user.id); // SR-07: a restored flag cannot resurrect this session
      await logAuditRequired({
        userId: user.id,
        action: "platform.admin.demote",
        resourceType: "platform",
        details: { demotedUserId: user.id },
      }, tx);
    });

    return NextResponse.json({ ok: true, demoted: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
