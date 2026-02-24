/**
 * POST /api/student/baseline/evidence
 *
 * Records a single piece of assessment evidence and applies an EMA update
 * to the authenticated student's ability estimate.
 *
 * Request body (JSON):
 *   {
 *     subject:   string,    // Subject enum value (e.g. "MATH")
 *     strandKey: string,    // Strand identifier (e.g. "number_sense")
 *     evidence: {
 *       correctness:      number,   // 0.0–1.0
 *       difficulty:       1|2|3|4|5,
 *       attemptCount:     number,   // total attempts on this strand including this one
 *       assessmentWeight: number,   // use ASSESSMENT_WEIGHTS constants: 0.4 / 0.6 / 1.0
 *       timeSpentSec?:    number    // optional, stored for future analytics
 *     }
 *   }
 *
 * Response (200):
 *   { ability, score, expectedCorrectness }   — flag on, update applied
 *   { disabled: true }                        — ENABLE_ADAPTIVE_BASELINE is off (no-op)
 *
 * Errors:
 *   400 — missing required fields or out-of-range values
 *   401 — not authenticated
 *   403 — authenticated user is not a STUDENT
 *
 * Tenant safety: schoolId and studentId are always derived from the session;
 * no tenant identifier is accepted from the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { recordEvidenceAndUpdateBaseline } from "@/lib/mastery/baselineService";
import type { Subject } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("STUDENT");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { subject, strandKey, evidence } = body as {
      subject?: Subject;
      strandKey?: string;
      evidence?: {
        correctness?: number;
        difficulty?: number;
        attemptCount?: number;
        assessmentWeight?: number;
        timeSpentSec?: number;
      };
    };

    // ── Validate required fields ─────────────────────────────────────────────
    if (!subject || !strandKey) {
      return NextResponse.json(
        { error: "Missing required fields: subject, strandKey" },
        { status: 400 }
      );
    }

    if (!evidence || typeof evidence !== "object") {
      return NextResponse.json(
        { error: "Missing required field: evidence" },
        { status: 400 }
      );
    }

    const { correctness, difficulty, attemptCount, assessmentWeight } = evidence;

    if (
      typeof correctness !== "number" ||
      correctness < 0 ||
      correctness > 1
    ) {
      return NextResponse.json(
        { error: "evidence.correctness must be a number between 0 and 1" },
        { status: 400 }
      );
    }

    if (
      typeof difficulty !== "number" ||
      ![1, 2, 3, 4, 5].includes(difficulty)
    ) {
      return NextResponse.json(
        { error: "evidence.difficulty must be 1, 2, 3, 4, or 5" },
        { status: 400 }
      );
    }

    if (typeof attemptCount !== "number" || attemptCount < 1) {
      return NextResponse.json(
        { error: "evidence.attemptCount must be a positive integer" },
        { status: 400 }
      );
    }

    if (typeof assessmentWeight !== "number" || assessmentWeight <= 0) {
      return NextResponse.json(
        { error: "evidence.assessmentWeight must be a positive number" },
        { status: 400 }
      );
    }

    // ── Apply EMA update ─────────────────────────────────────────────────────
    const result = await recordEvidenceAndUpdateBaseline({
      schoolId: user.schoolId,
      studentId: user.id,
      subject,
      strandKey,
      evidence: {
        correctness,
        difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
        attemptCount,
        assessmentWeight,
        timeSpentSec: evidence.timeSpentSec,
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
