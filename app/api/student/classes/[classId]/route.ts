// route-policy: auth=session; scope=record; authority=authenticated-student-own-school-enrollment-in-this-class; rationale=class detail exists only for an enrolled learner; any other class answers 404 without revealing whether it exists
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { loadClassDetail, withReadTimeout } from "@/lib/student/classes.server";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: { classId: string } }) {
  let user;
  try {
    user = await requireRole("STUDENT");
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Unavailable" }, { status, headers: NO_STORE });
  }
  try {
    const model = await withReadTimeout(loadClassDetail(user, params.classId));
    if (!model) return NextResponse.json({ error: "class_not_found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json(model, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503, headers: NO_STORE });
  }
}
