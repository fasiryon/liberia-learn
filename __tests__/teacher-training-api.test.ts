import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    trainingModule: {
      findUnique: vi.fn(),
    },
    trainingProgress: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { PATCH } from "@/app/api/teacher/training/progress/route";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

describe("teacher training progress", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("updates progress for the current teacher", async () => {
    (requireRole as any).mockResolvedValue({ id: "u1", role: "TEACHER" });
    (prisma.trainingModule.findUnique as any).mockResolvedValue({ id: "tm1", isActive: true });
    (prisma.trainingProgress.findUnique as any).mockResolvedValue(null);
    (prisma.trainingProgress.upsert as any).mockResolvedValue({
      id: "tp1",
      teacherUserId: "u1",
      moduleId: "tm1",
      status: "in_progress",
      startedAt: new Date("2026-02-20T00:00:00.000Z"),
      completedAt: null,
    });

    const req = new Request("http://localhost/api/teacher/training/progress", {
      method: "PATCH",
      body: JSON.stringify({ moduleId: "tm1", status: "in_progress" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(prisma.trainingProgress.upsert).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalled();
  });

  it("rejects non-teacher updates", async () => {
    (requireRole as any).mockResolvedValue({ id: "u2", role: "ADMIN" });

    const req = new Request("http://localhost/api/teacher/training/progress", {
      method: "PATCH",
      body: JSON.stringify({ moduleId: "tm1", status: "complete" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
  });

  it("sets completedAt when marked complete", async () => {
    (requireRole as any).mockResolvedValue({ id: "u1", role: "TEACHER" });
    (prisma.trainingModule.findUnique as any).mockResolvedValue({ id: "tm1", isActive: true });
    (prisma.trainingProgress.findUnique as any).mockResolvedValue({
      id: "tp1",
      teacherUserId: "u1",
      moduleId: "tm1",
      status: "in_progress",
      startedAt: new Date("2026-02-19T00:00:00.000Z"),
      completedAt: null,
    });
    (prisma.trainingProgress.upsert as any).mockResolvedValue({
      id: "tp1",
      teacherUserId: "u1",
      moduleId: "tm1",
      status: "complete",
      startedAt: new Date("2026-02-19T00:00:00.000Z"),
      completedAt: new Date("2026-02-20T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/teacher/training/progress", {
      method: "PATCH",
      body: JSON.stringify({ moduleId: "tm1", status: "complete" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(prisma.trainingProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "complete", completedAt: expect.any(Date) }),
      })
    );
  });

  it("rejects inactive module completion", async () => {
    (requireRole as any).mockResolvedValue({ id: "u1", role: "TEACHER" });
    (prisma.trainingModule.findUnique as any).mockResolvedValue({ id: "tm1", isActive: false });

    const req = new Request("http://localhost/api/teacher/training/progress", {
      method: "PATCH",
      body: JSON.stringify({ moduleId: "tm1", status: "complete" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Module is inactive");
  });
});
