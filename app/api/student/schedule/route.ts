import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { loadStudentSchedule, unavailableStudentSchedule } from "@/lib/student/scheduleReadModel";
// route-policy: auth=session; scope=record; authority=student-enrollment; rationale=existing timetable and scheduled work are scoped to current own-school enrollment
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    return NextResponse.json(await loadStudentSchedule(user));
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 503;
    return NextResponse.json(status === 503 ? unavailableStudentSchedule() : { error: "Unauthorized" }, { status });
  }
}
