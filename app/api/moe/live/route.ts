import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Redis } from "@upstash/redis";
import { getLiveDashboardData } from "@/lib/moe/liveDashboard";
import { verifyLiveToken } from "@/lib/moe/liveToken";

export const dynamic = "force-dynamic";

const CACHE_KEY = "moe:live";
const CACHE_TTL = 60; // 1 minute

let redis: Redis | null = null;
try {
  redis = Redis.fromEnv();
} catch {
  // Redis not configured — skip caching
}

function isMoeAuthorized(user: { role?: string; isPlatformAdmin?: boolean } | null): boolean {
  if (!user) return false;
  return (
    user.role === "MOE_OFFICIAL" ||
    user.role === "MOE_SUPER_ADMIN" ||
    user.isPlatformAdmin === true
  );
}

export async function GET(request: Request) {
  // Auth: session OR signed token
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  let authorized = false;
  if (token && verifyLiveToken(token)) {
    authorized = true;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string; isPlatformAdmin?: boolean } | null;
    authorized = isMoeAuthorized(user);
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try Redis cache first
  if (redis) {
    try {
      const cached = await redis.get<unknown>(CACHE_KEY);
      if (cached) {
        return NextResponse.json(cached);
      }
    } catch {
      // Cache miss — continue to DB
    }
  }

  const data = await getLiveDashboardData();

  // Write to cache (fire-and-forget)
  if (redis) {
    redis.set(CACHE_KEY, data, { ex: CACHE_TTL }).catch(() => null);
  }

  return NextResponse.json(data);
}
