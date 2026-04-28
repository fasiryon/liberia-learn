import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { logAudit } from "@/lib/audit";
import {
  assignLessonToSlot,
  removeLessonFromSlot,
} from "@/lib/timetable/timetableService";

export const dynamic = "force-dynamic";

const assignSchema = z.object({
  assignedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  title: z.string().trim().min(1).max(200),
  curriculumContentId: z.string().trim().min(1).nullable().optional(),
  instructions: z.string().trim().max(1000).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { timetableId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const body = assignSchema.parse(await req.json());

    const assignment = await assignLessonToSlot(
      params.timetableId,
      user.id,
      user.schoolId ?? "",
      {
        assignedDate: new Date(body.assignedDate),
        title: body.title,
        curriculumContentId: body.curriculumContentId ?? null,
        instructions: body.instructions ?? null,
      }
    );

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? "",
      action: "teacher.timetable.assign",
      resourceType: "timetable_assignment",
      resourceId: assignment.id,
      details: {
        timetableId: params.timetableId,
        assignedDate: body.assignedDate,
        title: body.title,
      },
    });

    return NextResponse.json({ assignment }, { status: 200 });
  } catch (err: any) {
    return handleApiError(err, {
      requestId: "",
      route: `/api/teacher/timetable/${params.timetableId}/assign`,
      method: "POST",
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { timetableId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const assignedDate = searchParams.get("assignedDate");
    if (!assignedDate || !/^\d{4}-\d{2}-\d{2}$/.test(assignedDate)) {
      return NextResponse.json(
        { error: "assignedDate query param required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    await removeLessonFromSlot(
      params.timetableId,
      user.id,
      user.schoolId ?? "",
      new Date(assignedDate)
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return handleApiError(err, {
      requestId: "",
      route: `/api/teacher/timetable/${params.timetableId}/assign`,
      method: "DELETE",
    });
  }
}
