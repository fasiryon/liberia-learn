import { NextResponse } from "next/server";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { prisma } from "@/lib/db";
import { isProduction, isStaging } from "@/lib/environment";

export async function POST() {
  try {
    if (isProduction() || isStaging()) {
      return NextResponse.json(
        { error: "Not available in this environment" },
        { status: 403 }
      );
    }

    await requireMoePlatformAdmin();

    const allWork = await prisma.scheduledWork.findMany({ select: { id: true, scheduledDate: true } });
    let updated = 0;

    for (const sw of allWork) {
      const newDate = new Date(sw.scheduledDate.getTime() + 86400000);
      await prisma.scheduledWork.update({
        where: { id: sw.id },
        data: { scheduledDate: newDate },
      });
      updated++;
    }

    return NextResponse.json({ updated, message: `Advanced ${updated} scheduled work items by 1 day` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
