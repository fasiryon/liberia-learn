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
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  // Find student userIds with no AssessmentAttempt in the last 5 days
  const recentlyActive = await prisma.assessmentAttempt.findMany({
    where: { userId: { not: null }, attemptedAt: { gte: fiveDaysAgo } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const activeUserIds = new Set(recentlyActive.map((a) => a.userId as string));

  // Get all enrolled student userIds
  const enrollments = await prisma.enrollment.findMany({
    select: {
      Student: { select: { userId: true } },
      Class: { select: { teacherId: true } },
    },
    where: { Class: { teacherId: { not: null } } },
  });

  // Build teacherId -> inactive studentUserIds map
  const teacherMap = new Map<string, string[]>();
  for (const e of enrollments) {
    const tId = e.Class.teacherId;
    const sId = e.Student.userId;
    if (!tId || !sId) continue;
    if (activeUserIds.has(sId)) continue;
    if (!teacherMap.has(tId)) teacherMap.set(tId, []);
    teacherMap.get(tId)!.push(sId);
  }

  let notified = 0;
  for (const [teacherId, studentIds] of teacherMap) {
    const pref = await getTeacherAlertPref(teacherId);
    if (!pref.alertInactive) continue;

    const uniqueStudents = [...new Set(studentIds)];
    for (const studentUserId of uniqueStudents) {
      const dedupeKey = `alert:inactive:${teacherId}:${studentUserId}`;
      if (redis) {
        const exists = await redis.get(dedupeKey);
        if (exists) continue;
      }

      await sendPushToUser(teacherId, {
        title: "Inactive Student",
        body: `A student hasn't been active for 5+ days.`,
        url: "/teacher/students",
      });
      notified++;

      if (redis) {
        await redis.set(dedupeKey, "1", { ex: 86400 });
      }
      break; // one push per teacher per cron run
    }
  }

  return NextResponse.json({ notified });
}
