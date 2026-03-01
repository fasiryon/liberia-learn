import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma and alignment helper before imports
const mockFindMany = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

// Mock OpenAI so alignContentToMOE doesn't throw when called
const mockCreate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClientOrThrow: () => ({
    chat: { completions: { create: mockCreate } },
  }),
}));

import { alignAllContent } from "@/lib/moe/alignment-engine";

const PUBLISHED_RECORD = {
  id: "rec-pub-1",
  grade: 5,
  subject: "math",
  status: "published",
  payload: { title: "Fractions", objectives: ["Understand fractions"] },
  moeAlignments: null,
};

const ACCEPTED_RECORD = {
  id: "rec-acc-1",
  grade: 3,
  subject: "science",
  status: "accepted",
  payload: { title: "Plants", objectives: ["Understand plants"] },
  moeAlignments: null,
};

describe("alignAllContent — status filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty so loop exits immediately
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(null);
    mockUpdate.mockResolvedValue({});
  });

  it("queries for both published and accepted status", async () => {
    await alignAllContent();

    expect(mockFindMany).toHaveBeenCalledOnce();
    const callArg = mockFindMany.mock.calls[0][0];
    expect(callArg.where.status).toEqual({ in: ["published", "accepted"] });
  });

  it("excludes pending_approval and rejected content", async () => {
    await alignAllContent();

    const callArg = mockFindMany.mock.calls[0][0];
    const statusFilter = callArg.where.status;
    // Must be object with "in" array — not a plain string
    expect(typeof statusFilter).toBe("object");
    expect(statusFilter.in).toContain("published");
    expect(statusFilter.in).toContain("accepted");
    expect(statusFilter.in).not.toContain("pending_approval");
    expect(statusFilter.in).not.toContain("rejected");
  });

  it("includes moeAlignments: null filter when force is false (default)", async () => {
    await alignAllContent();

    const callArg = mockFindMany.mock.calls[0][0];
    expect(callArg.where.moeAlignments).toBe(null);
  });

  it("does NOT filter on moeAlignments when force is true", async () => {
    await alignAllContent({ force: true });

    const callArg = mockFindMany.mock.calls[0][0];
    expect(callArg.where).not.toHaveProperty("moeAlignments");
  });

  it("processes published records returned by the query", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: PUBLISHED_RECORD.id },
      { id: ACCEPTED_RECORD.id },
    ]);
    // Make findUnique return null so alignContentToMOE throws and we count failures
    // (we just want to verify loop runs for both records)
    mockFindUnique.mockResolvedValue(null);

    const result = await alignAllContent();

    // Both records attempted (failed because findUnique returns null)
    expect(result.success + result.failed).toBe(2);
  });
});
