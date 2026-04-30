import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { bindLessonPlanToSlot } from "@/lib/intelligence/lessonPlanBinding";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export const dynamic = "force-dynamic";

const BindSchema = z.object({
  planId: z.string().trim().min(1),
  slotId: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const body = BindSchema.parse(await req.json());
    const result = await bindLessonPlanToSlot({
      planId: body.planId,
      slotId: body.slotId,
      teacherUserId: user.id,
      schoolId: user.schoolId,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return handleApiError(err, {
      requestId: "",
      route: "/api/teacher/lesson-plan/bind",
      method: "POST",
    });
  }
}
