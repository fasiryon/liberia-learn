/**
 * GET /api/student/baseline
 *
 * Returns the authenticated student's ability estimate for a given subject × strand.
 *
 * Query parameters:
 *   subject   — Subject enum value (e.g. "MATH", "SCIENCE")
 *   strandKey — Strand identifier (e.g. "number_sense")
 *
 * Response (200):
 *   { ability: number, score: number }           — flag on, record exists or defaults to 0
 *   { ability: 0, score: 0.5, disabled: true }   — ENABLE_ADAPTIVE_BASELINE is off
 *
 * Errors:
 *   400 — missing or empty subject / strandKey
 *   401 — not authenticated
 *   403 — authenticated user is not a STUDENT
 *
 * Tenant safety: schoolId and studentId are always derived from the session;
 * no tenant identifier is accepted from the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getBaseline } from "@/lib/mastery/baselineService";
import type { Subject } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("STUDENT");

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject") as Subject | null;
    const strandKey = searchParams.get("strandKey");

    if (!subject || !strandKey) {
      return NextResponse.json(
        { error: "Missing required query parameters: subject, strandKey" },
        { status: 400 }
      );
    }

    const result = await getBaseline({
      schoolId: user.schoolId,
      studentId: user.id,
      subject,
      strandKey,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
