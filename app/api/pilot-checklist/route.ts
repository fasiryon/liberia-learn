import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ensurePilotChecklistItems } from "@/lib/pilot-checklist";

export const dynamic = "force-dynamic";

function resolveTargetSchoolId(user: { schoolId?: string | null; isPlatformAdmin?: boolean }, schoolId?: string | null) {
  if (user.isPlatformAdmin && schoolId) return schoolId;
  return user.schoolId ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const schoolId = resolveTargetSchoolId(user, searchParams.get("schoolId"));

    if (!schoolId) {
      return NextResponse.json({ error: "School id required" }, { status: 400 });
    }

    if (!user.isPlatformAdmin) {
      await requireRole("ADMIN");
    }

    await ensurePilotChecklistItems();

    const items = await prisma.pilotChecklistItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });

    const statuses = await prisma.pilotChecklistStatus.findMany({
      where: { schoolId },
      select: { itemId: true, completedAt: true, completedById: true },
    });

    const statusMap = new Map(statuses.map((s) => [s.itemId, s]));
    const checklist = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      sortOrder: item.sortOrder,
      completedAt: statusMap.get(item.id)?.completedAt ?? null,
      completedById: statusMap.get(item.id)?.completedById ?? null,
    }));

    return NextResponse.json({ schoolId, checklist });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { schoolId: inputSchoolId, itemId, completed } = body;

    const schoolId = resolveTargetSchoolId(user, inputSchoolId);
    if (!schoolId) {
      return NextResponse.json({ error: "School id required" }, { status: 400 });
    }

    if (!user.isPlatformAdmin) {
      await requireRole("ADMIN");
    }

    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    const existing = await prisma.pilotChecklistStatus.findUnique({
      where: { schoolId_itemId: { schoolId, itemId } },
    });

    const nextCompleted = Boolean(completed);
    const nextCompletedAt = nextCompleted ? new Date() : null;
    const nextCompletedById = nextCompleted ? user.id : null;

    if (existing && ((existing.completedAt !== null) === nextCompleted)) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const status = await prisma.pilotChecklistStatus.upsert({
      where: { schoolId_itemId: { schoolId, itemId } },
      create: {
        schoolId,
        itemId,
        completedAt: nextCompletedAt,
        completedById: nextCompletedById,
      },
      update: {
        completedAt: nextCompletedAt,
        completedById: nextCompletedById,
      },
    });

    await logAudit({
      userId: user.id,
      schoolId,
      action: "pilot.checklist.update",
      resourceType: "school",
      resourceId: schoolId,
      details: {
        itemId,
        completed: nextCompleted,
        completedAt: nextCompletedAt?.toISOString() ?? null,
      },
    });

    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}
