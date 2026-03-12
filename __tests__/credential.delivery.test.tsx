import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockSendCredentialSms = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findFirst: mockUserFindFirst } } }));
vi.mock("@/lib/credentials", () => ({ sendCredentialSms: mockSendCredentialSms }));

import { POST as sendCredentialPOST } from "@/app/api/admin/credentials/send/route";
import CredentialCardPage from "@/app/admin/credential-card/page";
import HomePage from "@/app/page";

function makeReq(body: any) {
  return new Request("http://localhost/api/admin/credentials/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });
  mockUserFindFirst.mockResolvedValue({
    id: "user-1",
    name: "Student One",
    email: "student@example.com",
    loginId: "LBR-2024-001",
    role: "STUDENT",
    guardianPhoneE164: "+231770000111",
    school: { name: "Monrovia Central School" },
  });
  mockSendCredentialSms.mockResolvedValue({ ok: true });
});

describe("credential delivery route", () => {
  it("returns confirmation when SMS is sent", async () => {
    const res = await sendCredentialPOST(makeReq({ userId: "user-1", pin: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.phone).toBe("+231770000111");
    expect(mockSendCredentialSms).toHaveBeenCalled();
  });

  it("returns a print fallback error when no phone exists", async () => {
    mockUserFindFirst.mockResolvedValue({
      id: "user-1",
      name: "Student One",
      email: "student@example.com",
      loginId: "LBR-2024-001",
      role: "STUDENT",
      guardianPhoneE164: null,
      school: { name: "Monrovia Central School" },
    });

    const res = await sendCredentialPOST(makeReq({ userId: "user-1", pin: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No phone number on file. Use Print instead.");
  });
});

describe("credential card page + homepage", () => {
  it("renders print layout with name, ID, PIN, and website", async () => {
    const element = await CredentialCardPage({ searchParams: Promise.resolve({ userId: "user-1", pin: "123456" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Student One");
    expect(html).toContain("LBR-2024-001");
    expect(html).toContain("123456");
    expect(html).toContain("liberialearn.edu.lr");
  });

  it("homepage exposes the MOE login link", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("Ministry Officials");
    expect(html).toContain("/moe/login");
  });
});

