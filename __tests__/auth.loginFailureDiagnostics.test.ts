import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRecordMetricEvent, mockCheckRateLimit, mockFindFirst, mockFindUnique, mockCompare } = vi.hoisted(() => ({
  mockRecordMetricEvent: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCompare: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findFirst: mockFindFirst, findUnique: mockFindUnique } } }));
vi.mock("bcryptjs", () => ({ default: { compare: mockCompare } }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mockCheckRateLimit }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mockRecordMetricEvent }));

import { authorizeCredentials } from "@/lib/auth";

const CREDS = { studentId: "LL-000123", password: "1234" };

describe("authorizeCredentials — reason-coded, PII-free failure diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordMetricEvent.mockResolvedValue(undefined);
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
  });

  function lastEvent() {
    expect(mockRecordMetricEvent).toHaveBeenCalledTimes(1);
    const [name, payload, scope] = mockRecordMetricEvent.mock.calls[0];
    // The identifier and secret never reach the metrics table.
    expect(JSON.stringify([payload, scope])).not.toContain("LL-000123");
    expect(JSON.stringify([payload, scope])).not.toContain("1234");
    return { name, payload, scope };
  }

  it("records rate limiting", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false });
    expect(await authorizeCredentials(CREDS)).toBeNull();
    expect(lastEvent()).toMatchObject({ name: "auth.login.failed", payload: { reason: "rate_limited" } });
  });

  it("records an inactive school with its schoolId so support can see a tenant issue", async () => {
    const user = {
      id: "u-1",
      hashedPwd: "hash",
      role: "STUDENT",
      schoolId: "school-7",
      isPlatformAdmin: false,
      school: { status: "SUSPENDED" },
    };
    mockFindFirst.mockResolvedValue(user);
    mockFindUnique.mockResolvedValue(user);
    mockCompare.mockResolvedValueOnce(true);
    expect(await authorizeCredentials(CREDS)).toBeNull();
    expect(lastEvent()).toMatchObject({
      payload: { reason: "school_inactive" },
      scope: { scope: "school", schoolId: "school-7", severity: "warning" },
    });
  });

  it("records a wrong password without the identifier", async () => {
    const user = { id: "u-1", hashedPwd: "hash", role: "STUDENT", schoolId: "school-1", isPlatformAdmin: false, school: { status: "ACTIVE" } };
    mockFindFirst.mockResolvedValue(user);
    mockFindUnique.mockResolvedValue(user);
    mockCompare.mockResolvedValueOnce(false);
    expect(await authorizeCredentials(CREDS)).toBeNull();
    expect(lastEvent()).toMatchObject({ payload: { reason: "bad_password" } });
  });

  it("login still fails closed when the metrics write itself fails", async () => {
    mockRecordMetricEvent.mockRejectedValueOnce(new Error("db down"));
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false });
    await expect(authorizeCredentials(CREDS)).resolves.toBeNull();
  });
});
