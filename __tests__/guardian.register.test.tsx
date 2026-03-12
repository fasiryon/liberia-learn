import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockFindInviteByToken = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockSchoolFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserCreate = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockStudentGuardianUpsert = vi.hoisted(() => vi.fn());
const mockGuardianConsentUpsert = vi.hoisted(() => vi.fn());
const mockInviteTokenUpdate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockHash = vi.hoisted(() => vi.fn());

vi.mock("bcryptjs", () => ({ default: { hash: mockHash } }));
vi.mock("@/lib/inviteTokens", () => ({ findInviteByToken: mockFindInviteByToken }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    school: { findUnique: mockSchoolFindUnique },
    user: { findUnique: mockUserFindUnique, create: mockUserCreate, update: mockUserUpdate },
    studentGuardian: { upsert: mockStudentGuardianUpsert },
    guardianConsent: { upsert: mockGuardianConsentUpsert },
    inviteToken: { update: mockInviteTokenUpdate },
    $transaction: mockTransaction,
  },
}));
vi.mock("@/app/guardian/register/RegisterForm", () => ({
  default: ({ phone }: { phone: string }) => <div>FORM:{phone}</div>,
}));

import GuardianRegisterPage from "@/app/guardian/register/page";
import { POST as guardianRegisterPOST } from "@/app/api/guardian/register/route";

function makeReq(body: any) {
  return new Request("http://localhost/api/guardian/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHash.mockResolvedValue("hashed-pin");
  mockFindInviteByToken.mockResolvedValue({
    id: "invite-1",
    tokenType: "GUARDIAN_LINK",
    schoolId: "school-1",
    studentId: "student-1",
    email: "guardian@example.com",
    relation: "Parent",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  });
  mockStudentFindUnique.mockResolvedValue({ id: "student-1", user: { schoolId: "school-1", name: "Martha Doe" } });
  mockSchoolFindUnique.mockResolvedValue({ name: "Monrovia Central School" });
  mockUserFindUnique.mockResolvedValue({ id: "guardian-1", name: "Ma Martha", guardianPhoneE164: "+231770000111" });
  mockUserUpdate.mockResolvedValue({ id: "guardian-1" });
  mockUserCreate.mockResolvedValue({ id: "guardian-1" });
  mockStudentGuardianUpsert.mockResolvedValue({ id: "link-1" });
  mockGuardianConsentUpsert.mockResolvedValue({ id: "consent-1" });
  mockInviteTokenUpdate.mockResolvedValue({ id: "invite-1" });
  mockTransaction.mockImplementation(async (cb: any) => cb({
    user: { update: mockUserUpdate, create: mockUserCreate },
    studentGuardian: { upsert: mockStudentGuardianUpsert },
    guardianConsent: { upsert: mockGuardianConsentUpsert },
    inviteToken: { update: mockInviteTokenUpdate },
  }));
});

describe("guardian register page", () => {
  it("renders child name and school for a valid token", async () => {
    const element = await GuardianRegisterPage({ searchParams: Promise.resolve({ token: "tok-1" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Martha Doe");
    expect(html).toContain("Monrovia Central School");
    expect(html).toContain("FORM:+231770000111");
  });

  it("renders expired message for an invalid token", async () => {
    mockFindInviteByToken.mockResolvedValue(null);
    const element = await GuardianRegisterPage({ searchParams: Promise.resolve({ token: "bad" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("This link has expired.");
    expect(html).toContain("Please contact your child&#x27;s school.");
  });
});

describe("guardian register route", () => {
  it("returns login redirect on success", async () => {
    const res = await guardianRegisterPOST(makeReq({ token: "tok-1", fullName: "Ma Martha", pin: "1234", confirmPin: "1234" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.redirectTo).toContain("/login?message=");
    expect(mockStudentGuardianUpsert).toHaveBeenCalled();
  });

  it("returns the expired token message when the invite is expired", async () => {
    mockFindInviteByToken.mockResolvedValue({
      id: "invite-2",
      tokenType: "GUARDIAN_LINK",
      schoolId: "school-1",
      studentId: "student-1",
      email: "guardian@example.com",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await guardianRegisterPOST(makeReq({ token: "tok-2", fullName: "Ma Martha", pin: "1234", confirmPin: "1234" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("This link has expired. Please contact your child's school.");
  });
});

