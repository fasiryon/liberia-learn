import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// This proposal executes no SDK, provider, database or external transport.
const h = vi.hoisted(() => ({
  send: vi.fn(), audit: vi.fn(), operationalUpdate: vi.fn(),
  audioFind: vi.fn(), audioUpsert: vi.fn(), certFind: vi.fn(), certUpdate: vi.fn(),
  createRun: vi.fn(), actor: vi.fn(),
}));
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class { send = h.send; }, SendMessageCommand: class { constructor(readonly input: unknown) {} },
}));
vi.mock("@/lib/db", () => ({ prisma: {
  lessonAudio: { findUnique: h.audioFind, upsert: h.audioUpsert },
  examCertification: { findUnique: h.certFind, update: h.certUpdate },
} }));
vi.mock("@/lib/audit", () => ({ logAudit: h.audit }));
vi.mock("@/lib/ai/interactionLog", () => ({ logAIInteraction: vi.fn() }));
vi.mock("@/lib/supabaseStorage", () => ({ uploadBinaryToSupabase: vi.fn() }));
vi.mock("@/lib/audio/lessonAudioProvider", () => ({ createOpenAiLessonAudioProvider: vi.fn() }));
vi.mock("@/lib/serverFlags", () => ({ isCanvaCourseThumbnailsEnabled: () => true, isCertificationAssetGenerationEnabled: () => true }));
vi.mock("@/lib/curriculum/mutations/repository", () => ({ updateCurriculumOperationalFields: h.operationalUpdate }));
vi.mock("@/lib/moe/authority", () => ({ requireMoeActor: h.actor }));
vi.mock("@/lib/autonomous/workflowStateManager", () => ({ createWorkflowRun: h.createRun }));

import { queueLessonAudioGeneration } from "@/lib/lessons/audioGeneration";
import { enqueueCourseThumbnailGeneration } from "@/lib/courses/courseThumbnailQueue";
import { startWorkflow } from "@/lib/autonomous/workflowOrchestrator";
import { POST as requestCertificationAssets } from "@/app/api/certifications/generate-assets/route";

describe("AWS unavailable: rejected enqueue must not be acknowledged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden in AWS inventory tests"); }));
    vi.stubEnv("SQS_QUEUE_URL", "https://synthetic.invalid/queue.fifo");
    h.send.mockRejectedValue(Error("Synthetic AWS unavailable"));
    h.audit.mockResolvedValue(undefined);
    h.audioFind.mockResolvedValue(null);
    h.audioUpsert.mockResolvedValue({ id: "synthetic-audio", status: "PENDING" });
    h.certFind.mockResolvedValue({ id: "synthetic-cert", exam: { schoolId: "synthetic-school" } });
    h.certUpdate.mockResolvedValue({});
    h.actor.mockResolvedValue({ user: { id: "synthetic-moe" } });
    h.createRun.mockResolvedValue({ created: true, workflowRun: { id: "synthetic-run", workflowType: "synthetic", partitionKey: "synthetic-school" } });
  });
  afterAll(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("audio control: retains a durable pending row, not a generated asset, after failed dispatch", async () => {
    await expect(queueLessonAudioGeneration({ lessonId: "synthetic-lesson", contentVersion: "v1", text: "Synthetic text" })).resolves.toMatchObject({ status: "PENDING" });
    expect(h.audioUpsert).toHaveBeenCalledOnce(); expect(h.send).toHaveBeenCalledOnce();
  });

  it("thumbnail generation refuses instead of recording an enqueued audit", async () => {
    await expect(enqueueCourseThumbnailGeneration({ contentId: "synthetic-lesson", actorUserId: "synthetic-admin" })).rejects.toMatchObject({ status: 503 });
    expect(h.audit).not.toHaveBeenCalledWith(expect.objectContaining({ action: "course.thumbnail.enqueued" }));
  });

  it("workflow start exposes unavailable dispatch instead of returning a created queued run", async () => {
    await expect(startWorkflow({ workflowType: "synthetic", schoolId: "synthetic-school", enqueue: true })).rejects.toMatchObject({ status: 503 });
  });

  it("control: confirmed synthetic dispatch preserves existing success paths", async () => {
    h.send.mockResolvedValue({});
    await expect(queueLessonAudioGeneration({ lessonId: "synthetic-lesson", contentVersion: "v1", text: "Synthetic text" })).resolves.toMatchObject({ status: "PENDING" });
    await expect(enqueueCourseThumbnailGeneration({ contentId: "synthetic-lesson", actorUserId: "synthetic-admin" })).resolves.toBeUndefined();
    await expect(startWorkflow({ workflowType: "synthetic", schoolId: "synthetic-school", enqueue: true })).resolves.toMatchObject({ created: true });
    const response = await requestCertificationAssets(new Request("http://local/api/certifications/generate-assets", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ certificationId: "synthetic-cert" }),
    }));
    expect(response.status).toBe(200); expect(h.send).toHaveBeenCalledTimes(4);
  });

  it("certification asset route refuses instead of acknowledging pending dispatch", async () => {
    const response = await requestCertificationAssets(new Request("http://local/api/certifications/generate-assets", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ certificationId: "synthetic-cert" }),
    }));
    expect(response.status).toBe(503);
    expect(h.audit).not.toHaveBeenCalledWith(expect.objectContaining({ action: "certification.assets.enqueued" }));
  });
});
