import { NextResponse } from "next/server";
import { requireMoePlatformAdmin } from "@/lib/moeAccess";
import { prisma } from "@/lib/db";
import {
  canRunDemoResetInCurrentEnv,
  getDemoSchoolIdsFromEnv,
  resetDemoSchools,
  validateDemoSchoolIds,
} from "@/lib/demo/reset";

export async function POST() {
  try {
    if (!canRunDemoResetInCurrentEnv()) {
      return NextResponse.json(
        { error: "Live demo reset is not enabled in this environment" },
        { status: 403 }
      );
    }

    const actor = await requireMoePlatformAdmin();
    const schoolIds = getDemoSchoolIdsFromEnv();
    if (schoolIds.length === 0) {
      return NextResponse.json({ error: "DEMO_SCHOOL_IDS not configured" }, { status: 400 });
    }

    const unknownSchoolIds = validateDemoSchoolIds(schoolIds);
    if (unknownSchoolIds.length > 0) {
      return NextResponse.json(
        { error: `Unknown demo school IDs: ${unknownSchoolIds.join(", ")}` },
        { status: 400 }
      );
    }

    await resetDemoSchools({
      prisma,
      schoolIds,
    });

    return NextResponse.json({
      success: true,
      message: "Demo data reset",
      schoolIds,
      actorId: actor.id,
      resetAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
