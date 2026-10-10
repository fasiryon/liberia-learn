import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { loadStudentClasses } from "@/lib/student/enrollmentReadModel";
// route-policy: auth=session; scope=record; authority=exact-student-enrollment; rationale=class detail requires current roster membership in the exact own-school class
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: { classId: string } }) {
  try {
    const user = await requireRole("STUDENT");
    const [studentClass] = await loadStudentClasses(user, params.classId);
    return studentClass ? NextResponse.json({ class: studentClass }) : NextResponse.json({ error: "Class not found" }, { status: 404 });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 503;
    return NextResponse.json({ error: status === 503 ? "Class unavailable" : "Unauthorized" }, { status });
  }
}
