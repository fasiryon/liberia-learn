import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getMemoryLineage } from "@/lib/autonomous/memory/memoryLineageService";
import { isAutonomousMemoryEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { memoryEventId: string } }) {
  try {
    if (!isAutonomousMemoryEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    const lineage = await getMemoryLineage(params.memoryEventId);
    if (!user.isPlatformAdmin && lineage.schoolId && lineage.schoolId !== user.schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: true, lineage });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load memory lineage" }, { status: error?.status ?? 500 });
  }
}

