import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/certificates/[id]/share/route";
import { generateShareToken, verifyShareToken } from "@/lib/certificates/shareToken";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    certificate: {
      findUnique: vi.fn(),
    },
    scheduledWork: {
      findUnique: vi.fn(),
    },
    certificateShare: {
      upsert: vi.fn(),
    },
  },
}));

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockStudent = {
  id: "user-student-1",
  role: "STUDENT" as const,
  isPlatformAdmin: false,
  schoolId: "school-1",
};

const mockCert = {
  id: "cert-test-1",
  type: "LESSON" as const,
  referenceId: "sw-lesson-1",
  awardedAt: new Date("2026-06-01T00:00:00Z"),
  student: {
    userId: "user-student-1",
    user: { name: "Amara Konneh" },
  },
};

const mockSw = {
  content: {
    payload: { title: "Introduction to Fractions" },
    subject: "MATH",
    contentId: "math-g6-fractions",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.NEXTAUTH_URL = "https://test.example.com";
  vi.mocked(requireRole).mockResolvedValue(mockStudent as any);
  vi.mocked(prisma.certificate.findUnique).mockResolvedValue(mockCert as any);
  vi.mocked(prisma.scheduledWork.findUnique).mockResolvedValue(mockSw as any);
  vi.mocked(prisma.certificateShare.upsert).mockResolvedValue({} as any);
});

function makeReq(id: string) {
  return new Request(`https://test.example.com/api/certificates/${id}/share`, {
    method: "POST",
  });
}

describe("POST /api/certificates/[id]/share", () => {
  it("returns shareUrl, imageUrl, whatsappText", async () => {
    const res = await POST(makeReq("cert-test-1"), {
      params: { id: "cert-test-1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shareUrl).toContain("/share/certificate/cert-test-1");
    expect(body.imageUrl).toContain("/api/certificates/cert-test-1/image");
    expect(body.whatsappText).toContain("Amara Konneh");
    expect(body.whatsappText).toContain("Introduction to Fractions");
    expect(body.whatsappText).toContain("LiberiaLearn");
  });

  it("embeds a valid HMAC token in the URLs", async () => {
    const res = await POST(makeReq("cert-test-1"), {
      params: { id: "cert-test-1" },
    });
    const { shareUrl } = await res.json() as { shareUrl: string };
    const url = new URL(shareUrl);
    const token = url.searchParams.get("token") ?? "";
    expect(verifyShareToken("cert-test-1", token)).toBe(true);
  });

  it("upserts a CertificateShare record", async () => {
    await POST(makeReq("cert-test-1"), { params: { id: "cert-test-1" } });
    expect(prisma.certificateShare.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          certificateId: "cert-test-1",
          sharedById: "user-student-1",
          channel: "whatsapp",
        }),
      })
    );
  });

  it("returns 404 when certificate not found", async () => {
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq("not-a-cert"), { params: { id: "not-a-cert" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when student tries to share another student's cert", async () => {
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
      ...mockCert,
      student: { userId: "user-other-student", user: { name: "Other" } },
    } as any);
    const res = await POST(makeReq("cert-test-1"), { params: { id: "cert-test-1" } });
    expect(res.status).toBe(403);
  });
});

describe("generateShareToken / verifyShareToken round-trip", () => {
  it("verifies a freshly generated token", () => {
    const token = generateShareToken("cert-roundtrip-1");
    expect(verifyShareToken("cert-roundtrip-1", token)).toBe(true);
  });

  it("rejects token from a different cert ID", () => {
    const token = generateShareToken("cert-roundtrip-1");
    expect(verifyShareToken("cert-roundtrip-2", token)).toBe(false);
  });
});
