// app/api/ai/chat/route.ts
// DEPRECATED: Use /api/student/tutor instead. Kept for backwards compatibility.
// FIXED:
//  1) Uses the shared rate limiter abstraction with the current in-memory fallback backend.
//  2) Requires STUDENT session.
//  3) Pulls basic student context (grade + enrolled subjects).

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TutorAgent } from "@/lib/ai/tutor-agent";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

const RATE_LIMIT = 20;        // requests
const WINDOW_MS  = 60_000;    // 1 minute

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const rateLimit = checkRateLimit(user.id, {
      windowMs: WINDOW_MS,
      max: RATE_LIMIT,
      namespace: "deprecated_ai_chat",
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const student = await prisma.student.findFirst({ where: { userId: user.id } });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const body = await request.json();
    const { message } = body ?? {};

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (message.length > 1000) {
      return NextResponse.json(
        { error: "Message too long (max 1000 chars)" },
        { status: 400 }
      );
    }

    // Student context
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id },
      include: { Class: { select: { subject: true, name: true } } },
      take: 5,
    });

    const subjects = enrollments.map((e) => e.Class.subject).join(", ") || "General";
    const grade    = (student as any).currentGrade ?? "unknown";

    const tutor    = new TutorAgent(student.id, grade, subjects);
    const response = await tutor.chat(message);

    return NextResponse.json(response, { headers: getRateLimitHeaders(rateLimit) });
  } catch (err: any) {
    logger.error("Deprecated AI chat route failed", {
      route: "/api/ai/chat",
      errorMessage: err?.message ?? String(err),
      status: err?.status ?? 500,
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: err?.status ?? 500 }
    );
  }
}
