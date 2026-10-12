import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, student: { findUnique: vi.fn() },
  labSession: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: auth }));
vi.mock("@/lib/student/labEligibility", () => ({ loadAuthorizedPracticalSessions: vi.fn(async () => []) }));
vi.mock("@/lib/serverFlags", () => ({ isAiLabsEnabled: () => false }));
vi.mock("@/components/interactive-labs/v2/InteractiveLabPlayer", () => ({
  InteractiveLabPlayer: ({ labId, internalPreview }: { labId: string; internalPreview?: boolean }) =>
    <div data-showcase={String(internalPreview)}>{labId}</div>,
}));

import { canAccessShowcaseLab, buildStudentLabsTab, loadShowcaseStudentAuthority } from "@/lib/student/showcaseLabs";
import { listLabExperiences, classifyLabExperience } from "@/lib/learner-experience/labExperience";
import StudentLabDetailPage from "@/app/student/labs/[labId]/page";
import StudentLabsPage from "@/app/student/labs/page";
import { POST } from "@/app/api/student/interactive-labs/[labId]/events/route";

const ids = ["g4-solid-figures", "fixture-lever", "fixture-simple-circuit", "mount-coffee-hydropower"];
const user = { id: "seeded-user", role: "STUDENT", schoolId: "cha-high-academy" };
const account = { ...user, email: process.env.E2E_DEMO_STUDENT_EMAIL ?? "student1@cha.edu.lr", loginId: "CHA-2026-0001" };
const student = { id: "seeded-student", userId: user.id, currentGrade: 9, user: account };

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue(user);
  db.user.findUnique.mockResolvedValue(account);
  db.student.findUnique.mockResolvedValue(student);
});

describe("explicit demo student showcase authority", () => {
  it.each(ids)("allows only the approved demo identity for %s", (labId) => {
    expect(canAccessShowcaseLab({ user, student, labId })).toBe(true);
    expect(canAccessShowcaseLab({ user, student: { ...student, user: { ...account, email: "another-demo@example.com" } }, labId })).toBe(false);
  });
  it.each([null, { ...user, role: "TEACHER" }, { ...user, role: "ADMIN" }, { ...user, schoolId: "foreign" }, { ...user, id: "foreign" }])("fails closed for anonymous, role and scope mismatch", (candidate) => {
    expect(canAccessShowcaseLab({ user: candidate, student, labId: ids[0] })).toBe(false);
  });
  it.each([null, { ...student, id: "" }, { ...student, userId: "foreign" }, { ...student, user: { ...account, schoolId: "foreign" } }, { ...student, user: { ...account, loginId: "wrong" } }, { ...student, user: { ...account, role: "ADMIN" } }])("rejects malformed or foreign student records", (candidate) => {
    expect(canAccessShowcaseLab({ user, student: candidate, labId: ids[0] })).toBe(false);
  });
  it("denies every legacy lab and unknown ids", () => {
    const legacy = listLabExperiences().filter((lab) => lab.runtime.kind === "LEGACY_SIMULATION");
    expect(legacy).toHaveLength(12);
    for (const labId of [...legacy.map((lab) => lab.labId), "unknown-unreleased", "fixture-other"]) {
      expect(canAccessShowcaseLab({ user, student, labId })).toBe(false);
    }
  });
  it("reloads current persisted identity and fails closed on stale school/role", async () => {
    expect(await loadShowcaseStudentAuthority(user)).toEqual(student);
    db.student.findUnique.mockResolvedValue({ ...student, user: { ...account, schoolId: "foreign" } });
    expect(await loadShowcaseStudentAuthority(user)).toBeNull();
  });
  it("requires both exact email and login authority even when the email configuration is blank", () => {
    vi.stubEnv("E2E_DEMO_STUDENT_EMAIL", "");
    try {
      expect(canAccessShowcaseLab({ user, student: { ...student, user: { ...account, email: "" } }, labId: ids[0] })).toBe(false);
    } finally { vi.unstubAllEnvs(); }
  });
  it("adds exactly four library entries without inventing releases or governed For You links", () => {
    const input = { labs: listLabExperiences(), sessions: [], pathLinks: [], grade: 9 };
    const demo = buildStudentLabsTab(input, { user, student });
    expect(demo.library.map((entry) => entry.lab.labId).sort()).toEqual([...ids].sort());
    expect(demo.forYou).toEqual([]);
    expect(demo.library.every((entry) => entry.lab.release.status === "DRAFT_UNRELEASED")).toBe(true);
    expect(buildStudentLabsTab(input, { user, student: null }).library).toEqual([]);
    expect(listLabExperiences().filter((lab) => classifyLabExperience(lab) === "CERTIFIED_RELEASED")).toEqual([]);
    expect(classifyLabExperience(listLabExperiences().find((lab) => lab.labId === ids[3])!)).toBe("UNRELEASED");
  });
});

describe("server discovery and direct routes", () => {
  it.each(["TEACHER", "ADMIN"])("does not grant a %s the student showcase bypass", async (role) => {
    auth.mockResolvedValue({ ...user, role });
    expect(renderToStaticMarkup(await StudentLabDetailPage({ params: { labId: ids[3] } }))).toContain("This lab is not available.");
    expect(db.student.findUnique).not.toHaveBeenCalled();
  });
  it("blocks anonymous requests and unknown direct URLs", async () => {
    expect(renderToStaticMarkup(await StudentLabDetailPage({ params: { labId: "unknown-unreleased" } }))).toContain("No lab session was found");
    auth.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    expect(renderToStaticMarkup(await StudentLabDetailPage({ params: { labId: ids[3] } }))).toContain("Unable to load the lab.");
  });
  it.each(ids)("opens %s with the observation-only runtime for demo, blocks normal students", async (labId) => {
    const markup = renderToStaticMarkup(await StudentLabDetailPage({ params: { labId } }));
    expect(markup).toContain('data-showcase="true"');
    expect(markup).toContain(labId);
    db.student.findUnique.mockResolvedValue(null);
    expect(renderToStaticMarkup(await StudentLabDetailPage({ params: { labId } }))).toContain("This lab is not available.");
    expect(db.labSession.create).not.toHaveBeenCalled();
  });
  it("uses the existing Library collection for demo discovery only", async () => {
    const markup = renderToStaticMarkup(await StudentLabsPage({ searchParams: { tab: "library" } }));
    for (const id of ids) expect(markup).toContain(`/student/labs/${id}`);
    expect((markup.match(/data-lab-runtime=/g) ?? [])).toHaveLength(4);
    db.student.findUnique.mockResolvedValue(null);
    const normal = renderToStaticMarkup(await StudentLabsPage({ searchParams: { tab: "library" } }));
    for (const id of ids) expect(normal).not.toContain(`/student/labs/${id}`);
  });
  it.each(ids)("rejects forged showcase completion/evidence submission for %s without database writes", async (labId) => {
    const req = new Request("http://localhost/events", { method: "POST", body: JSON.stringify({ mode: "PREVIEW", sessionId: "forged", action: { type: "check", checkId: "forged", response: { score: 100 } } }) });
    const response = await POST(req as any, { params: { labId } });
    expect(response.status).toBe(404);
    expect(db.labSession.update).not.toHaveBeenCalled();
    expect(db.labSession.create).not.toHaveBeenCalled();
    expect(db.labSession.findFirst).not.toHaveBeenCalled();
  });
});
