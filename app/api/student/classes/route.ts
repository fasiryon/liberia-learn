// route-policy: auth=session; scope=tenant; authority=authenticated-student-own-school-enrollments; rationale=display-only list of the learner's own enrolled classes with class-scoped eligible content
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { loadMyClasses, unavailableClasses, withReadTimeout } from "@/lib/student/classes.server";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  let user;
  try {
    user = await requireRole("STUDENT");
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Unavailable" }, { status, headers: NO_STORE });
  }
  try {
    const model = await withReadTimeout(loadMyClasses(user));
    if (model.availability === "restricted") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
    return NextResponse.json(model, { headers: NO_STORE });
  } catch {
    return NextResponse.json(unavailableClasses(), { status: 503, headers: NO_STORE });
  }
}
