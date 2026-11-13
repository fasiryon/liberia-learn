// route-policy: auth=session; scope=platform; authority=moe-platform-admin; rationale=demo only: refused in production and staging whatever DEMO_MODE says (VERCEL_ENV=production is always production); shifts ScheduledWork of demo schools only (DEMO_SCHOOL_IDS validated against SCHOOL_DEFS, else SCHOOL_DEFS), never a real school (PROD-CFG-01-CODE)
import { NextResponse } from "next/server";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { prisma } from "@/lib/db";
import { isProduction, isStaging } from "@/lib/environment";
import { resolveDemoSchoolScope } from "@/lib/demo/reset";
import { previewAutomationDisabled } from "@/lib/previewSideEffects";

export async function POST() {
  try {
    if (isProduction() || isStaging()) {
      return NextResponse.json(
        { error: "Not available in this environment" },
        { status: 403 }
      );
    }

    await requireMoePlatformAdmin();
    // A deployed Preview with DEMO_MODE classifies as demo; refuse after authority.
    if (previewAutomationDisabled()) {
      return NextResponse.json({ error: "Not available in this environment" }, { status: 403 });
    }

    // Only demo-school scheduled work moves; real schools are never touched (PROD-CFG-01-CODE).
    const { schoolIds, unknown } = resolveDemoSchoolScope();
    if (unknown.length > 0) {
      return NextResponse.json({ error: `Unknown demo school IDs: ${unknown.join(", ")}` }, { status: 400 });
    }
    const allWork = await prisma.scheduledWork.findMany({
      where: { class: { schoolId: { in: schoolIds } } },
      select: { id: true, scheduledDate: true },
    });
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
