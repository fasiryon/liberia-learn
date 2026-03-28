import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isInterventionEngineEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isInterventionEngineEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const interventions = await (prisma as any).interventionRecommendation.findMany({
      where: { schoolId: user.schoolId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(interventions);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load interventions" },
      { status: error?.status ?? 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isInterventionEngineEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const body = await req.json();
    if (
      typeof body?.id !== "string" ||
      (body?.status !== "actioned" && body?.status !== "dismissed")
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = await (prisma as any).interventionRecommendation.updateMany({
      where: { id: body.id, schoolId: user.schoolId },
      data: { status: body.status },
    });

    if (!updated?.count) {
      return NextResponse.json({ error: "Intervention not found" }, { status: 404 });
    }

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "teacher.intervention.actioned",
      resourceType: "intervention",
      resourceId: body.id,
      details: { status: body.status },
    });

    const intervention = await (prisma as any).interventionRecommendation.findFirst({
      where: { id: body.id, schoolId: user.schoolId },
    });

    return NextResponse.json(intervention);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update intervention" },
      { status: error?.status ?? 500 }
    );
  }
}
