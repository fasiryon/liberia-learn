import { beforeEach, describe, expect, it, vi } from "vitest";
type Actor = { id: string; role: string; schoolId: string; isPlatformAdmin: boolean };
const m = vi.hoisted(() => ({ actor: null as Actor | null, effects: [] as string[], calls: {
  enqueueAudio: vi.fn(), claimAudio: vi.fn(), processAudio: vi.fn(), retryAudio: vi.fn(), statusAudio: vi.fn(),
  enqueueTextbook: vi.fn(), claimTextbook: vi.fn(), processTextbook: vi.fn(), retryTextbook: vi.fn(), statusTextbook: vi.fn(),
  cron: vi.fn(), auto: vi.fn(), cost: vi.fn(), flag: vi.fn(), count: vi.fn(), group: vi.fn(), list: vi.fn(), one: vi.fn(),
  media: vi.fn(), sign: vi.fn(), upload: vi.fn(), path: vi.fn(), category: vi.fn(), telemetry: vi.fn(), revision: vi.fn(),
  queueAudio: vi.fn(), pendingAudio: vi.fn(),
} }));
vi.mock("@/lib/auth", () => ({ requireRole: async (role: string) => {
  if (!m.actor) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (m.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
} }));
vi.mock("@/lib/db", () => ({ prisma: { curriculumContent: { count: m.calls.count, groupBy: m.calls.group,
  findMany: m.calls.list, findUnique: m.calls.one } } }));
vi.mock("@/lib/audio/audioGenerationQueue", () => ({ enqueueLessonAudio: m.calls.enqueueAudio, claimNextAudioJobs: m.calls.claimAudio,
  processAudioJob: m.calls.processAudio, retryFailedJobs: m.calls.retryAudio, getAudioQueueStatus: m.calls.statusAudio }));
vi.mock("@/lib/textbooks/textbookGenerationQueue", () => ({ enqueueTextbook: m.calls.enqueueTextbook, claimNextTextbookJobs: m.calls.claimTextbook,
  processTextbookJob: m.calls.processTextbook, retryFailed: m.calls.retryTextbook, getTextbookQueueStatus: m.calls.statusTextbook }));
vi.mock("@/lib/automation/cronRunLog", () => ({ getCronRunSummary: m.calls.cron, isAutoModeEnabled: m.calls.auto }));
vi.mock("@/lib/curriculum/pipelineCostSummary", () => ({ getPipelineCostSummary: m.calls.cost }));
vi.mock("@/lib/serverFlags", () => ({ isCostDashboardEnabled: m.calls.flag }));
vi.mock("@/lib/media/processLesson", () => ({ processLessonMedia: m.calls.media }));
vi.mock("@/lib/media/blobStorage", () => ({ signMediaUrl: m.calls.sign, uploadLessonImage: m.calls.upload, lessonMediaPath: m.calls.path }));
vi.mock("@/lib/media/categorize", () => ({ categorizeLesson: m.calls.category }));
vi.mock("@/lib/assets/generationTelemetry", () => ({ logAssetGenerationTelemetry: m.calls.telemetry }));
vi.mock("@/lib/curriculum/mutations/repository", () => ({ updateCurriculumContent: m.calls.revision }));
vi.mock("@/lib/lessons/audioGeneration", () => ({ queueLessonAudioGeneration: m.calls.queueAudio, processPendingLessonAudio: m.calls.pendingAudio }));

import { POST as audioEnqueue } from "@/app/api/admin/audio-generation/enqueue/route";
import { POST as audioProcess } from "@/app/api/admin/audio-generation/process/route";
import { POST as audioRetry } from "@/app/api/admin/audio-generation/retry/route";
import { GET as audioStatus } from "@/app/api/admin/audio-generation/status/route";
import { POST as textbookEnqueue } from "@/app/api/admin/textbook-generation/enqueue/route";
import { POST as textbookProcess } from "@/app/api/admin/textbook-generation/process/route";
import { POST as textbookRetry } from "@/app/api/admin/textbook-generation/retry/route";
import { GET as textbookStatus } from "@/app/api/admin/textbook-generation/status/route";
import { GET as cost } from "@/app/api/admin/cost-dashboard/route";
import { GET as mediaList } from "@/app/api/admin/content-media/route";
import { POST as mediaRegenerate } from "@/app/api/admin/content-media/[contentId]/regenerate/route";
import { POST as mediaUpload } from "@/app/api/admin/content-media/[contentId]/upload/route";
import { POST as mediaBulk } from "@/app/api/admin/content-media/bulk-regenerate/route";
import { POST as curriculumAudioBatch } from "@/app/api/admin/curriculum/audio/batch/route";
import { POST as curriculumAudioProcess } from "@/app/api/admin/curriculum/audio/process/route";

const platform = (): Actor => ({ id: "platform-admin", role: "ADMIN", schoolId: "school-A", isPlatformAdmin: true });
const request = (method = "POST") => new Request("http://localhost/api/admin/synthetic?grade=4&subject=MATH", {
  method, ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grade: 4, subject: "MATH", limit: 1 }) } : {}),
});
const context = () => ({ params: Promise.resolve({ contentId: "synthetic-content" }) });
const uploadRequest = () => {
  const form = new FormData(); form.set("file", new File(["synthetic-image"], "hero.png", { type: "image/png" }));
  return new Request("http://localhost/api/admin/content-media/synthetic-content/upload", { method: "POST", body: form });
};
const routes = [
  { name: "audio.enqueue", call: () => audioEnqueue(request()), effect: "enqueueAudio" },
  { name: "audio.process", call: () => audioProcess(request()), effect: "processAudio" },
  { name: "audio.retry", call: () => audioRetry(request()), effect: "retryAudio" },
  { name: "audio.status", call: () => audioStatus(request("GET")), effect: "statusAudio" },
  { name: "textbook.enqueue", call: () => textbookEnqueue(request()), effect: "enqueueTextbook" },
  { name: "textbook.process", call: () => textbookProcess(request()), effect: "processTextbook" },
  { name: "textbook.retry", call: () => textbookRetry(request()), effect: "retryTextbook" },
  { name: "textbook.status", call: () => textbookStatus(request("GET")), effect: "statusTextbook" },
  { name: "cost-dashboard", call: () => cost(), effect: "cost" },
  { name: "content-media.list", call: () => mediaList(request("GET")), effect: "list" },
  { name: "content-media.regenerate", call: () => mediaRegenerate(request(), context()), effect: "media" },
  { name: "content-media.upload", call: () => mediaUpload(uploadRequest(), context()), effect: "upload" },
  { name: "content-media.bulk-regenerate", call: () => mediaBulk(request()), effect: "media" },
  { name: "curriculum.audio.batch", call: () => curriculumAudioBatch(request()), effect: "queueAudio" },
  { name: "curriculum.audio.process", call: () => curriculumAudioProcess(request()), effect: "pendingAudio" },
];
beforeEach(() => {
  vi.clearAllMocks(); m.actor = platform(); m.effects = [];
  const lesson = { contentId: "synthetic-content", title: "Synthetic", subject: "MATH", grade: 4, version: "1",
    payload: { body: "Synthetic instruction" }, waecSyllabusTopics: [], audioAssets: [], imageCategory: "VISUAL",
    imageGenerationStatus: "GENERATED", heroImageUrl: "https://synthetic.invalid/image", heroImageMeta: {}, inlineIllustrations: [] };
  const values: Record<string, unknown> = {
    enqueueAudio: { queued: 1 }, claimAudio: [{ id: "synthetic-audio-job" }], processAudio: { status: "GENERATED" }, retryAudio: { queued: 1 }, statusAudio: { queued: 1 },
    enqueueTextbook: { queued: 1 }, claimTextbook: [{ id: "synthetic-textbook-job" }], processTextbook: { status: "GENERATED" }, retryTextbook: { queued: 1 }, statusTextbook: { queued: 1 },
    cron: {}, auto: false, cost: { total: 0 }, flag: true, count: 1, group: [{ imageGenerationStatus: "GENERATED", _count: 1 }], list: [lesson], one: lesson,
    media: { status: "GENERATED", update: { heroImageUrl: "https://synthetic.invalid/image" }, category: "VISUAL", provider: "synthetic", cost: 0, inlineCount: 0 },
    sign: "https://synthetic.invalid/signed", upload: "https://synthetic.invalid/image", path: "synthetic/hero.png", category: "VISUAL",
    telemetry: undefined, revision: lesson, queueAudio: {}, pendingAudio: [{ status: "GENERATED" }],
  };
  for (const [name, fn] of Object.entries(m.calls)) fn.mockImplementation(() => { m.effects.push(name); return values[name]; });
});
describe("SEC-11 global content operations", () => {
  for (const route of routes) {
    it.each(["school-A", "school-B"])(`${route.name} refuses school ADMIN in %s before domain work`, async schoolId => {
      m.actor = { ...platform(), schoolId, isPlatformAdmin: false };
      const response = await route.call().catch(() => new Response("uncaught authorization", { status: 500 }));
      expect(response.status).toBe(403); expect(m.effects).toEqual([]);
    });
    it.each(["STUDENT", "TEACHER", "GUARDIAN"])(`${route.name} preserves %s denial`, async role => {
      m.actor = { ...platform(), role, isPlatformAdmin: false };
      const response = await route.call().catch(() => new Response("uncaught authorization", { status: 500 }));
      expect(response.status).toBe(403); expect(m.effects).toEqual([]);
    });
    it(`${route.name} does not widen another role with a platform flag`, async () => {
      m.actor = { ...platform(), role: "TEACHER" };
      const response = await route.call().catch(() => new Response("uncaught authorization", { status: 500 }));
      expect(response.status).toBe(403); expect(m.effects).toEqual([]);
    });
    it(`${route.name} preserves anonymous refusal`, async () => {
      m.actor = null; const response = await route.call().catch(() => new Response("uncaught authorization", { status: 500 }));
      expect(response.status).toBe(401); expect(m.effects).toEqual([]);
    });
    it(`${route.name} retains the explicit platform ADMIN path`, async () => {
      const response = await route.call(); expect(response.status).toBe(200); expect(m.effects).toContain(route.effect);
      if (route.name.includes("content-media") && route.name !== "content-media.list") {
        expect(m.calls.revision).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ actorUserId: "platform-admin", auditAction: expect.stringMatching(/^curriculum\.revision\.media_/) }));
      }
    });
  }
});
