import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/sendPush";
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
  const currentHour = new Date().getUTCHours();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find teachers with daily digest enabled at this hour
  const prefs = await prisma.teacherAlertPreference.findMany({
    where: { dailyDigest: true, digestHour: currentHour },
    select: { teacherId: true },
  });

  let sent = 0;
  for (const { teacherId } of prefs) {
    const dedupeKey = `digest:${teacherId}`;
    if (redis) {
      const exists = await redis.get(dedupeKey);
      if (exists) continue;
    }

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { schoolId: true, teacherOf: { select: { id: true } } },
    });
    if (!teacher) continue;

    const classIds = teacher.teacherOf.map((c) => c.id);

    const [unreadMessages, newSubmissions, lowGradeStudents, inactiveStudents] =
      await Promise.all([
        // Unread guardian messages in last 24h
        prisma.guardianMessage.count({
          where: {
            teacherId,
            fromRole: "guardian",
            sentAt: { gte: since24h },
            read: false,
          },
        }),
        // New homework submissions in last 24h
        prisma.homeworkSubmission.count({
          where: {
            Homework: { classId: { in: classIds } },
            submittedAt: { gte: since24h },
          },
        }),
        // Students with rolling avg < 60%
        prisma.assessmentAttempt
          .groupBy({
            by: ["userId"],
            where: {
              userId: { not: null },
              classId: { in: classIds },
              score: { not: null },
              attemptedAt: { gte: thirtyDaysAgo },
            },
            _avg: { score: true },
            _count: { id: true },
          })
          .then((rows) => rows.filter((r) => (r._avg.score ?? 1) < 0.6 && r._count.id >= 3).length),
        // Inactive students (no attempt in 5 days)
        prisma.enrollment
          .findMany({
            where: { classId: { in: classIds } },
            select: { Student: { select: { userId: true } } },
          })
          .then(async (enrollments) => {
            const studentIds = enrollments.map((e) => e.Student.userId);
            const active = await prisma.assessmentAttempt.findMany({
              where: { userId: { in: studentIds }, attemptedAt: { gte: fiveDaysAgo } },
              select: { userId: true },
              distinct: ["userId"],
            });
            const activeSet = new Set(active.map((a) => a.userId));
            return studentIds.filter((id) => !activeSet.has(id)).length;
          }),
      ]);

    const body = [
      unreadMessages > 0 && `${unreadMessages} unread guardian message${unreadMessages > 1 ? "s" : ""}`,
      newSubmissions > 0 && `${newSubmissions} new submission${newSubmissions > 1 ? "s" : ""}`,
      lowGradeStudents > 0 && `${lowGradeStudents} student${lowGradeStudents > 1 ? "s" : ""} below 60%`,
      inactiveStudents > 0 && `${inactiveStudents} inactive student${inactiveStudents > 1 ? "s" : ""}`,
    ]
      .filter(Boolean)
      .join(", ");

    if (!body) continue;

    await sendPushToUser(teacherId, {
      title: "Daily Digest",
      body,
      url: "/teacher/dashboard",
    });
    sent++;

    if (redis) {
      await redis.set(dedupeKey, "1", { ex: 82800 }); // 23h TTL
    }
  }

  return NextResponse.json({ sent });
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
