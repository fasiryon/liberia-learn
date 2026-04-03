import { readFileSync } from "fs";
import { join } from "path";
import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";
import { prisma } from "@/lib/db";
import { getRateLimiterInfo } from "@/lib/rateLimit";
import { getSloStatus } from "@/lib/slo/tracker";

export type OpsDashboardData = {
  timestamp: string;
  build: {
    version: string;
    commitSha: string;
    environment: string;
  };
  health: {
    db: "healthy" | "degraded" | "down";
    dbLatencyMs: number;
    rateLimitBackend: "upstash" | "memory";
    sentryConfigured: boolean;
    workerQueueDepth: number | null;
  };
  slo: {
    login: { current: number; target: number; status: string };
    tutor: { current: number; target: number; status: string };
    submit: { current: number; target: number; status: string };
    export: { current: number; target: number; status: string };
  };
  ai: {
    totalRequestsToday: number;
    fallbackRatePercent: number;
    estimatedCostUsdToday: number;
  };
  users: {
    activeStudentsToday: number;
    activeTeachersToday: number;
    totalSchools: number;
  };
  errors: {
    count5xxLast24h: number;
  };
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function last24Hours() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function readAppVersion() {
  try {
    const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function getWorkerQueueDepth() {
  const queueUrl = process.env.SQS_QUEUE_URL?.trim();
  if (!queueUrl) return null;

  try {
    const client = new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    const response = await client.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ["ApproximateNumberOfMessages"],
    }));
    const rawCount = response.Attributes?.ApproximateNumberOfMessages;
    return typeof rawCount === "string" ? Number.parseInt(rawCount, 10) || 0 : null;
  } catch {
    return null;
  }
}

async function getDbHealth() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startedAt;
    return {
      status: latencyMs <= 500 ? "healthy" as const : "degraded" as const,
      latencyMs,
    };
  } catch {
    return {
      status: "down" as const,
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function getOpsDashboardData(): Promise<OpsDashboardData> {
  const today = startOfToday();
  const since = last24Hours();

  const [
    dbHealth,
    rateLimitInfo,
    workerQueueDepth,
    slo,
    totalRequestsToday,
    fallbackRequestsToday,
    aiCostToday,
    activeStudentsToday,
    activeTeachersToday,
    totalSchools,
    count5xxLast24h,
  ] = await Promise.all([
    getDbHealth(),
    Promise.resolve(getRateLimiterInfo()),
    getWorkerQueueDepth(),
    getSloStatus(),
    prisma.aiInteractionLog.count({
      where: { timestamp: { gte: today } },
    }),
    prisma.aiInteractionLog.count({
      where: { timestamp: { gte: today }, hadFallback: true },
    }),
    prisma.aiInteractionLog.aggregate({
      where: { timestamp: { gte: today } },
      _sum: { estimatedCostUSD: true },
    }),
    prisma.studentProgress.findMany({
      where: {
        OR: [
          { startedAt: { gte: today } },
          { completedAt: { gte: today } },
        ],
      },
      distinct: ["studentId"],
      select: { studentId: true },
    }),
    prisma.metricEvent.findMany({
      where: {
        createdAt: { gte: today },
        userId: { not: null },
        user: { role: "TEACHER" },
      },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.school.count(),
    prisma.metricEvent.count({
      where: {
        createdAt: { gte: since },
        severity: "error",
      },
    }),
  ]);

  const fallbackRatePercent =
    totalRequestsToday === 0 ? 0 : Number(((fallbackRequestsToday / totalRequestsToday) * 100).toFixed(1));

  return {
    timestamp: new Date().toISOString(),
    build: {
      version: readAppVersion(),
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      environment:
        process.env.NODE_ENV === "development"
          ? "development"
          : process.env.DEMO_MODE === "true"
          ? "demo"
          : process.env.VERCEL_ENV === "preview"
          ? "staging"
          : process.env.NODE_ENV ?? "production",
    },
    health: {
      db: dbHealth.status,
      dbLatencyMs: dbHealth.latencyMs,
      rateLimitBackend: rateLimitInfo.backend,
      sentryConfigured: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
      workerQueueDepth,
    },
    slo: {
      login: {
        current: slo.login.current,
        target: slo.login.target,
        status: slo.login.status,
      },
      tutor: {
        current: slo.tutor.current,
        target: slo.tutor.target,
        status: slo.tutor.status,
      },
      submit: {
        current: slo.submit.current,
        target: slo.submit.target,
        status: slo.submit.status,
      },
      export: {
        current: slo.export.current,
        target: slo.export.target,
        status: slo.export.status,
      },
    },
    ai: {
      totalRequestsToday,
      fallbackRatePercent,
      estimatedCostUsdToday: Number((aiCostToday._sum.estimatedCostUSD ?? 0).toFixed(4)),
    },
    users: {
      activeStudentsToday: activeStudentsToday.length,
      activeTeachersToday: activeTeachersToday.length,
      totalSchools,
    },
    errors: {
      count5xxLast24h,
    },
  };
}
