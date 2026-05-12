import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { runRuntimeSmokeVerification } from "@/lib/autonomous/runtime/runtimeSmokeVerificationService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (!isRuntimeDashboardEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requirePlatformAdmin();
    const result = await runRuntimeSmokeVerification({
      actorId: user.id,
      actorRole: user.role,
      isPlatformAdmin: user.isPlatformAdmin === true,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Runtime smoke verification failed" }, { status: error?.status ?? 500 });
  }
}
