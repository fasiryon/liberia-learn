import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryRaw = vi.hoisted(() => vi.fn());
const mockAudioAggregate = vi.hoisted(() => vi.fn());
const mockTextbookGroupBy = vi.hoisted(() => vi.fn());
const mockGetTtsDailyBudgetUsd = vi.hoisted(() => vi.fn());
const mockGetTtsMonthlyCapUsd = vi.hoisted(() => vi.fn());
const mockIsTtsGenerationStopped = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    lessonAudio: { aggregate: mockAudioAggregate },
    textbookGenerationJob: { groupBy: mockTextbookGroupBy },
  },
}));

vi.mock("@/lib/serverFlags", () => ({
  getTtsDailyBudgetUsd: mockGetTtsDailyBudgetUsd,
  getTtsMonthlyCapUsd: mockGetTtsMonthlyCapUsd,
  isTtsGenerationStopped: mockIsTtsGenerationStopped,
}));

function makeAggResult(value: number) {
  return { _sum: { estimatedCostUsd: value } };
}

describe("getPipelineCostSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTtsDailyBudgetUsd.mockReturnValue(5);
    mockGetTtsMonthlyCapUsd.mockReturnValue(100);
    mockIsTtsGenerationStopped.mockReturnValue(false);

    // By default: empty datasets
    mockQueryRaw.mockResolvedValue([]);
    mockAudioAggregate.mockResolvedValue(makeAggResult(0));
    mockTextbookGroupBy.mockResolvedValue([]);
  });

  it("returns zero totals when no records exist", async () => {
    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.combinedTotalCostUsd).toBe(0);
    expect(result.todayCostUsd).toBe(0);
    expect(result.audio.lessonCount).toBe(0);
    expect(result.audio.bySubject).toHaveLength(0);
    expect(result.audio.byGrade).toHaveLength(0);
    expect(result.textbooks.jobCount).toBe(0);
    expect(result.alerts).toHaveLength(0);
  });

  it("aggregates audio cost by subject from query rows", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        { subject: "ENGLISH", total_cost: 3.06, lesson_count: BigInt(180) },
        { subject: "MATH", total_cost: 1.38, lesson_count: BigInt(81) },
      ])
      .mockResolvedValueOnce([]); // grade rows

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.audio.bySubject).toHaveLength(2);
    expect(result.audio.bySubject[0]).toMatchObject({
      subject: "ENGLISH",
      totalCostUsd: 3.06,
      lessonCount: 180,
    });
    expect(result.audio.bySubject[0].avgCostPerLesson).toBeCloseTo(3.06 / 180, 8);
    expect(result.audio.totalCostUsd).toBeCloseTo(4.44, 5);
    expect(result.audio.lessonCount).toBe(261);
  });

  it("aggregates audio cost by grade", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([]) // subject rows
      .mockResolvedValueOnce([
        { grade: 5, total_cost: 3.06, lesson_count: BigInt(180) },
        { grade: 7, total_cost: 1.50, lesson_count: BigInt(88) },
      ]);

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.audio.byGrade).toHaveLength(2);
    expect(result.audio.byGrade[0]).toMatchObject({ grade: 5, totalCostUsd: 3.06, lessonCount: 180 });
    expect(result.audio.byGrade[1]).toMatchObject({ grade: 7, totalCostUsd: 1.5, lessonCount: 88 });
  });

  it("reports today cost from aggregate", async () => {
    mockAudioAggregate
      .mockResolvedValueOnce(makeAggResult(0.51)) // today
      .mockResolvedValueOnce(makeAggResult(0.51)); // month

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.todayCostUsd).toBeCloseTo(0.51, 5);
    expect(result.audio.todayCostUsd).toBeCloseTo(0.51, 5);
  });

  it("includes textbook costs in combined total", async () => {
    mockTextbookGroupBy.mockResolvedValue([
      { subject: "ENGLISH", grade: 5, _sum: { estimatedCostUsd: 0.0 }, _count: { _all: 1 } },
    ]);

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.textbooks.jobCount).toBe(1);
    expect(result.textbooks.bySubject).toHaveLength(1);
    expect(result.textbooks.bySubject[0].subject).toBe("ENGLISH");
  });

  it("emits stop flag alert when TTS_STOP_GENERATION is active", async () => {
    mockIsTtsGenerationStopped.mockReturnValue(true);

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.ttsStopFlagActive).toBe(true);
    expect(result.alerts.some((a) => a.includes("TTS_STOP_GENERATION"))).toBe(true);
  });

  it("emits 80% daily cap warning alert", async () => {
    mockGetTtsDailyBudgetUsd.mockReturnValue(5);
    mockAudioAggregate
      .mockResolvedValueOnce(makeAggResult(4.1)) // today — above 80% of $5
      .mockResolvedValueOnce(makeAggResult(4.1)); // month

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.alerts.some((a) => a.includes("80%"))).toBe(true);
  });

  it("emits daily cap reached alert when at 100%", async () => {
    mockGetTtsDailyBudgetUsd.mockReturnValue(5);
    mockAudioAggregate
      .mockResolvedValueOnce(makeAggResult(5.5)) // today — at cap
      .mockResolvedValueOnce(makeAggResult(5.5)); // month

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.alerts.some((a) => a.includes("daily cap"))).toBe(true);
  });

  it("emits 90% monthly cap warning alert", async () => {
    mockGetTtsMonthlyCapUsd.mockReturnValue(100);
    mockAudioAggregate
      .mockResolvedValueOnce(makeAggResult(0))   // today
      .mockResolvedValueOnce(makeAggResult(91)); // month — above 90%

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.alerts.some((a) => a.includes("90%"))).toBe(true);
  });

  it("exposes dailyCap and monthlyCap from flags", async () => {
    mockGetTtsDailyBudgetUsd.mockReturnValue(10);
    mockGetTtsMonthlyCapUsd.mockReturnValue(200);

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.dailyCap).toBe(10);
    expect(result.monthlyCap).toBe(200);
  });

  it("computes avgCostPerLesson as 0 when no lessons exist", async () => {
    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();
    expect(result.audio.avgCostPerLesson).toBe(0);
  });

  it("aggregates textbook byGrade when multiple grades for same subject", async () => {
    mockTextbookGroupBy.mockResolvedValue([
      { subject: "MATH", grade: 5, _sum: { estimatedCostUsd: 0.0 }, _count: { _all: 1 } },
      { subject: "MATH", grade: 7, _sum: { estimatedCostUsd: 0.0 }, _count: { _all: 2 } },
    ]);

    const { getPipelineCostSummary } = await import("@/lib/curriculum/pipelineCostSummary");
    const result = await getPipelineCostSummary();

    expect(result.textbooks.bySubject).toHaveLength(1);
    expect(result.textbooks.bySubject[0].jobCount).toBe(3);
    expect(result.textbooks.byGrade).toHaveLength(2);
    expect(result.textbooks.jobCount).toBe(3);
  });
});
