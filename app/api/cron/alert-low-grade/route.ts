import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/sendPush";
import { getTeacherAlertPref } from "@/lib/alert-prefs";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = getRedis();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Aggregate avg score per userId from AssessmentAttempts in last 30 days
  const attempts = await prisma.assessmentAttempt.groupBy({
    by: ["userId"],
    where: {
      userId: { not: null },
      score: { not: null },
      attemptedAt: { gte: thirtyDaysAgo },
    },
    _avg: { score: true },
    _count: { id: true },
  });

  const lowGradeUserIds = attempts
    .filter((a) => (a._avg.score ?? 1) < 0.6 && a._count.id >= 3)
    .map((a) => a.userId as string);

  if (!lowGradeUserIds.length) {
    return NextResponse.json({ notified: 0 });
  }

  // Map student userIds to their class teacher
  const enrollments = await prisma.enrollment.findMany({
    where: { Student: { userId: { in: lowGradeUserIds } } },
    select: {
      Student: { select: { userId: true } },
      Class: { select: { teacherId: true } },
    },
  });

  // Build teacherId -> studentUserId[] map
  const teacherMap = new Map<string, string[]>();
  for (const e of enrollments) {
    const tId = e.Class.teacherId;
    const sId = e.Student.userId;
    if (!tId || !sId) continue;
    if (!teacherMap.has(tId)) teacherMap.set(tId, []);
    teacherMap.get(tId)!.push(sId);
  }

  let notified = 0;
  for (const [teacherId, studentIds] of teacherMap) {
    const pref = await getTeacherAlertPref(teacherId);
    if (!pref.alertLowGrade) continue;

    const uniqueStudents = [...new Set(studentIds)];
    for (const studentUserId of uniqueStudents) {
      const dedupeKey = `alert:lowgrade:${teacherId}:${studentUserId}`;
      if (redis) {
        const exists = await redis.get(dedupeKey);
        if (exists) continue;
      }

      await sendPushToUser(teacherId, {
        title: "Low Grade Alert",
        body: "A student in your class has a rolling average below 60%.",
        url: "/teacher/students",
      });
      notified++;

      if (redis) {
        await redis.set(dedupeKey, "1", { ex: 86400 });
      }
      break; // one push per teacher per cron run (batched)
    }
  }

  return NextResponse.json({ notified });
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
