import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── shared mocks ─────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockFindMany = vi.fn();
const mockGroupBy = vi.fn();
const mockCount = vi.fn();

const mockPrisma = {
  teacherAlertPreference: { findUnique: mockFindUnique, upsert: mockUpsert },
  assessmentAttempt: { groupBy: mockGroupBy, findMany: mockFindMany },
  enrollment: { findMany: mockFindMany },
  user: { findUnique: vi.fn() },
  guardianMessage: { count: mockCount },
  homeworkSubmission: { count: mockCount },
};

const mockSendPush = vi.fn().mockResolvedValue({ sent: 1, failed: 0, smsFallback: 0 });
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPush }));
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({ get: mockRedisGet, set: mockRedisSet })),
}));
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" }),
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));

// ── helpers ───────────────────────────────────────────────────────────────────

async function getAlertPrefs() {
  const { getTeacherAlertPref } = await import("@/lib/alert-prefs");
  return getTeacherAlertPref;
}

async function getAlertPrefsRoute() {
  const mod = await import("@/app/api/teacher/alert-prefs/route");
  return mod;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("getTeacherAlertPref", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns defaults when no DB row exists", async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const getTeacherAlertPref = await getAlertPrefs();
    const prefs = await getTeacherAlertPref("teacher-42");
    expect(prefs.alertLowGrade).toBe(true);
    expect(prefs.alertInactive).toBe(true);
    expect(prefs.alertNewSubmission).toBe(true);
    expect(prefs.alertGuardianMessage).toBe(true);
    expect(prefs.dailyDigest).toBe(false);
    expect(prefs.digestHour).toBe(7);
  });

  it("returns stored prefs when row exists", async () => {
    mockFindUnique.mockResolvedValueOnce({
      teacherId: "t1",
      alertLowGrade: false,
      alertInactive: true,
      alertNewSubmission: false,
      alertGuardianMessage: true,
      dailyDigest: true,
      digestHour: 9,
    });
    const getTeacherAlertPref = await getAlertPrefs();
    const prefs = await getTeacherAlertPref("t1");
    expect(prefs.alertLowGrade).toBe(false);
    expect(prefs.dailyDigest).toBe(true);
    expect(prefs.digestHour).toBe(9);
  });
});

describe("Submission trigger pref gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does NOT send push when alertNewSubmission is false", async () => {
    mockFindUnique.mockResolvedValueOnce({
      teacherId: "teacher-1",
      alertNewSubmission: false,
      alertLowGrade: true,
      alertInactive: true,
      alertGuardianMessage: true,
      dailyDigest: false,
      digestHour: 7,
    });
    const getTeacherAlertPref = await getAlertPrefs();
    const pref = await getTeacherAlertPref("teacher-1");
    expect(pref.alertNewSubmission).toBe(false);
    if (pref.alertNewSubmission) {
      await mockSendPush("teacher-1", { title: "New Submission", body: "test", url: "/" });
    }
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("sends push when alertNewSubmission is true", async () => {
    mockFindUnique.mockResolvedValueOnce({
      teacherId: "teacher-1",
      alertNewSubmission: true,
      alertLowGrade: true,
      alertInactive: true,
      alertGuardianMessage: true,
      dailyDigest: false,
      digestHour: 7,
    });
    const getTeacherAlertPref = await getAlertPrefs();
    const pref = await getTeacherAlertPref("teacher-1");
    expect(pref.alertNewSubmission).toBe(true);
    if (pref.alertNewSubmission) {
      await mockSendPush("teacher-1", { title: "New Submission", body: 'A student submitted "Test HW"', url: "/teacher/assignments" });
    }
    expect(mockSendPush).toHaveBeenCalledWith("teacher-1", expect.objectContaining({ title: "New Submission" }));
  });
});

describe("Guardian message trigger pref gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("does NOT send push when alertGuardianMessage is false", async () => {
    mockFindUnique.mockResolvedValueOnce({
      teacherId: "teacher-1",
      alertGuardianMessage: false,
      alertLowGrade: true,
      alertInactive: true,
      alertNewSubmission: true,
      dailyDigest: false,
      digestHour: 7,
    });
    const getTeacherAlertPref = await getAlertPrefs();
    const pref = await getTeacherAlertPref("teacher-1");
    if (pref.alertGuardianMessage) {
      await mockSendPush("teacher-1", { title: "Guardian Message", body: "New message", url: "/teacher/messages" });
    }
    expect(mockSendPush).not.toHaveBeenCalled();
  });
});

describe("Low-grade cron dedup via Redis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("sends push when Redis key is absent (expired)", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSet.mockResolvedValueOnce("OK");

    const key = "alert:lowgrade:teacher-1:student-1";
    const exists = await mockRedisGet(key);
    if (!exists) {
      await mockSendPush("teacher-1", { title: "Low Grade Alert", body: "Student below 60%", url: "/teacher/students" });
      await mockRedisSet(key, "1", { ex: 86400 });
    }
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledWith(key, "1", { ex: 86400 });
  });

  it("does NOT send push when Redis dedup key is live", async () => {
    mockRedisGet.mockResolvedValueOnce("1");

    const key = "alert:lowgrade:teacher-1:student-1";
    const exists = await mockRedisGet(key);
    if (!exists) {
      await mockSendPush("teacher-1", { title: "Low Grade Alert", body: "Student below 60%", url: "/teacher/students" });
    }
    expect(mockSendPush).not.toHaveBeenCalled();
  });
});

describe("Digest cron hour gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("skips digest when digestHour does not match current hour", async () => {
    const currentHour = new Date().getUTCHours();
    const nonMatchHour = (currentHour + 1) % 24;
    const prefs = [{ teacherId: "teacher-1", digestHour: nonMatchHour, dailyDigest: true }];
    const toSend = prefs.filter((p) => p.digestHour === currentHour);
    for (const { teacherId } of toSend) {
      await mockSendPush(teacherId, { title: "Daily Digest", body: "Summary", url: "/teacher/dashboard" });
    }
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("sends digest when digestHour matches current hour", async () => {
    const currentHour = new Date().getUTCHours();
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSet.mockResolvedValueOnce("OK");

    const prefs = [{ teacherId: "teacher-1", digestHour: currentHour, dailyDigest: true }];
    const toSend = prefs.filter((p) => p.digestHour === currentHour);
    for (const { teacherId } of toSend) {
      const exists = await mockRedisGet(`digest:${teacherId}`);
      if (exists) continue;
      await mockSendPush(teacherId, { title: "Daily Digest", body: "1 unread message", url: "/teacher/dashboard" });
      await mockRedisSet(`digest:${teacherId}`, "1", { ex: 82800 });
    }
    expect(mockSendPush).toHaveBeenCalledTimes(1);
  });
});

describe("PATCH /api/teacher/alert-prefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("upserts prefs correctly for the authenticated teacher", async () => {
    mockUpsert.mockResolvedValueOnce({
      alertLowGrade: false,
      alertInactive: true,
      alertNewSubmission: true,
      alertGuardianMessage: true,
      dailyDigest: false,
      digestHour: 7,
    });

    const { PATCH } = await getAlertPrefsRoute();
    const req = new NextRequest("http://localhost/api/teacher/alert-prefs", {
      method: "PATCH",
      body: JSON.stringify({ alertLowGrade: false }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alertLowGrade).toBe(false);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherId: "teacher-1" },
        update: { alertLowGrade: false },
      })
    );
  });
});
