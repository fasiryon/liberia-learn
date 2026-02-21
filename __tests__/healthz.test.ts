import { describe, it, expect, vi } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

describe("GET /api/healthz", () => {
  it("returns status ok when DB is reachable", async () => {
    const { GET } = await import("@/app/api/healthz/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("ts");
  });

  it("returns status degraded when DB fails", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("connection refused"));

    const { GET } = await import("@/app/api/healthz/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("error");
  });
});

