import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/db";
import { getEnvironment } from "@/lib/environment";

export type HealthStatus = "healthy" | "degraded" | "down" | "unconfigured";

export type HealthSnapshot = {
  timestamp: string;
  deployment: {
    commitSha: string;
    environment: string;
    vercelUrl: string;
  };
  db: { status: HealthStatus; latencyMs: number };
  redis: { status: HealthStatus; latencyMs: number };
  overall: "green" | "yellow" | "red";
};

async function pingDb(): Promise<{ status: HealthStatus; latencyMs: number }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - start;
    return { status: ms <= 500 ? "healthy" : "degraded", latencyMs: ms };
  } catch {
    return { status: "down", latencyMs: Date.now() - start };
  }
}

async function pingRedis(): Promise<{ status: HealthStatus; latencyMs: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return { status: "unconfigured", latencyMs: 0 };

  const start = Date.now();
  try {
    const redis = new Redis({ url, token });
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    const ms = Date.now() - start;
    return { status: ms <= 300 ? "healthy" : "degraded", latencyMs: ms };
  } catch {
    return { status: "down", latencyMs: Date.now() - start };
  }
}

export async function getSystemHealth(): Promise<HealthSnapshot> {
  const [db, redis] = await Promise.all([pingDb(), pingRedis()]);

  const criticalDown = db.status === "down";
  const anyDegraded =
    db.status === "degraded" ||
    redis.status === "degraded" ||
    redis.status === "down";

  const overall = criticalDown ? "red" : anyDegraded ? "yellow" : "green";

  return {
    timestamp: new Date().toISOString(),
    deployment: {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      environment: getEnvironment(),
      vercelUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    },
    db,
    redis,
    overall,
  };
}
