import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { loadStudentClasses } from "@/lib/student/enrollmentReadModel";
// route-policy: auth=session; scope=record; authority=student-enrollment; rationale=only current own-school roster classes are projected
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    return NextResponse.json({ classes: await loadStudentClasses(user) });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 503;
    return NextResponse.json({ error: status === 503 ? "Classes unavailable" : "Unauthorized" }, { status });
  }
}
