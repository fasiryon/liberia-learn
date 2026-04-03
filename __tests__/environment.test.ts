import { afterEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockRequireMoePlatformAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/moeAccess", () => ({
  requireMoePlatformAdmin: mockRequireMoePlatformAdmin,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findMany: vi.fn() },
    attendanceRecord: { deleteMany: vi.fn() },
    studentProgress: { deleteMany: vi.fn() },
    homeworkSubmission: { deleteMany: vi.fn() },
    placementTest: { deleteMany: vi.fn() },
    labSession: { deleteMany: vi.fn() },
    guardianMessage: { deleteMany: vi.fn() },
    sMSDeliveryLog: { deleteMany: vi.fn() },
    notificationLog: { deleteMany: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    scheduledWork: { deleteMany: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/scripts/seed-demo", () => ({
  SCHOOL_DEFS: [{ id: "school-cha" }],
  seedNationalDemo: vi.fn(),
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

    vi.clearAllMocks();
  });

  it("blocks demo reset in staging", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    });

    const response = await demoResetPost(new Request("http://localhost/api/demo/reset", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Not available in this environment" });
    expect(mockRequireUser).not.toHaveBeenCalled();
  });

  it("blocks platform demo reset in production", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });

    const response = await platformDemoResetPost();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Not available in this environment" });
    expect(mockRequireMoePlatformAdmin).not.toHaveBeenCalled();
  });
});
