import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { retrieveOperationalMemory } from "@/lib/autonomous/memory/memoryRetrievalService";
import { recordOperationalMemory } from "@/lib/autonomous/memory/operationalMemoryService";
import { isAutonomousMemoryEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isAutonomousMemoryEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const memory = await retrieveOperationalMemory({ requester: user, schoolId: user.isPlatformAdmin ? null : user.schoolId });
    return NextResponse.json({ ok: true, memory });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load memory" }, { status: error?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAutonomousMemoryEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const event = await recordOperationalMemory({
      ...body,
      schoolId: user.isPlatformAdmin ? body.schoolId : user.schoolId,
      actorId: user.id,
    });
    return NextResponse.json({ ok: true, memoryEventId: (event as any)?.id ?? null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to record memory" }, { status: error?.status ?? 500 });
  }
}

