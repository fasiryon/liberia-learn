import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { executeTeacherAction } from "@/lib/intelligence/teacherActionExecution";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export const dynamic = "force-dynamic";

const ExecuteSchema = z.object({
  actionId: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const body = ExecuteSchema.parse(await req.json());
    const result = await executeTeacherAction(body.actionId, {
      teacherUserId: user.id,
      schoolId: user.schoolId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return handleApiError(err, {
      requestId: "",
      route: "/api/teacher/actions/execute",
      method: "POST",
    });
  }
}
