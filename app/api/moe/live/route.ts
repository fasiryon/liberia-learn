// route-policy: auth=session; scope=national; authority=elevated; rationale=live national aggregates are shown only to an authenticated MOE session with no signed-token bypass
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { Redis } from "@upstash/redis";
import { getLiveDashboardData } from "@/lib/moe/liveDashboard";

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

// Authenticated MOE session only. Signed display tokens are not accepted
// until a governed kiosk/display credential is separately approved.
export async function GET(_request?: Request) {
  if (!isMoePortalEnabled()) return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
  try {
    const user = await requireUser();
    if (!isMoeAuthorized(user)) {
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
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/live", method: "GET" });
  }
}
