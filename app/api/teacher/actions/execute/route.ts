// route-policy: auth=session; scope=record; authority=class-authority-per-handler; rationale=executes a stored teacher action owned by the caller only after lib/authz/classAuthority grants that handler's function on its target class on CURRENT authority (remediation and review plan class.lesson.support, reminder class.read.learning or owner-only without a class or student, intervention class.feedback on a class of the student); unknown handlers and missing targets are refused; all before any write, including the lifecycle update (AT-GRADE-01 batch 3, CoS ruling 10)
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
      role: user.role,
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
