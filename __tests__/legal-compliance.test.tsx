import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import PrivacyPolicyPage from "@/app/legal/privacy/page";
import TermsOfServicePage from "@/app/legal/terms/page";
import DataForMinorsPage from "@/app/legal/data-for-minors/page";
import ContactPage from "@/app/contact/page";
import { LegalFooter } from "@/components/LegalFooter";
import {
  COOKIE_NOTICE_KEY,
  isCookieNoticePublicPage,
} from "@/components/CookieNotice";
import { CURRENT_POLICY_VERSION } from "@/lib/policy/policyVersion";
import { ConsentAcceptanceModal } from "@/components/ConsentAcceptanceModal";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ refresh: vi.fn() }),
  redirect: vi.fn(),
}));

describe("Sprint 16F legal pages", () => {
  it("renders the privacy policy with required content", () => {
    const html = renderToStaticMarkup(<PrivacyPolicyPage />);

    expect(html).toContain("Privacy Policy");
    expect(html).toContain("name, grade, school, learning activity");
    expect(html).toContain("guardian contact information");
    expect(html).toContain("MOE views do not permit individual student");
    expect(html).toContain("Supabase/Postgres");
    expect(html).toContain("Vercel edge network");
    expect(html).toContain("active account lifetime plus 2 years");
    expect(html).toContain("Student data is never sold");
    expect(html).toContain("April 2026");
    expect(html).toContain("LiberiaLearn / Republic of Liberia");
  });

  it("renders the terms of service with required content", () => {
    const html = renderToStaticMarkup(<TermsOfServicePage />);

    expect(html).toContain("Terms of Service");
    expect(html).toContain("K-12 national education delivery");
    expect(html).toContain("educational purposes");
    expect(html).toContain("School administrators are responsible");
    expect(html).toContain("automated scraping");
    expect(html).toContain("Curriculum content");
    expect(html).toContain("Limitation of Liability");
    expect(html).toContain("Republic of Liberia");
    expect(html).toContain("April 2026");
  });

  it("renders the data handling for minors page", () => {
    const html = renderToStaticMarkup(<DataForMinorsPage />);

    expect(html).toContain("Data Handling for Minors");
    expect(html).toContain("collects only the data");
    expect(html).toContain("No Advertising or Commercial Profiling");
    expect(html).toContain("Guardians may request access");
    expect(html).toContain("data-requests@liberialearn.org");
  });

  it("renders the contact page", () => {
    const html = renderToStaticMarkup(<ContactPage />);

    expect(html).toContain("LiberiaLearn Support");
    expect(html).toContain("data-requests@liberialearn.org");
    expect(html).toContain("enrollment@liberialearn.org");
    expect(html).toContain("support@liberialearn.org");
    expect(html).toContain("/legal/privacy");
  });
});

describe("Sprint 16F footer and cookie notice", () => {
  it("uses canonical legal links in the shared footer", () => {
    const html = renderToStaticMarkup(<LegalFooter />);

    expect(html).toContain("/legal/privacy");
    expect(html).toContain("/legal/terms");
    expect(html).toContain("/legal/data-for-minors");
    expect(html).toContain("/contact");
  });

  it("limits the cookie notice to public pages", () => {
    expect(COOKIE_NOTICE_KEY).toBe("liberialearn_session_cookie_notice_dismissed");
    expect(isCookieNoticePublicPage("/")).toBe(true);
    expect(isCookieNoticePublicPage("/legal/privacy")).toBe(true);
    expect(isCookieNoticePublicPage("/pilot-preview")).toBe(true);
    expect(isCookieNoticePublicPage("/dashboard")).toBe(false);
    expect(isCookieNoticePublicPage("/teacher")).toBe(false);
    expect(isCookieNoticePublicPage("/admin")).toBe(false);
  });
});

describe("Sprint 16F consent modal", () => {
  it("appears on first authenticated portal view and links to legal pages", () => {
    const html = renderToStaticMarkup(
      <ConsentAcceptanceModal initialAccepted={false} policyVersion={CURRENT_POLICY_VERSION} />
    );

    expect(html).toContain("Required policy acceptance");
    expect(html).toContain("View Privacy Policy");
    expect(html).toContain("/legal/privacy");
    expect(html).toContain("View Terms");
    expect(html).toContain("/legal/terms");
    expect(html).toContain("I accept the Terms and Privacy Policy");
  });

  it("skips rendering when the current version is already accepted", () => {
    const html = renderToStaticMarkup(
      <ConsentAcceptanceModal initialAccepted={true} policyVersion={CURRENT_POLICY_VERSION} />
    );

    expect(html).toBe("");
  });
});

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockDataPolicyFindFirst = vi.hoisted(() => vi.fn());
const mockDataPolicyCreate = vi.hoisted(() => vi.fn());
const mockConsentCreate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    dataPolicyAcceptance: {
      findFirst: mockDataPolicyFindFirst,
      create: mockDataPolicyCreate,
    },
    consentRecord: {
      create: mockConsentCreate,
    },
    $transaction: mockTransaction,
  },
}));

describe("Sprint 16F consent acceptance API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      id: "user-1",
      role: "STUDENT",
      schoolId: "school-1",
    });
    mockDataPolicyFindFirst.mockResolvedValue(null);
    mockDataPolicyCreate.mockResolvedValue({ id: "accept-1" });
    mockConsentCreate.mockResolvedValue({ id: "consent-1" });
    mockTransaction.mockResolvedValue([{ id: "accept-1" }, { id: "consent-1" }]);
  });

  it("creates DataPolicyAcceptance and ConsentRecord on acceptance", async () => {
    const { POST } = await import("@/app/api/legal/accept-policy/route");
    const response = await POST(
      new Request("http://localhost/api/legal/accept-policy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.10, 10.0.0.1",
          "user-agent": "vitest",
        },
        body: JSON.stringify({ policyVersion: CURRENT_POLICY_VERSION }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockDataPolicyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        schoolId: "school-1",
        policyVersion: CURRENT_POLICY_VERSION,
        ipAddress: "203.0.113.10",
      }),
    });
    expect(mockConsentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        consentType: "terms_privacy",
        policyVersion: CURRENT_POLICY_VERSION,
      }),
    });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate writes when the current version is already accepted", async () => {
    mockDataPolicyFindFirst.mockResolvedValue({ id: "accept-1" });
    const { POST } = await import("@/app/api/legal/accept-policy/route");

    const response = await POST(
      new Request("http://localhost/api/legal/accept-policy", {
        method: "POST",
        body: JSON.stringify({ policyVersion: CURRENT_POLICY_VERSION }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.alreadyAccepted).toBe(true);
    expect(mockDataPolicyCreate).not.toHaveBeenCalled();
    expect(mockConsentCreate).not.toHaveBeenCalled();
  });

  it.each(["STUDENT", "TEACHER", "ADMIN", "GUARDIAN", "MOE_OFFICIAL"])(
    "records acceptance for %s role",
    async (role) => {
      vi.clearAllMocks();
      mockRequireUser.mockResolvedValue({ id: `user-${role}`, role, schoolId: role === "MOE_OFFICIAL" ? null : "school-1" });
      mockDataPolicyFindFirst.mockResolvedValue(null);
      mockDataPolicyCreate.mockResolvedValue({ id: "accept-1" });
      mockConsentCreate.mockResolvedValue({ id: "consent-1" });
      mockTransaction.mockResolvedValue([{ id: "accept-1" }, { id: "consent-1" }]);

      const { POST } = await import("@/app/api/legal/accept-policy/route");
      const response = await POST(
        new Request("http://localhost/api/legal/accept-policy", {
          method: "POST",
          body: JSON.stringify({ policyVersion: CURRENT_POLICY_VERSION }),
        })
      );

      expect(response.status).toBe(200);
      expect(mockDataPolicyCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: `user-${role}`,
          policyVersion: CURRENT_POLICY_VERSION,
          metadata: expect.objectContaining({ role }),
        }),
      });
    }
  );
});
