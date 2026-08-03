import { NextResponse } from "next/server";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireMoePlatformAdmin();

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
