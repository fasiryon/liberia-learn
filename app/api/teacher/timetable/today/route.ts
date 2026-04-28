import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { getTimetableForTeacher } from "@/lib/timetable/timetableService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const periods = await getTimetableForTeacher(
      user.id,
      user.schoolId ?? "",
      new Date()
    );

    return NextResponse.json({ periods });
  } catch (err: any) {
    return handleApiError(err, {
      requestId: "",
      route: "/api/teacher/timetable/today",
      method: "GET",
    });
  }
}
