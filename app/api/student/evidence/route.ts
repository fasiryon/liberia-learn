/**
 * POST /api/student/evidence
 *
 * Unified evidence endpoint. Records a single piece of assessment evidence
 * and fans it out atomically to both the adaptive baseline (Block 7B) and
 * the mastery engine (Block 7A) via the shared Evidence Pipeline (Block 7C).
 *
 * Use this endpoint for any client-side evidence source (practice, quiz, exam)
 * where the subject, strandKey, and score are known at submission time.
 *
 * Request body (JSON):
 *   {
 *     subject:       string,             // Subject enum value (e.g. "MATH")
 *     strandKey:     string,             // Strand identifier (e.g. "number_sense")
 *     correct:       number,             // Raw correct-answer count (≥ 0)
 *     total:         number,             // Total questions (≥ 1)
 *     difficulty?:   1|2|3|4|5,         // Item difficulty. Default: 3
 *     source:        "practice"|"assessment"|"manual",
 *     wasAiAssisted?: boolean,           // Default: false
 *     attemptCount?:  number,            // Total attempts on this strand. Default: 1
 *     timeSpentSec?:  number             // Optional analytics field
 *   }
 *
 * Response (200):
 *   {
 *     baseline: { ability, score, expectedCorrectness } | { disabled: true },
 *     mastery:  { profileId, currentScore, ... }         | { disabled: true }
 *   }
 *
 * Errors:
 *   400 — Missing required fields or out-of-range values
 *   401 — Not authenticated
 *   403 — Authenticated user is not a STUDENT
 *
 * Tenant safety: schoolId and studentId are always derived from the authenticated
 * session; no tenant identifier is accepted from the client.
 *
 * See docs/product/EVIDENCE_PIPELINE.md for the full product reference.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { processEvidence } from "@/lib/mastery/evidencePipeline";
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

    const {
      subject,
      strandKey,
      correct,
      total,
      difficulty,
      source,
      wasAiAssisted,
      attemptCount,
      timeSpentSec,
    } = body as {
      subject?: unknown;
      strandKey?: unknown;
      correct?: unknown;
      total?: unknown;
      difficulty?: unknown;
      source?: unknown;
      wasAiAssisted?: unknown;
      attemptCount?: unknown;
      timeSpentSec?: unknown;
    };

    // ── Validate required fields ───────────────────────────────────────────

    if (!subject || typeof subject !== "string") {
      return NextResponse.json(
        { error: "Missing required field: subject" },
        { status: 400 }
      );
    }

    if (!strandKey || typeof strandKey !== "string") {
      return NextResponse.json(
        { error: "Missing required field: strandKey" },
        { status: 400 }
      );
    }

    if (typeof correct !== "number" || correct < 0) {
      return NextResponse.json(
        { error: "correct must be a number ≥ 0" },
        { status: 400 }
      );
    }

    if (typeof total !== "number" || total < 1) {
      return NextResponse.json(
        { error: "total must be a number ≥ 1" },
        { status: 400 }
      );
    }

    if (correct > total) {
      return NextResponse.json(
        { error: "correct cannot exceed total" },
        { status: 400 }
      );
    }

    const validSources = ["practice", "assessment", "manual"] as const;
    if (!source || !validSources.includes(source as (typeof validSources)[number])) {
      return NextResponse.json(
        { error: 'source must be one of "practice", "assessment", "manual"' },
        { status: 400 }
      );
    }

    if (difficulty !== undefined) {
      if (typeof difficulty !== "number" || ![1, 2, 3, 4, 5].includes(difficulty)) {
        return NextResponse.json(
          { error: "difficulty must be 1, 2, 3, 4, or 5 when provided" },
          { status: 400 }
        );
      }
    }

    // ── Delegate to pipeline ───────────────────────────────────────────────

    const result = await processEvidence({
      schoolId: user.schoolId ?? "",
      studentId: user.id,
      subject: subject as Subject,
      strandKey,
      correct,
      total,
      difficulty: difficulty as 1 | 2 | 3 | 4 | 5 | undefined,
      source: source as "practice" | "assessment" | "manual",
      wasAiAssisted: typeof wasAiAssisted === "boolean" ? wasAiAssisted : undefined,
      attemptCount: typeof attemptCount === "number" ? attemptCount : undefined,
      timeSpentSec: typeof timeSpentSec === "number" ? timeSpentSec : undefined,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
