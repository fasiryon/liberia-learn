import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    guardianSmsCostAccounting: {
      aggregate: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { countSmsSegments, checkSmsCostCap, recordSmsSpend, getActiveSmsRateUsdPerSegment } from "@/lib/agents/sms/smsCost";

describe("countSmsSegments", () => {
  it("counts a short GSM-7 message as 1 segment", () => {
    expect(countSmsSegments("Hi there.")).toBe(1);
  });

  it("counts exactly 160 GSM-7 chars as 1 segment", () => {
    expect(countSmsSegments("a".repeat(160))).toBe(1);
  });

  it("counts 161 GSM-7 chars as 2 segments (153/segment once split)", () => {
    expect(countSmsSegments("a".repeat(161))).toBe(2);
  });

  it("counts an empty string as 0 segments", () => {
    expect(countSmsSegments("")).toBe(0);
  });

  it("uses the tighter UCS-2 limit for non-GSM-7 characters", () => {
    // emoji forces UCS-2 (70/segment)
    expect(countSmsSegments("hi 👋".padEnd(71, "a"))).toBeGreaterThanOrEqual(2);
  });
});

describe("getActiveSmsRateUsdPerSegment", () => {
  const original = process.env.SMS_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.SMS_PROVIDER;
    else process.env.SMS_PROVIDER = original;
  });

  it("defaults to the cited Twilio Liberia rate when no provider is explicitly selected", () => {
    delete process.env.SMS_PROVIDER;
    expect(getActiveSmsRateUsdPerSegment()).toBeCloseTo(0.2677, 4);
  });

  it("uses the cited Orange Liberia rate when SMS_PROVIDER=orange", () => {
    process.env.SMS_PROVIDER = "orange";
    expect(getActiveSmsRateUsdPerSegment()).toBeCloseTo(0.06, 4);
  });

  it("uses the Twilio rate when SMS_PROVIDER=twilio explicitly", () => {
    process.env.SMS_PROVIDER = "twilio";
    expect(getActiveSmsRateUsdPerSegment()).toBeCloseTo(0.2677, 4);
  });
});

describe("checkSmsCostCap", () => {
  beforeEach(() => {
    mockPrisma.guardianSmsCostAccounting.aggregate.mockReset();
    mockPrisma.guardianSmsCostAccounting.findUnique.mockReset();
    mockPrisma.guardianSmsCostAccounting.upsert.mockReset();
  });

  it("allows a send when both the guardian and total caps have headroom", async () => {
    mockPrisma.guardianSmsCostAccounting.aggregate.mockResolvedValue({ _sum: { outboundSegments: 0 } });
    mockPrisma.guardianSmsCostAccounting.findUnique.mockResolvedValue(null);
    const result = await checkSmsCostCap("+231770000111", 1);
    expect(result).toEqual({ allowed: true });
  });

  it("blocks when the per-guardian daily cap would be exceeded", async () => {
    mockPrisma.guardianSmsCostAccounting.aggregate.mockResolvedValue({ _sum: { outboundSegments: 0 } });
    mockPrisma.guardianSmsCostAccounting.findUnique.mockResolvedValue({ outboundSegments: 10 });
    const result = await checkSmsCostCap("+231770000111", 1);
    expect(result).toEqual({ allowed: false, reason: "guardian_daily_cap" });
  });

  it("blocks when the total daily cap would be exceeded", async () => {
    mockPrisma.guardianSmsCostAccounting.aggregate.mockResolvedValue({ _sum: { outboundSegments: 180 } });
    mockPrisma.guardianSmsCostAccounting.findUnique.mockResolvedValue(null);
    const result = await checkSmsCostCap("+231770000111", 1);
    expect(result).toEqual({ allowed: false, reason: "total_daily_cap" });
  });
});

describe("recordSmsSpend", () => {
  it("upserts the daily rollup with segments and estimated cost", async () => {
    mockPrisma.guardianSmsCostAccounting.upsert.mockResolvedValue({});
    await recordSmsSpend("+231770000111", 2);
    expect(mockPrisma.guardianSmsCostAccounting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ guardianPhone_date: expect.objectContaining({ guardianPhone: "+231770000111" }) }),
        create: expect.objectContaining({ outboundSegments: 2 }),
      })
    );
  });
});
