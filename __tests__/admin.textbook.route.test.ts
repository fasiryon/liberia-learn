import { Readable } from "stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsTextbookCompilerEnabled = vi.hoisted(() => vi.fn());
const mockCompileTextbook = vi.hoisted(() => vi.fn());
const mockRenderTextbookPdfStream = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isTextbookCompilerEnabled: mockIsTextbookCompilerEnabled,
  };
});

vi.mock("@/lib/ai/textbook/textbookCompiler", () => ({
  compileTextbook: mockCompileTextbook,
}));

vi.mock("@/lib/ai/textbook/textbookPdf", () => ({
  renderTextbookPdfStream: mockRenderTextbookPdfStream,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

import { GET } from "@/app/api/admin/curriculum/textbook/route";

const adminUser = {
  id: "admin-1",
  role: "ADMIN",
  schoolId: "school-1",
  isPlatformAdmin: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue(adminUser);
  mockIsTextbookCompilerEnabled.mockReturnValue(true);
  mockCompileTextbook.mockResolvedValue({
    title: "Math Grade 5 Textbook",
    subject: "MATH",
    gradeLevel: 5,
    units: [
      {
        id: "db-1",
        unitId: "unit-1",
        title: "Fractions",
        description: "Build fraction understanding.",
        subject: "MATH",
        gradeLevel: 5,
        orderIndex: 1,
        lessons: [],
      },
    ],
    totalLessons: 7,
    generatedAt: new Date("2026-03-13T00:00:00.000Z"),
  });
  mockRenderTextbookPdfStream.mockResolvedValue(
    Readable.from(Buffer.from("%PDF-1.4 textbook"))
  );
  mockLogAudit.mockResolvedValue(undefined);
});

describe("GET /api/admin/curriculum/textbook", () => {
  it("returns 404 when no units are found", async () => {
    mockCompileTextbook.mockResolvedValue({
      title: "Math Grade 5 Textbook",
      subject: "MATH",
      gradeLevel: 5,
      units: [],
      totalLessons: 0,
      generatedAt: new Date("2026-03-13T00:00:00.000Z"),
    });

    const res = await GET(
      new Request("http://localhost/api/admin/curriculum/textbook?subject=MATH&gradeLevel=5") as any
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("No units found. Assemble units first.");
  });

  it("returns PDF content-type on success", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/curriculum/textbook?subject=MATH&gradeLevel=5") as any
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("math-grade5-textbook.pdf");
  });

  it("gates the route when ENABLE_TEXTBOOK_COMPILER is disabled", async () => {
    mockIsTextbookCompilerEnabled.mockReturnValue(false);

    const res = await GET(
      new Request("http://localhost/api/admin/curriculum/textbook?subject=MATH&gradeLevel=5") as any
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("textbook_compiler_disabled");
  });

  it("calls audit log on successful textbook generation", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/curriculum/textbook?subject=MATH&gradeLevel=5") as any
    );

    expect(res.status).toBe(200);
    expect(mockLogAudit).toHaveBeenCalledOnce();
    expect(mockLogAudit.mock.calls[0][0].action).toBe("admin.textbook.generated");
  });
});
