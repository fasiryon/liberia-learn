// app/api/ai/chat/route.ts
// FIXED:
//  1) Added in-memory rate limiter (20 req/min per student) -- replace with Upstash later.
//  2) Requires STUDENT session.
//  3) Pulls basic student context (grade + enrolled subjects).

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TutorAgent } from "@/lib/ai/tutor-agent";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;        // requests
const WINDOW_MS  = 60_000;    // 1 minute

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("STUDENT");

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 }
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

    return NextResponse.json(response);
  } catch (err: any) {
  const msg   = err?.message ?? String(err);
  const stack = err?.stack ?? null;
  console.error("Chat API error:", msg);
  if (stack) console.error(stack);

  // DEV: return stack to client so we can fix fast (remove later)
  const isDev = process.env.NODE_ENV !== "production";
  return NextResponse.json(
    { error: "Internal server error", details: msg, stack: isDev ? stack : undefined },
    { status: err?.status ?? 500 }
  );
}
}