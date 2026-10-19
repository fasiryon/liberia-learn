import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  logAudit: vi.fn(),
  logProductSignal: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: mocks.logProductSignal }));
vi.mock("@/lib/db", () => ({ prisma: { reportCard: { findUnique: mocks.findUnique, update: mocks.update } } }));

import { PATCH } from "@/app/api/report-cards/[id]/comment/route";

const request = (body: unknown) => new Request("http://localhost/api/report-cards/rc-1/comment", { method: "PATCH", body: JSON.stringify(body) }) as never;

describe("report card comments respect publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
  });

  it("refuses to edit a published card (amendment required)", async () => {
    mocks.findUnique.mockResolvedValue({ id: "rc-1", schoolId: "school-1", status: "PUBLISHED", classId: "c", studentId: "s", termId: "t" });
    const response = await PATCH(request({ teacherComment: "Changed after publication" }), { params: { id: "rc-1" } });
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses another school's card", async () => {
    mocks.findUnique.mockResolvedValue({ id: "rc-1", schoolId: "school-2", status: "DRAFT" });
    const response = await PATCH(request({ teacherComment: "x" }), { params: { id: "rc-1" } });
    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
