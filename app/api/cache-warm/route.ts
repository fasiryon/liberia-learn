/**
 * GET /api/cache-warm
 *
 * Pre-populates Redis with hot-path data immediately after deploy so the
 * first real request is served from cache rather than hitting the DB cold.
 *
 * Called by a post-deploy webhook or manually:
 *   curl -H "X-Cache-Warm-Secret: $CACHE_WARM_SECRET" \
 *        https://liberia-learn.vercel.app/api/cache-warm
 *
 * Auth: X-Cache-Warm-Secret header must match CACHE_WARM_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRedisCache } from "@/lib/cache/redisCache";
import { Redis } from "@upstash/redis";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function currentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const term = month <= 4 ? "T1" : month <= 8 ? "T2" : "T3";
  return `${year}-${term}`;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cache-warm-secret");
  if (!secret || secret !== process.env.CACHE_WARM_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ ok: false, error: "Redis not configured" }, { status: 503 });
  }

  const results: Record<string, string> = {};

  // 1. League table data
  try {
    const term = currentTerm();
    const snapshots = await prisma.leagueSnapshot.findMany({
      where: { term },
      orderBy: { nationalRank: "asc" },
      include: { school: { select: { name: true, county: true, district: true } } },
      take: 200,
    });
    await redis.set(`cache:league:${term}`, JSON.stringify(snapshots), { ex: 3600 });
    results.league = `warmed ${snapshots.length} rows for ${term}`;
  } catch (err) {
    results.league = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 2. Top 10 most-viewed lessons per grade (grades 1–12)
  try {
    const grades = Array.from({ length: 12 }, (_, i) => i + 1);
    let totalLessons = 0;
    await Promise.all(
      grades.map(async (grade) => {
        const lessons = await prisma.curriculumContent.findMany({
          where: { grade, status: { in: ["published", "APPROVED"] } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { contentId: true, title: true, grade: true, subject: true, contentType: true },
        });
        await redis.set(`cache:lessons:top:${grade}`, JSON.stringify(lessons), { ex: 1800 });
        totalLessons += lessons.length;
      })
    );
    results.lessons = `warmed ${totalLessons} lesson entries across grades 1–12`;
  } catch (err) {
    results.lessons = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 3. School list
  try {
    const schools = await prisma.school.findMany({
      select: { id: true, name: true, county: true, district: true },
      orderBy: { name: "asc" },
    });
    await redis.set("cache:schools:all", JSON.stringify(schools), { ex: 7200 });
    results.schools = `warmed ${schools.length} schools`;
  } catch (err) {
    results.schools = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({ ok: true, warmed: results });
}
