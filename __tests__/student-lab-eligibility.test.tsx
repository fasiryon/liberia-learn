import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ classes: vi.fn(), sessions: vi.fn(), labs: vi.fn(), work: vi.fn(), flag: vi.fn(), role: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/student/enrollmentReadModel", () => ({ loadStudentClasses: mocks.classes }));
vi.mock("@/lib/serverFlags", () => ({ isVirtualLabsEnabled: mocks.flag, isAiLabsEnabled: () => true }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { labSession: { findMany: mocks.sessions }, virtualLab: { findMany: mocks.labs }, scheduledWork: { findMany: mocks.work } } }));
import { loadAuthorizedPracticalSessions, practicalRuntimeAvailable, studentSessionSummary } from "@/lib/student/labEligibility";
import { fromPracticalLab, listLabExperiences, isCertifiedStudentLab, classifyLabExperience } from "@/lib/learner-experience/labExperience";
import { buildLabsTab } from "@/lib/learner-experience/labsTab";
import Detail from "@/app/student/labs/[labId]/page";
import { POST as event } from "@/app/api/student/interactive-labs/[labId]/events/route";
import { getLessonLabLinks } from "@/lib/lessons/labLinks";

const user = { id: "user", schoolId: "school" };
const session = { id: "session", labId: "practical", scheduledWorkId: "work", startedAt: new Date(), completedAt: null };
const lab = { labId: "practical", title: "Measure density", subject: "SCIENCE", estimatedMinutes: 20,
  labType: "guided_walkthrough", payload: { procedure: [{ stepNumber: 1, instruction: "Measure the volume", teacherNote: "SECRET" }], answerKey: "SECRET" } };
beforeEach(() => { vi.clearAllMocks(); mocks.role.mockResolvedValue(user); mocks.flag.mockReturnValue(true);
  mocks.classes.mockResolvedValue([{ classId: "class" }]); mocks.sessions.mockResolvedValue([session]); mocks.labs.mockResolvedValue([lab]); mocks.work.mockResolvedValue([{ id: "work" }]); });

describe("student lab discovery and route parity", () => {
  it("legacy lesson links do not recommend uncertified labs from grade/subject", () => {
    for (const subject of ["SCIENCE", "Physics", "Chemistry", "Biology", "Earth Science", "ENGINEERING", "COMPUTER_SCIENCE"]) {
      for (let grade = 1; grade <= 12; grade++) expect(getLessonLabLinks({ subject, grade })).toEqual([]);
    }
  });
  it("classifies the entire static inventory as uncertified/unreleased, with no fake recommendations", () => {
    const labs = listLabExperiences();
    expect(labs).toHaveLength(16); expect(labs.filter(isCertifiedStudentLab)).toEqual([]);
    expect(labs.filter((lab) => classifyLabExperience(lab) === "LEGACY_UNCERTIFIED")).toHaveLength(12);
    expect(labs.filter((lab) => classifyLabExperience(lab) === "UNRELEASED")).toHaveLength(4);
    expect(classifyLabExperience(fromPracticalLab(lab))).toBe("ASSIGNED_ONLY");
    const model = buildLabsTab({ labs, sessions: [], pathLinks: [], grade: null });
    expect(model.library).toEqual([]); expect(model.forYou).toEqual([]);
  });
  it.each(listLabExperiences().map((l) => l.labId))("never advertises or opens uncertified static lab %s", async (labId) => {
    mocks.sessions.mockResolvedValue([]); mocks.labs.mockResolvedValue([]); mocks.work.mockResolvedValue([]);
    const html = renderToStaticMarkup(await Detail({ params: { labId } }));
    expect(html).not.toContain("Begin Lab"); expect(html).not.toContain("Start exploring");
  });
  it("every visible assigned/continue/completed entry opens the real guided host", async () => {
    mocks.sessions.mockResolvedValue([session, { ...session, id: "complete", completedAt: new Date() }]);
    const authorized = await loadAuthorizedPracticalSessions(user);
    const model = buildLabsTab({ labs: authorized.map(({ lab }) => fromPracticalLab(lab)),
      sessions: authorized.map(({ session: s }) => ({ sessionId: s.id, labId: s.labId, assigned: true,
        startedAt: s.startedAt.toISOString(), completedAt: s.completedAt?.toISOString() ?? null })), pathLinks: [], grade: 8 });
    expect(model.assigned).toHaveLength(2); expect(model.continue).toHaveLength(1); expect(model.completed).toHaveLength(1);
    for (const entry of [...model.assigned, ...model.continue, ...model.completed]) {
      const html = renderToStaticMarkup(await Detail({ params: { labId: entry.lab.labId }, searchParams: { session: entry.session!.sessionId } }));
      expect(html).toContain("Measure density"); expect(html).toContain(entry.session?.completedAt ? "Lab submitted" : "Begin Lab"); expect(html).not.toContain("SECRET");
    }
  });
  it("enforces owner/school/session lookup and published own-school or platform definitions", async () => {
    await loadAuthorizedPracticalSessions(user, { sessionId: "session" });
    expect(mocks.sessions.mock.calls[0][0].where).toEqual({ studentId: "user", schoolId: "school", id: "session" });
    expect(mocks.labs.mock.calls[0][0].where).toMatchObject({ status: "published", OR: [{ schoolId: null }, { schoolId: "school" }] });
    expect(mocks.work.mock.calls[0][0].where).toMatchObject({ classId: { in: ["class"] }, class: { schoolId: "school" } });
  });
  it.each(["missing-assignment", "unenrolled", "unpublished", "wrong-owner", "runtime-disabled"])("hides %s from all sections and detail", async (reason) => {
    if (reason === "missing-assignment") mocks.work.mockResolvedValue([]);
    if (reason === "unenrolled") mocks.classes.mockResolvedValue([]);
    if (reason === "unpublished") mocks.labs.mockResolvedValue([]);
    if (reason === "wrong-owner") mocks.sessions.mockResolvedValue([]);
    if (reason === "runtime-disabled") mocks.flag.mockReturnValue(false);
    expect(await loadAuthorizedPracticalSessions(user)).toEqual([]);
    expect(renderToStaticMarkup(await Detail({ params: { labId: "practical" } }))).not.toContain("Begin Lab");
  });
  it("refuses missing school and avoids all database lookups", async () => {
    expect(await loadAuthorizedPracticalSessions({ id: "user" })).toEqual([]); expect(mocks.sessions).not.toHaveBeenCalled();
  });
  it("refuses unsupported simulation payloads, empty procedures and interactive namespace collisions", async () => {
    expect(practicalRuntimeAvailable({ ...lab, labType: "3d_environment" })).toBe(false);
    expect(practicalRuntimeAvailable({ ...lab, payload: { procedure: [] } })).toBe(false);
    mocks.sessions.mockResolvedValue([{ ...session, labId: "mount-coffee-hydropower" }]);
    mocks.labs.mockResolvedValue([{ ...lab, labId: "mount-coffee-hydropower" }]);
    expect(await loadAuthorizedPracticalSessions(user)).toEqual([]);
  });
  it("projects session response without grading or teacher fields", () => {
    const response = studentSessionSummary({ ...session, score: 99, aiAnalysis: "secret", teacherFeedback: "secret" } as typeof session);
    expect(Object.keys(response)).toEqual(["id", "labId", "startedAt", "completedAt"]);
  });
  it("a session link cannot select a foreign or unknown session", async () => {
    expect(await loadAuthorizedPracticalSessions(user, { sessionId: "foreign" })).toEqual([]);
  });
  it("student PREVIEW requests cannot bypass interactive certification", async () => {
    const response = await event(new Request("http://localhost", { method: "POST", body: JSON.stringify({ mode: "PREVIEW", sessionId: "session" }) }) as any,
      { params: { labId: "mount-coffee-hydropower" } });
    expect(response.status).toBe(404); expect(mocks.sessions).not.toHaveBeenCalled();
  });
  it.each([401, 403])("interactive events preserve auth denial %s without exposing internals", async (status) => {
    mocks.role.mockRejectedValue({ status, message: "SECRET" });
    const response = await event(new Request("http://localhost", { method: "POST" }) as any, { params: { labId: "mount-coffee-hydropower" } });
    expect(response.status).toBe(status); expect(JSON.stringify(await response.json())).not.toContain("SECRET");
    expect(mocks.sessions).not.toHaveBeenCalled();
  });
});

const staticRoutes = [
  () => import("@/app/student/labs/gravity-explorer/page"), () => import("@/app/student/labs/pendulum-lab/page"),
  () => import("@/app/student/labs/molecule-motion/page"), () => import("@/app/student/labs/human-heart/page"),
  () => import("@/app/student/labs/electric-circuit/page"), () => import("@/app/student/labs/wave-motion/page"),
  () => import("@/app/student/labs/cell-division/page"), () => import("@/app/student/labs/ecosystem-balance/page"),
  () => import("@/app/student/labs/chemical-reaction/page"), () => import("@/app/student/labs/periodic-table/page"),
  () => import("@/app/student/labs/weather-system/page"), () => import("@/app/student/labs/tectonic-plates/page"),
];
it.each(staticRoutes.map((load, index) => ({ index, load })))("static legacy route $index refuses uncertified access even with flag enabled", async ({ load }) => {
  const route = await load(); await expect(route.default()).rejects.toThrow("NOT_FOUND");
});
