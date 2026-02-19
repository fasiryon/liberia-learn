import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { getPilotReadinessRules } from "@/lib/pilot-score";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json({ rules: getPilotReadinessRules() });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}
