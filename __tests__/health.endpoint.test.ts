import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks
const mockSchoolCount = vi.hoisted(() => vi.fn());
const mockQueryRaw = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    school: { count: mockSchoolCount },
    $queryRaw: mockQueryRaw,
  },
}));

import { GET } from "@/app/api/health/route";

function clearHealthEnv() {
  delete process.env.OPENAI_API_KEY;
  delete process.env.AT_API_KEY;
  delete process.env.AFRICA_TALKING_API_KEY;
  delete process.env.AT_USERNAME;
  delete process.env.AFRICA_TALKING_USERNAME;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_PHONE_NUMBER;
  delete process.env.ORANGE_CLIENT_ID;
  delete process.env.ORANGE_CLIENT_SECRET;
  delete process.env.ORANGE_SENDER_NUMBER;
  delete process.env.SMS_PROVIDER;
  delete process.env.ENABLE_LIVE_SMS;
}

function setupHealthyDefaults() {
  mockSchoolCount.mockResolvedValue(5);
  mockQueryRaw.mockImplementation(async () => [{ pending: BigInt(0) }]);
  process.env.OPENAI_API_KEY = "sk-test-key";
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearHealthEnv();
    setupHealthyDefaults();
  });

  it("returns 200 with status=healthy when all checks pass", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.migrations).toBe("ok");
    expect(body.checks.aiFactory).toBe("ok");
    expect(body.checks.sms).toBe("ok");
    expect(body.checks.smsMode).toBe("dry_run");
  });

  it("treats disabled live SMS as healthy dry-run SMS", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.sms).toBe("ok");
    expect(body.checks.smsMode).toBe("dry_run");
  });

  it("includes version 1.0.0", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.version).toBe("1.0.0");
  });

  it("includes ISO timestamp", async () => {
    const res = await GET();
    const body = await res.json();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it("returns 200 with status=degraded when OPENAI_API_KEY is absent", async () => {
    delete process.env.OPENAI_API_KEY;

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.aiFactory).toBe("unavailable");
    expect(body.checks.database).toBe("ok");
  });

  it("returns 200 with status=degraded when live SMS has no provider credentials", async () => {
    process.env.ENABLE_LIVE_SMS = "true";

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.sms).toBe("unavailable");
    expect(body.checks.smsMode).toBe("live_unconfigured");
  });

  it("returns healthy and unverified mode when live SMS has Twilio credentials", async () => {
    process.env.ENABLE_LIVE_SMS = "true";
    process.env.SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "twilio-token";
    process.env.TWILIO_PHONE_NUMBER = "+2315550000";

    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.sms).toBe("ok");
    expect(body.checks.smsMode).toBe("live_configured_unverified");
  });

  it("returns degraded when explicit Orange SMS lacks Orange credentials", async () => {
    process.env.ENABLE_LIVE_SMS = "true";
    process.env.SMS_PROVIDER = "orange";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "twilio-token";
    process.env.TWILIO_PHONE_NUMBER = "+2315550000";

    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.sms).toBe("unavailable");
    expect(body.checks.smsMode).toBe("live_unconfigured");
  });

  it("returns healthy and unverified mode when explicit Orange SMS has credentials", async () => {
    process.env.ENABLE_LIVE_SMS = "true";
    process.env.SMS_PROVIDER = "orange";
    process.env.ORANGE_CLIENT_ID = "orange-client";
    process.env.ORANGE_CLIENT_SECRET = "orange-secret";
    process.env.ORANGE_SENDER_NUMBER = "+2315550000";

    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.sms).toBe("ok");
    expect(body.checks.smsMode).toBe("live_configured_unverified");
  });

  it("returns 200 with status=degraded when unapplied migrations exist", async () => {
    mockQueryRaw.mockImplementation(async () => [{ pending: BigInt(2) }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.migrations).toBe("pending");
  });

  it("returns 503 when database is unreachable", async () => {
    mockSchoolCount.mockRejectedValue(new Error("ECONNREFUSED"));
    mockQueryRaw.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database).toBe("error");
  });

  it("reports migrations as error when query fails", async () => {
    mockQueryRaw.mockRejectedValue(new Error("relation does not exist"));

    const res = await GET();
    const body = await res.json();
    expect(body.checks.migrations).toBe("error");
  });

  it("does not require authentication - public route", async () => {
    const res = await GET();
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("response body always contains status, version, timestamp, checks", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("checks");
    expect(body.checks).toHaveProperty("database");
    expect(body.checks).toHaveProperty("migrations");
    expect(body.checks).toHaveProperty("aiFactory");
    expect(body.checks).toHaveProperty("sms");
    expect(body.checks).toHaveProperty("smsMode");
  });
});
