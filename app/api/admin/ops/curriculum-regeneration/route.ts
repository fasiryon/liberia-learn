import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { getCurriculumRegenerationOpsData } from "@/lib/curriculum/regenerationAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json(await getCurriculumRegenerationOpsData());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.status === 403 ? "Forbidden" : err?.message ?? "Unauthorized" },
      { status: err?.status ?? 500 }
    );
  }
}

