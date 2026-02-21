import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requirePlatformAdmin();

    // Break-glass: require at least 2 platform admins
    const adminCount = await prisma.user.count({ where: { isPlatformAdmin: true } });
    if (adminCount < 2) {
      return NextResponse.json(
        { error: "Cannot demote: at least 2 platform admins required. Promote another admin first." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isPlatformAdmin: false },
    });

    await logAudit({
      userId: user.id,
      action: "platform.admin.demote",
      resourceType: "platform",
      details: { demotedUserId: user.id },
    });

    return NextResponse.json({ ok: true, demoted: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}

