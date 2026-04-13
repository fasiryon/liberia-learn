import { afterEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockRequireMoePlatformAdmin = vi.hoisted(() => vi.fn());
const mockStudentFindMany = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockDeleteMany = vi.hoisted(() => vi.fn(() => ({ mocked: true })));
const mockSeedNationalDemo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/moeAccess", () => ({
  requireMoePlatformAdmin: mockRequireMoePlatformAdmin,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findMany: mockStudentFindMany },
    attendanceRecord: { deleteMany: mockDeleteMany },
    studentProgress: { deleteMany: mockDeleteMany },
    homeworkSubmission: { deleteMany: mockDeleteMany },
    placementTest: { deleteMany: mockDeleteMany },
    labSession: { deleteMany: mockDeleteMany },
    guardianMessage: { deleteMany: mockDeleteMany },
    sMSDeliveryLog: { deleteMany: mockDeleteMany },
    notificationLog: { deleteMany: mockDeleteMany },
    auditLog: { deleteMany: mockDeleteMany },
    scheduledWork: { deleteMany: mockDeleteMany, findMany: vi.fn() },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/scripts/seed-demo", () => ({
  SCHOOL_DEFS: [{ id: "school-cha" }],
  seedNationalDemo: mockSeedNationalDemo,
}));

import {
  getEnvironment,
  isDemo,
  isDevelopment,
  isProduction,
  isStaging,
} from "@/lib/environment";
import { shouldShowDemoCredentials } from "@/lib/demoCredentials";
import { POST as demoResetPost } from "@/app/api/demo/reset/route";
import { POST as platformDemoResetPost } from "@/app/api/platform/demo/reset/route";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DEMO_MODE: process.env.DEMO_MODE,
  VERCEL_ENV: process.env.VERCEL_ENV,
  DEMO_SCHOOL_IDS: process.env.DEMO_SCHOOL_IDS,
  ALLOW_LIVE_DEMO_RESET: process.env.ALLOW_LIVE_DEMO_RESET,
};

describe("environment detection", () => {
  afterEach(() => {
    if (originalEnv.NODE_ENV === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Object.assign(process.env, { NODE_ENV: originalEnv.NODE_ENV });
    }

    if (originalEnv.DEMO_MODE === undefined) {
      Reflect.deleteProperty(process.env, "DEMO_MODE");
    } else {
      Object.assign(process.env, { DEMO_MODE: originalEnv.DEMO_MODE });
    }

    if (originalEnv.VERCEL_ENV === undefined) {
      Reflect.deleteProperty(process.env, "VERCEL_ENV");
    } else {
      Object.assign(process.env, { VERCEL_ENV: originalEnv.VERCEL_ENV });
    }

    if (originalEnv.DEMO_SCHOOL_IDS === undefined) {
      Reflect.deleteProperty(process.env, "DEMO_SCHOOL_IDS");
    } else {
      Object.assign(process.env, { DEMO_SCHOOL_IDS: originalEnv.DEMO_SCHOOL_IDS });
    }

    if (originalEnv.ALLOW_LIVE_DEMO_RESET === undefined) {
      Reflect.deleteProperty(process.env, "ALLOW_LIVE_DEMO_RESET");
    } else {
      Object.assign(process.env, { ALLOW_LIVE_DEMO_RESET: originalEnv.ALLOW_LIVE_DEMO_RESET });
    }

    vi.clearAllMocks();
  });

  it("detects development first", () => {
    Object.assign(process.env, {
      NODE_ENV: "development",
      DEMO_MODE: "true",
      VERCEL_ENV: "preview",
    });

    expect(getEnvironment()).toBe("development");
    expect(isDevelopment()).toBe(true);
    expect(shouldShowDemoCredentials()).toBe(true);
  });

  it("detects demo outside development", () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      DEMO_MODE: "true",
    });
    Reflect.deleteProperty(process.env, "VERCEL_ENV");

    expect(getEnvironment()).toBe("demo");
    expect(isDemo()).toBe(true);
    expect(shouldShowDemoCredentials()).toBe(true);
  });

  it("detects staging for preview deployments", () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      DEMO_MODE: "false",
      VERCEL_ENV: "preview",
    });

    expect(getEnvironment()).toBe("staging");
    expect(isStaging()).toBe(true);
    expect(shouldShowDemoCredentials()).toBe(false);
  });

  it("defaults to production", () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      DEMO_MODE: "false",
      VERCEL_ENV: "production",
    });

    expect(getEnvironment()).toBe("production");
    expect(isProduction()).toBe(true);
    expect(shouldShowDemoCredentials()).toBe(false);
  });
});

describe("demo route guards", () => {
  afterEach(() => {
    if (originalEnv.NODE_ENV === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Object.assign(process.env, { NODE_ENV: originalEnv.NODE_ENV });
    }

    if (originalEnv.DEMO_MODE === undefined) {
      Reflect.deleteProperty(process.env, "DEMO_MODE");
    } else {
      Object.assign(process.env, { DEMO_MODE: originalEnv.DEMO_MODE });
    }

    if (originalEnv.VERCEL_ENV === undefined) {
      Reflect.deleteProperty(process.env, "VERCEL_ENV");
    } else {
      Object.assign(process.env, { VERCEL_ENV: originalEnv.VERCEL_ENV });
    }

    if (originalEnv.DEMO_SCHOOL_IDS === undefined) {
      Reflect.deleteProperty(process.env, "DEMO_SCHOOL_IDS");
    } else {
      Object.assign(process.env, { DEMO_SCHOOL_IDS: originalEnv.DEMO_SCHOOL_IDS });
    }

    if (originalEnv.ALLOW_LIVE_DEMO_RESET === undefined) {
      Reflect.deleteProperty(process.env, "ALLOW_LIVE_DEMO_RESET");
    } else {
      Object.assign(process.env, { ALLOW_LIVE_DEMO_RESET: originalEnv.ALLOW_LIVE_DEMO_RESET });
    }

    vi.clearAllMocks();
  });

  it("blocks demo reset in staging", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    });

    const response = await demoResetPost(new Request("http://localhost/api/demo/reset", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Live demo reset is not enabled in this environment" });
    expect(mockRequireUser).not.toHaveBeenCalled();
  });

  it("blocks platform demo reset in production", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });

    const response = await platformDemoResetPost();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Live demo reset is not enabled in this environment" });
    expect(mockRequireMoePlatformAdmin).not.toHaveBeenCalled();
  });

  it("runs platform demo reset in production when explicitly enabled", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      DEMO_SCHOOL_IDS: "school-cha",
      ALLOW_LIVE_DEMO_RESET: "true",
    });
    mockRequireMoePlatformAdmin.mockResolvedValue({ id: "moe-admin-1" });
    mockStudentFindMany.mockResolvedValue([]);
    mockTransaction.mockResolvedValue(undefined);
    mockSeedNationalDemo.mockResolvedValue(undefined);

    const response = await platformDemoResetPost();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockRequireMoePlatformAdmin).toHaveBeenCalledTimes(1);
    expect(mockSeedNationalDemo).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolIds: ["school-cha"],
        allowExisting: true,
        allowProduction: true,
      })
    );
    expect(payload.success).toBe(true);
  });
});
