import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isInterventionEngineEnabled, isInterventionWorkflowEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { getTeacherScope } from "@/lib/intelligence/teacherScope";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isInterventionEngineEnabled() || !isInterventionWorkflowEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }
    const scope = await getTeacherScope(user.id, user.schoolId);
    if (scope.studentIds.length === 0) {
      return NextResponse.json([]);
    }

    const interventions = await (prisma as any).interventionRecommendation.findMany({
      where: {
        schoolId: user.schoolId,
        status: "pending",
        studentId: { in: scope.studentIds },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      interventions.map((intervention: any) => ({
        ...intervention,
        studentName: scope.students.get(intervention.studentId)?.name ?? null,
        workflowState:
          intervention.status === "actioned"
            ? "Teacher action taken"
            : intervention.status === "dismissed"
              ? "Dismissed"
              : "Needs review",
      }))
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load interventions" },
      { status: error?.status ?? 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isInterventionEngineEnabled() || !isInterventionWorkflowEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }
    const scope = await getTeacherScope(user.id, user.schoolId);
    if (scope.studentIds.length === 0) {
      return NextResponse.json({ error: "Intervention not found" }, { status: 404 });
    }

    const body = await req.json();
    if (
      typeof body?.id !== "string" ||
      (body?.status !== "actioned" && body?.status !== "dismissed")
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = await (prisma as any).interventionRecommendation.updateMany({
      where: { id: body.id, schoolId: user.schoolId, studentId: { in: scope.studentIds } },
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
      where: { id: body.id, schoolId: user.schoolId, studentId: { in: scope.studentIds } },
    });

    return NextResponse.json(
      intervention
        ? {
            ...intervention,
            studentName: scope.students.get(intervention.studentId)?.name ?? null,
            workflowState:
              intervention.status === "actioned"
                ? "Teacher action taken"
                : intervention.status === "dismissed"
                  ? "Dismissed"
                  : "Needs review",
          }
        : null
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update intervention" },
      { status: error?.status ?? 500 }
    );
  }
}
