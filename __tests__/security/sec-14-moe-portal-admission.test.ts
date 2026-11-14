import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ enabled: true, actor: null as any, requireError: null as any, authReads: 0,
  reads: [] as string[], writes: [] as string[], services: [] as string[], audits: [] as any[], queries: [] as any[] }));
vi.mock("@/lib/auth", () => ({ authOptions: {}, requireUser: async () => {
  m.authReads++; if (m.requireError) throw m.requireError;
  if (!m.actor) throw Object.assign(new Error("Unauthorized"), { status: 401 }); return m.actor;
}, requireRole: async (...roles: string[]) => { m.authReads++;
  if (!m.actor) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
} }));
vi.mock("next-auth", () => ({ getServerSession: async () => { m.authReads++; return m.actor ? { user: m.actor } : null; } }));
vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: () => m.enabled, isP2bReviewOperationsEnabled: () => false,
  isMoeGovernanceWorkflowEnabled: () => true, isMoePolicyPushEnabled: () => true, isCurriculumVersionStandardizationEnabled: () => false }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: () => null } }));
vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get: (_target, model) => new Proxy({}, { get: (_model, operation) => async (args: any) => {
  const label = String(model) + "." + String(operation); m.queries.push({ label, args });
  if (["create", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(String(operation))) {
    m.writes.push(label); return { id: "synthetic-version", ...args.data };
  }
  m.reads.push(label);
  if (model === "school" && operation === "findUnique") return { id: "school-A", districtId: "district-A", District: { id: "district-A", name: "Synthetic district" } };
  if (model === "school" && operation === "findMany") return [{ id: "school-A", name: "Synthetic A" }];
  if (operation === "count") return 0;
  return [];
} }) }) }));
vi.mock("@/lib/audit", () => ({ logAudit: async (entry: any) => { m.audits.push(entry); } }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: async (_key: string, _ttl: number, fn: () => unknown) => { m.services.push("cache"); return fn(); } }));
vi.mock("@/lib/moe/alignment-engine", () => ({ alignContentToMOE: async () => { m.services.push("align"); return {}; }, alignAllContent: async () => { m.services.push("align-all"); } }));
vi.mock("@/lib/moe/alignmentReader", () => ({ hasGenuineMoeAlignment: () => true }));
vi.mock("@/lib/moe/liveDashboard", () => ({ getLiveDashboardData: async () => { m.services.push("live"); return { synthetic: true }; } }));
vi.mock("@/lib/waec/aggregate", () => ({ getNationalWaecReadiness: async () => { m.services.push("waec"); return { synthetic: true }; } }));
vi.mock("@/lib/curriculum/provenance/reader", () => ({ getCurriculumProvenanceExplanation: async () => { m.services.push("provenance"); return { contentId: "synthetic-content", history: [] }; } }));
vi.mock("@/lib/moe/policyGovernance", () => ({ listMoeDirectives: async () => { m.services.push("directives-read"); return []; },
  transitionMoeDirective: async () => { m.services.push("transition"); return {}; }, createMoeDirective: async () => { m.services.push("create-directive"); return {}; }, buildCurriculumVersionDriftSummary: async () => null }));
vi.mock("@/lib/policy/policyEngine", () => ({ validateCurriculumApproval: async () => { m.services.push("approval"); } }));
vi.mock("@/lib/curriculum/mutations/repository", () => ({ updateCurriculumReleaseProjectionMany: async () => { m.services.push("publication"); } }));
vi.mock("@/lib/curriculum/review/legacyAdapter", () => ({ assertMoeReleaseReady: async () => { m.services.push("release"); return []; } }));

import { GET as alignGet, POST as alignPost } from "@/app/api/moe/align/route";
import { POST as publish } from "@/app/api/moe/curriculum/publish/route";
import { GET as versionGet, POST as versionPost } from "@/app/api/moe/curriculum/version/route";
import { GET as provenance } from "@/app/api/moe/curriculum/[contentId]/provenance/route";
import { GET as live } from "@/app/api/moe/live/route";
import { GET as overrideGet, POST as overridePost } from "@/app/api/moe/override/route";
import { GET as policiesGet, POST as policiesPost } from "@/app/api/moe/policies/route";
import { PATCH as directive } from "@/app/api/moe/policies/[directiveId]/route";
import { GET as lessons } from "@/app/api/moe/teacher-lessons/route";
import { GET as waec } from "@/app/api/moe/waec-readiness/route";
const actor = (role = "MOE_SUPER_ADMIN", platform = false) => ({ id: "synthetic-" + role, role, schoolId: "school-A", isPlatformAdmin: platform,
  authProvider: "auth0", mfaVerifiedAt: Date.now() - 1000, assuranceExpiresAt: Date.now() + 600000 });
const req = (method = "POST", body = {}) => new NextRequest("http://localhost/api/moe/synthetic", { method,
  ...(["POST", "PATCH"].includes(method) ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
const routes = [
  { name: "align.GET", mutate: false, call: () => alignGet(req("GET")) },
  { name: "align.POST", mutate: true, call: () => alignPost(req()) },
  { name: "publish.POST", mutate: true, call: () => publish(req()) },
  { name: "version.GET", mutate: false, call: () => versionGet() },
  { name: "version.POST", mutate: true, call: () => versionPost(req()) },
  { name: "provenance.GET", mutate: false, call: () => provenance(req("GET"), { params: { contentId: "synthetic-content" } }) },
  { name: "live.GET", mutate: false, call: () => live(req("GET")) },
  { name: "override.GET", mutate: false, call: () => overrideGet() },
  { name: "override.POST", mutate: true, call: () => overridePost(req()) },
  { name: "policies.GET", mutate: false, call: () => policiesGet() },
  { name: "policies.POST", mutate: true, call: () => policiesPost(req()) },
  { name: "directive.PATCH", mutate: true, call: () => directive(req("PATCH"), { params: { directiveId: "synthetic-directive" } }) },
  { name: "teacher-lessons.GET", mutate: false, call: () => lessons(req("GET")) },
  { name: "waec.GET", mutate: false, call: () => waec() },
];
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("PRIVILEGED_MFA_ENFORCEMENT_ENABLED", "true"); m.enabled = true; m.actor = actor(); m.requireError = null;
  m.authReads = 0; m.reads = []; m.writes = []; m.services = []; m.audits = []; m.queries = []; });
afterEach(() => vi.unstubAllEnvs());
for (const route of routes) describe(route.name, () => {
  it.each(["MOE_SUPER_ADMIN", "PLATFORM", "TEACHER", "ANONYMOUS"])("portal off refuses %s before auth or domain work", async role => {
    m.enabled = false; m.actor = role === "ANONYMOUS" ? null : actor(role === "PLATFORM" ? "ADMIN" : role, role === "PLATFORM");
    expect((await route.call()).status).toBe(404); expect(m.authReads).toBe(0); expect(m.reads).toEqual([]); expect(m.writes).toEqual([]); expect(m.services).toEqual([]); expect(m.audits).toEqual([]);
  });
  it.each(["STUDENT", "GUARDIAN", "TEACHER", "ADMIN"])("portal on still denies ordinary %s", async role => {
    m.actor = actor(role); expect((await route.call()).status).toBe(route.name === "live.GET" ? 401 : 403);
    expect(m.writes).toEqual([]); expect(m.reads).toEqual([]); expect(m.services).toEqual([]);
  });
  it("portal on refuses anonymous access", async () => { m.actor = null; expect((await route.call()).status).toBe(401); expect(m.reads).toEqual([]); expect(m.writes).toEqual([]); expect(m.services).toEqual([]); });
  it("portal on retains legitimate MOE behavior and input contracts", async () => {
    expect((await route.call()).status).toBe(route.mutate ? 400 : 200); expect(m.authReads).toBeGreaterThan(0);
  });
  if (route.mutate) it("district authority cannot become national write authority", async () => {
    m.actor = actor("MOE_DISTRICT_ADMIN"); expect((await route.call()).status).toBe(403); expect(m.writes).toEqual([]); expect(m.services).toEqual([]); expect(m.audits).toEqual([]);
  });
});
it.each(["override", "policies"])("retains canonical district scope on %s reads", async which => {
  m.actor = actor("MOE_DISTRICT_ADMIN"); const response = await (which === "override" ? overrideGet() : policiesGet()); expect(response.status).toBe(200);
  const data = await response.json(); expect(data.scope).toMatchObject({ level: "district", districtId: "district-A", schoolIds: ["school-A"] });
  const query = m.queries.find(q => q.label === (which === "override" ? "policyOverride.findMany" : "policyConfig.findMany"));
  expect(JSON.stringify(query.args.where)).toContain("district-A"); expect(JSON.stringify(query.args.where)).not.toContain("school-B");
});
it("legitimate version creation preserves actor and durable audit request", async () => {
  expect((await versionPost(req("POST", { versionName: "Synthetic curriculum" }))).status).toBe(201);
  expect(m.writes).toEqual(["curriculumVersion.create"]); expect(m.audits[0]).toMatchObject({ userId: m.actor.id, action: "moe.curriculum_version.created" });
});
it("live refuses canonical session revocation instead of falling back to a raw role session", async () => {
  m.requireError = Object.assign(new Error("Session revoked"), { status: 401 }); expect((await live(req("GET"))).status).toBe(401);
  expect(m.reads).toEqual([]); expect(m.services).toEqual([]);
});
