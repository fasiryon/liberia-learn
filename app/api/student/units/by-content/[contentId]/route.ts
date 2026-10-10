// route-policy: auth=session; scope=tenant; authority=authenticated-student-own-school-enrollments; rationale=learner discovery is restricted by school membership and server-side eligibility
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import {
  loadUnitSequenceForStudent,
  resolveUnitIdForContent,
} from "@/lib/student/unitSequence.server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const user = await requireRole("STUDENT");
    const unitId = await resolveUnitIdForContent(params.contentId);
    if (!unitId) {
      return NextResponse.json({ error: "lesson_has_no_unit" }, { status: 404 });
    }

    const scheduledWorkId = new URL(req.url).searchParams.get("sw");
    const sequence = await loadUnitSequenceForStudent({
      unitId,
      studentUserId: user.id,
      schoolId: user.schoolId,
      currentContentId: params.contentId,
      currentScheduledWorkId: scheduledWorkId,
    });

    if (!sequence) {
      return NextResponse.json({ error: "unit_not_found" }, { status: 404 });
    }
    return NextResponse.json(sequence);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load unit sequence" },
      { status: err?.status ?? 500 }
    );
  }
}
