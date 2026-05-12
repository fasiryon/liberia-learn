import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import {
  runManualFullRuntimeMaintenance,
  runManualRuntimeJob,
  type ManualRuntimeRunKind,
} from "@/lib/autonomous/runtime/manualRuntimeRunService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export async function handleManualRuntimeRun(req: Request, kind: ManualRuntimeRunKind | "full-maintenance") {
  try {
    if (!isRuntimeDashboardEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requirePlatformAdmin();
    const body = await req.json().catch(() => ({}));
    const input = {
      actorId: user.id,
      idempotencyKey: body?.idempotencyKey,
      dryRun: body?.dryRun === true,
    };
    const result =
      kind === "full-maintenance"
        ? await runManualFullRuntimeMaintenance(input)
        : await runManualRuntimeJob({ ...input, kind });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Manual runtime run failed" },
      { status: error?.status ?? 500 }
    );
  }
}
