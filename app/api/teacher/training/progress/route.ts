import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const Schema = z.object({
  moduleId: z.string().min(1),
  status: z.enum(["not_started", "in_progress", "complete"]),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = Schema.parse(body);

    const module = await prisma.trainingModule.findUnique({
      where: { id: parsed.moduleId },
      select: { id: true, isActive: true },
    });

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    if (!module.isActive) {
      return NextResponse.json({ error: "Module is inactive" }, { status: 400 });
    }

    const existing = await prisma.trainingProgress.findUnique({
      where: {
        teacherUserId_moduleId: { teacherUserId: user.id, moduleId: parsed.moduleId },
      },
    });

    const now = new Date();
    const updateData: any = { status: parsed.status };

    if ((parsed.status === "in_progress" || parsed.status === "complete") && !existing?.startedAt) {
      updateData.startedAt = now;
    }
    if (parsed.status === "complete") {
      updateData.completedAt = existing?.completedAt ?? now;
    }

    const noStatusChange = existing?.status === parsed.status;
    const noTimeChange =
      (updateData.startedAt ? Boolean(existing?.startedAt) : true) &&
      (updateData.completedAt ? Boolean(existing?.completedAt) : true);

    if (existing && noStatusChange && noTimeChange) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const progress = await prisma.trainingProgress.upsert({
      where: {
        teacherUserId_moduleId: { teacherUserId: user.id, moduleId: parsed.moduleId },
      },
      update: updateData,
      create: {
        teacherUserId: user.id,
        moduleId: parsed.moduleId,
        status: parsed.status,
        startedAt: updateData.startedAt ?? null,
        completedAt: updateData.completedAt ?? null,
      },
    });

    const statusChanged = existing?.status !== progress.status;
    const startedChanged = !existing?.startedAt && progress.startedAt;
    const completedChanged = !existing?.completedAt && progress.completedAt;

    if (statusChanged || startedChanged || completedChanged) {
      await logAudit({
        userId: user.id,
        action: "training.progress.update",
        resourceType: "trainingModule",
        resourceId: parsed.moduleId,
        details: {
          moduleId: parsed.moduleId,
          status: { from: existing?.status ?? null, to: progress.status },
          startedAt: progress.startedAt?.toISOString() ?? null,
          completedAt: progress.completedAt?.toISOString() ?? null,
        },
      });
    }

    return NextResponse.json({ ok: true, progress });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
