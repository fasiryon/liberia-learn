/**
 * PROD-CFG-01-CODE (founder note; CoS release 2026-10-28): DEMO_MODE must never switch off production.
 * 1. VERCEL_ENV === "production" means getEnvironment() === "production", whatever DEMO_MODE says.
 * 2. The demo routes (platform/demo/advance-day, platform/demo/simulate-activity, demo/reset, platform/demo/reset)
 *    refuse in production regardless of DEMO_MODE. ALLOW_LIVE_DEMO_RESET keeps its existing meaning for the two
 *    reset routes (an explicit production opt-in for configured demo schools only); it is not changed here.
 * 3. advance-day touches only demo-school ScheduledWork (SCHOOL_DEFS, narrowed by DEMO_SCHOOL_IDS when set).
 * Synthetic and mocks only; no environment or production change.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findMany: vi.fn(), update: vi.fn(), upsert: vi.fn(), studentFindMany: vi.fn(), transaction: vi.fn(), seed: vi.fn(),
}));
vi.mock("@/lib/moeAccess", () => ({ requireMoePlatformAdmin: async () => ({ id: "plat", role: "ADMIN", isPlatformAdmin: true }) }));
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ id: "plat", role: "ADMIN", isPlatformAdmin: true }) }));
vi.mock("@/lib/demo/reset", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // The reset itself is not under test; only whether the route lets it run.
  resetDemoSchools: async () => { m.transaction(); },
}));
vi.mock("@/scripts/seed-demo", () => ({ SCHOOL_DEFS: [{ id: "school-demo-1" }, { id: "school-demo-2" }], seedNationalDemo: m.seed }));
vi.mock("@/lib/db", () => ({ prisma: {
  scheduledWork: { findMany: m.findMany, update: m.update, deleteMany: vi.fn() },
  studentProgress: { upsert: m.upsert, deleteMany: vi.fn() },
  student: { findMany: m.studentFindMany },
  $transaction: m.transaction,
} }));

import { getEnvironment, isDemo, isProduction } from "@/lib/environment";
import { POST as advanceDay } from "@/app/api/platform/demo/advance-day/route";
import { POST as simulateActivity } from "@/app/api/platform/demo/simulate-activity/route";
import { POST as demoReset } from "@/app/api/demo/reset/route";
import { POST as platformDemoReset } from "@/app/api/platform/demo/reset/route";

const KEYS = ["NODE_ENV", "DEMO_MODE", "VERCEL_ENV", "DEMO_SCHOOL_IDS", "ALLOW_LIVE_DEMO_RESET"] as const;
const saved: Record<string, string | undefined> = {};
const setEnv = (values: Partial<Record<(typeof KEYS)[number], string | undefined>>) => {
  for (const key of KEYS) {
    const value = values[key];
    if (value === undefined) Reflect.deleteProperty(process.env, key);
    else Object.assign(process.env, { [key]: value });
  }
};
const PROD_WITH_DEMO_MODE = { NODE_ENV: "production", VERCEL_ENV: "production", DEMO_MODE: "true", DEMO_SCHOOL_IDS: "school-demo-1" };

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of KEYS) saved[key] = process.env[key];
  m.findMany.mockResolvedValue([{ id: "sw-1", scheduledDate: new Date("2026-10-28") }]);
  m.update.mockResolvedValue({}); m.studentFindMany.mockResolvedValue([]); m.transaction.mockResolvedValue([]);
});
afterEach(() => setEnv(saved));

describe("1. production is production whatever DEMO_MODE says", () => {
  it("RED: VERCEL_ENV=production with DEMO_MODE=true is production, never demo", () => {
    setEnv(PROD_WITH_DEMO_MODE);
    expect(getEnvironment()).toBe("production");
    expect(isProduction()).toBe(true);
    expect(isDemo()).toBe(false);
  });
  it("guard: DEMO_MODE=true outside a Vercel production deployment is still demo", () => {
    setEnv({ NODE_ENV: "production", DEMO_MODE: "true" });
    expect(getEnvironment()).toBe("demo");
  });
});

describe("2. the demo routes refuse in production regardless of DEMO_MODE", () => {
  it("RED: advance-day returns 403 with no read or write", async () => {
    setEnv(PROD_WITH_DEMO_MODE);
    expect((await advanceDay()).status).toBe(403);
    expect(m.findMany).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("RED: simulate-activity returns 403 with no write", async () => {
    setEnv(PROD_WITH_DEMO_MODE);
    m.findMany.mockResolvedValue([]);
    expect((await simulateActivity()).status).toBe(403);
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("RED: demo/reset and platform/demo/reset return 403 without ALLOW_LIVE_DEMO_RESET", async () => {
    setEnv(PROD_WITH_DEMO_MODE);
    expect((await demoReset(new Request("http://localhost/api/demo/reset", { method: "POST" }))).status).toBe(403);
    expect((await platformDemoReset()).status).toBe(403);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("guard (unchanged semantics, flagged): ALLOW_LIVE_DEMO_RESET=true still opts a production reset in for configured demo schools", async () => {
    setEnv({ ...PROD_WITH_DEMO_MODE, ALLOW_LIVE_DEMO_RESET: "true" });
    expect((await platformDemoReset()).status).toBe(200);
  });
});

describe("3. advance-day touches only demo-school scheduled work", () => {
  it("RED: in demo mode the read is limited to the configured demo schools", async () => {
    setEnv({ NODE_ENV: "production", DEMO_MODE: "true", DEMO_SCHOOL_IDS: "school-demo-1" });
    expect((await advanceDay()).status).toBe(200);
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { class: { schoolId: { in: ["school-demo-1"] } } } }));
  });
  it("RED: without DEMO_SCHOOL_IDS it is limited to the seeded demo schools (SCHOOL_DEFS)", async () => {
    setEnv({ NODE_ENV: "production", DEMO_MODE: "true" });
    await advanceDay();
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { class: { schoolId: { in: ["school-demo-1", "school-demo-2"] } } } }));
  });
  it("RED: an unknown DEMO_SCHOOL_IDS entry is refused (400) with no read or write", async () => {
    setEnv({ NODE_ENV: "production", DEMO_MODE: "true", DEMO_SCHOOL_IDS: "school-demo-1,real-school-9" });
    expect((await advanceDay()).status).toBe(400);
    expect(m.findMany).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
});
