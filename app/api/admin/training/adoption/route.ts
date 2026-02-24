/**
 * GET /api/admin/training/adoption
 *
 * Returns school-level training adoption stats:
 *   { totalTeachers, level1Complete, level2Complete, level3Complete }
 *
 * Deliberately exposes only aggregate counts — no PII (no teacher names,
 * emails, or individual module details).
 *
 * Auth: ADMIN only
 * Tenant isolation: scoped to admin's schoolId
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSchoolAdoptionStats } from "@/lib/training/progress";

export async function GET(_req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    if (!user.schoolId) {
      return NextResponse.json({ error: "Admin has no school association" }, { status: 403 });
    }

    const stats = await getSchoolAdoptionStats(user.schoolId);

    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: err?.status ?? 500 });
  }
}
