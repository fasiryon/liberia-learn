import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Prisma mock ───────────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    metricEvent: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    curriculumContent: {
      count: vi.fn(),
    },
    lessonAudio: {
      count: vi.fn(),
    },
    lessonVariant: {
      count: vi.fn(),
    },
    studentSession: {
      count: vi.fn(),
    },
    homeworkSubmission: {
      count: vi.fn(),
    },
    stuckEvent: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    curriculumRegenerationRun: {
      count: vi.fn(),
    },
    aiInteractionLog: {
      aggregate: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/serverFlags", () => ({
  getAiBudgetDailyCap: () => 25,
  getAiBudgetMonthlyCap: () => 100,
}));
vi.mock("@/lib/environment", () => ({ getEnvironment: () => "test" }));

// SQS mock — don't hit AWS in tests
vi.mock("@aws-sdk/client-sqs", () => ({
  GetQueueAttributesCommand: vi.fn(),
  SQSClient: vi.fn(() => ({
    send: vi.fn().mockRejectedValue(new Error("SQS unavailable in test")),
  })),
}));

// Redis mock
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => ({
    ping: vi.fn().mockRejectedValue(new Error("Redis not configured in test")),
  })),
}));

import { getSystemHealth } from "@/lib/ops/healthCheck";
import { getErrorRates24h } from "@/lib/ops/errorRates";
import { getAISpend } from "@/lib/ops/aiSpend";
import { getPipelineStatus } from "@/lib/ops/pipelineStatus";
import { getActiveUsage } from "@/lib/ops/activeUsage";
import { getQueueDepths } from "@/lib/ops/queueDepths";

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupEmptyPrisma() {
  prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  prismaMock.metricEvent.count.mockResolvedValue(0);
  prismaMock.metricEvent.groupBy.mockResolvedValue([]);
  prismaMock.curriculumContent.count.mockResolvedValue(0);
  prismaMock.lessonAudio.count.mockResolvedValue(0);
  prismaMock.lessonVariant.count.mockResolvedValue(0);
  prismaMock.studentSession.count.mockResolvedValue(0);
  prismaMock.homeworkSubmission.count.mockResolvedValue(0);
  prismaMock.stuckEvent.count.mockResolvedValue(0);
  prismaMock.stuckEvent.groupBy.mockResolvedValue([]);
  prismaMock.curriculumRegenerationRun.count.mockResolvedValue(0);
  prismaMock.aiInteractionLog.aggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
  prismaMock.aiInteractionLog.count.mockResolvedValue(0);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("lib/ops — valid shape under empty state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyPrisma();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.SQS_QUEUE_URL;
    delete process.env.SQS_DLQ_URL;
  });

  it("getSystemHealth returns a valid HealthSnapshot with db healthy", async () => {
    const result = await getSystemHealth();
    expect(result).toMatchObject({
      timestamp: expect.any(String),
      deployment: {
        commitSha: expect.any(String),
        environment: "test",
        vercelUrl: expect.any(String),
      },
      db: { status: expect.stringMatching(/healthy|degraded|down/), latencyMs: expect.any(Number) },
      redis: { status: "unconfigured", latencyMs: 0 },
      overall: expect.stringMatching(/green|yellow|red/),
    });
  });

  it("getSystemHealth marks overall green when db is healthy and redis unconfigured", async () => {
    const result = await getSystemHealth();
    expect(result.db.status).toBe("healthy");
    expect(result.overall).toBe("green");
  });

  it("getSystemHealth marks overall red when db is down", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("DB down"));
    const result = await getSystemHealth();
    expect(result.db.status).toBe("down");
    expect(result.overall).toBe("red");
  });

  it("getErrorRates24h returns valid ErrorSummary under empty state", async () => {
    const result = await getErrorRates24h();
    expect(result).toMatchObject({
      totalErrors24h: 0,
      topKinds: [],
      sentryConfigured: expect.any(Boolean),
      sentryProjectUrl: expect.any(String),
    });
  });

  it("getErrorRates24h returns aggregated error data", async () => {
    prismaMock.metricEvent.count.mockResolvedValueOnce(7);
    prismaMock.metricEvent.groupBy.mockResolvedValueOnce([
      { kind: "route.error", _count: { kind: 5 } },
      { kind: "ai.timeout", _count: { kind: 2 } },
    ]);
    const result = await getErrorRates24h();
    expect(result.totalErrors24h).toBe(7);
    expect(result.topKinds).toHaveLength(2);
    expect(result.topKinds[0]).toEqual({ kind: "route.error", count: 5 });
  });

  it("getErrorRates24h degrades gracefully when DB is down", async () => {
    prismaMock.metricEvent.count.mockRejectedValueOnce(new Error("DB down"));
    const result = await getErrorRates24h();
    expect(result.totalErrors24h).toBe(0);
    expect(result.topKinds).toEqual([]);
  });

  it("getAISpend returns valid SpendSnapshot under empty state", async () => {
    const result = await getAISpend();
    expect(result).toMatchObject({
      todayUsd: 0,
      mtdUsd: 0,
      dailyCap: 25,
      monthlyCap: 100,
      dailyPct: 0,
      monthlyPct: 0,
      status: "green",
      byFeature: [],
    });
  });

  it("getAISpend computes correct percentage and status", async () => {
    prismaMock.aiInteractionLog.aggregate
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 23 } }) // today
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 80 } }) // MTD
      .mockResolvedValue({ _sum: { estimatedCostUSD: 0 } }); // per-feature calls

    const result = await getAISpend();
    expect(result.todayUsd).toBe(23);
    expect(result.dailyPct).toBeCloseTo(92, 0);
    expect(result.status).toBe("red");
  });

  it("getAISpend degrades gracefully when DB aggregate throws", async () => {
    prismaMock.aiInteractionLog.aggregate.mockRejectedValueOnce(new Error("DB error"));
    const result = await getAISpend();
    expect(result.todayUsd).toBe(0);
    expect(result.status).toBe("green");
  });

  it("getPipelineStatus returns valid PipelineStatus under empty state", async () => {
    const result = await getPipelineStatus();
    expect(result).toMatchObject({
      curriculum: { approved: 0, needsReview: 0, pending: 0, total: 0 },
      audio: { withAudio: 0, total: 0 },
      scaffolds: 0,
      codeExercises: { total: expect.any(Number), validated: expect.any(Number) },
    });
  });

  it("getPipelineStatus returns populated counts", async () => {
    prismaMock.curriculumContent.count
      .mockResolvedValueOnce(4161) // approved
      .mockResolvedValueOnce(10)   // needsReview
      .mockResolvedValueOnce(5)    // pending
      .mockResolvedValueOnce(4176); // total
    prismaMock.lessonAudio.count.mockResolvedValueOnce(284);
    prismaMock.curriculumContent.count.mockResolvedValueOnce(4176); // audio total (reused)
    prismaMock.lessonVariant.count.mockResolvedValueOnce(152);

    const result = await getPipelineStatus();
    expect(result.curriculum.approved).toBe(4161);
    expect(result.audio.withAudio).toBe(284);
    expect(result.scaffolds).toBe(152);
  });

  it("getPipelineStatus degrades gracefully when DB throws", async () => {
    prismaMock.curriculumContent.count.mockRejectedValueOnce(new Error("DB down"));
    const result = await getPipelineStatus();
    expect(result.curriculum.approved).toBe(0);
    expect(result.scaffolds).toBe(0);
  });

  it("getActiveUsage returns valid UsageSnapshot under empty state", async () => {
    const result = await getActiveUsage();
    expect(result).toMatchObject({
      activeSessionsLast5Min: 0,
      submissionsLastHour: 0,
      stuckEventsLastHour: 0,
      mostStuckLessonToday: null,
    });
  });

  it("getActiveUsage returns populated usage", async () => {
    prismaMock.studentSession.count.mockResolvedValueOnce(3);
    prismaMock.homeworkSubmission.count.mockResolvedValueOnce(12);
    prismaMock.stuckEvent.count.mockResolvedValueOnce(5);
    prismaMock.stuckEvent.groupBy.mockResolvedValueOnce([
      { lessonId: "lesson-xyz", _count: { lessonId: 4 } },
    ]);

    const result = await getActiveUsage();
    expect(result.activeSessionsLast5Min).toBe(3);
    expect(result.stuckEventsLastHour).toBe(5);
    expect(result.mostStuckLessonToday).toEqual({ lessonId: "lesson-xyz", count: 4 });
  });

  it("getActiveUsage degrades gracefully when DB throws", async () => {
    prismaMock.studentSession.count.mockRejectedValueOnce(new Error("DB down"));
    const result = await getActiveUsage();
    expect(result.activeSessionsLast5Min).toBe(0);
    expect(result.mostStuckLessonToday).toBeNull();
  });

  it("getQueueDepths returns unconfigured when SQS_QUEUE_URL not set", async () => {
    const result = await getQueueDepths();
    expect(result.mainQueue.configured).toBe(false);
    expect(result.dlq.configured).toBe(false);
    expect(result.regenRunsActive).toBe(0);
    expect(result.note).toEqual(expect.any(String));
  });

  it("getQueueDepths returns configured but null depth when SQS errors", async () => {
    process.env.SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123/test";
    const result = await getQueueDepths();
    expect(result.mainQueue.configured).toBe(true);
    // depth is null because SQS throws in test
    expect(result.mainQueue.depth).toBeNull();
    delete process.env.SQS_QUEUE_URL;
  });

  it("getQueueDepths degrades gracefully when regen run count throws", async () => {
    prismaMock.curriculumRegenerationRun.count.mockRejectedValueOnce(new Error("DB error"));
    const result = await getQueueDepths();
    expect(result.regenRunsActive).toBe(0);
  });
});
