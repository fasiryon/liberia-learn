import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { isAiLabsEnabled } from "@/lib/serverFlags";
import { explainLabState } from "@/lib/labs/ai/explainLabState";
import { isValidLabId } from "@/lib/labs/registry";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { labId: string } }
) {
  if (!isAiLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("STUDENT");

    if (!isValidLabId(params.labId)) {
      return NextResponse.json({ error: "Unknown lab" }, { status: 404 });
    }

    const body = await req.json();
    const explanation = await explainLabState({
      labId: params.labId,
      previousState: body?.previousState ?? {},
      nextState: body?.nextState ?? {},
      actionType:
        typeof body?.actionType === "string"
          ? body.actionType
          : typeof body?.planned?.actionType === "string"
          ? body.planned.actionType
          : null,
      userId: user.id,
      studentId: user.id,
      schoolId: user.schoolId ?? null,
      lessonId: typeof body?.lessonId === "string" ? body.lessonId : null,
      route: "/api/labs/[labId]/explain",
    });

    return NextResponse.json({ explanation });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to explain lab state" },
      { status: error?.status ?? 500 }
    );
  }
}
