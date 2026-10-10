// route-policy: auth=session; scope=tenant; authority=authenticated-student-own-school-enrollments; rationale=learner discovery is restricted by school membership and server-side eligibility
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { loadActiveUnitsForStudent } from "@/lib/student/unitSequence.server";
import { loadLearnerScope } from "@/lib/curriculum/learnerEligibility";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    const scope = await loadLearnerScope(prisma, user);
    const units = await loadActiveUnitsForStudent(user.id, { schoolId: user.schoolId });
    return NextResponse.json({ availability: units.length ? "current" : "empty", eligibility: scope.classIds.length ? "eligible" : "not_enrolled", generatedAt: new Date().toISOString(), items: units }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: any) {
    return NextResponse.json(
      { availability: "unavailable", eligibility: "unavailable", items: [] },
      { status: err?.status ?? 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
