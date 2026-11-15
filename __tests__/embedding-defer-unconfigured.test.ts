// Atlas R3 P2-1: DEFER must also hold when the queue is NOT CONFIGURED (missing/blank SQS_QUEUE_URL).
// isQueueConfigured() only means the URL is absent; nothing confines the old inline paid path to
// development, so a deployed runtime without the URL must defer too (founder DEFER 2026-11-13).
// Executes the actual route branches extracted from source, as in aws-unavailable-embedding-branches.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-sqs", () => ({ SQSClient: class { send = h.send; }, SendMessageCommand: class { constructor(readonly input: unknown) {} } }));
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";

function extract(path: string, pick: (node: ts.IfStatement, src: ts.SourceFile) => boolean) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  let found: ts.IfStatement | undefined;
  const visit = (node: ts.Node) => { if (!found && ts.isIfStatement(node) && pick(node, source)) found = node; ts.forEachChild(node, visit); };
  visit(source);
  if (!found) throw Error(`Missing branch in ${path}`);
  return ts.transpileModule(`(async function () { ${found.getText(source)} })`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}
const queueBranch = (path: string) => extract(path, (n, s) => ["isQueueConfigured()", "queueConfigured"].includes(n.expression.getText(s)) && n.thenStatement.getText(s).includes("JobType.GENERATE_EMBEDDINGS"));
const publishedBranch = (path: string) => extract(path, (n, s) => n.expression.getText(s) === 'status === "published"');

function context(extra: Record<string, unknown> = {}) {
  return {
    enqueueJob, isQueueConfigured, JobType, queueConfigured: false, status: "draft",
    record: { id: "synthetic-row", contentId: "synthetic-content" }, recordId: "synthetic-row", contentId: "synthetic-content",
    user: { id: "synthetic-actor", schoolId: "synthetic-school" }, actor: { userId: "synthetic-actor", schoolId: "synthetic-school" },
    logger: { warn: vi.fn() },
    embedLesson: vi.fn(async () => undefined),
    syncCurriculumContentRagChunks: vi.fn(async () => undefined),
    deleteCurriculumContentRagChunks: vi.fn(async () => 0),
    deferLessonEmbedding: vi.fn(async () => undefined),
    ...extra,
  };
}

describe("DEFER when the queue is not configured (Atlas R3 P2-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("SQS_QUEUE_URL", "");
    vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
  });
  afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it.each([
    "app/api/admin/curriculum/approve/route.ts", "app/api/admin/curriculum/generate/route.ts",
    "app/api/admin/curriculum/generate-full-pack/route.ts", "app/api/teacher/lessons/route.ts",
  ])("%s defers with QUEUE_NOT_CONFIGURED and makes no inline embedding or chunk-sync call", async path => {
    const ctx = context();
    await runInNewContext(queueBranch(path), ctx)();
    expect(h.send).not.toHaveBeenCalled();
    expect(ctx.embedLesson).not.toHaveBeenCalled();
    expect(ctx.syncCurriculumContentRagChunks).not.toHaveBeenCalled();
    expect(ctx.deferLessonEmbedding).toHaveBeenCalledOnce();
    expect(ctx.deferLessonEmbedding).toHaveBeenCalledWith(expect.objectContaining({
      lessonId: "synthetic-row", contentId: "synthetic-content", reason: "QUEUE_NOT_CONFIGURED",
    }));
  });

  it("teacher published lesson with no queue does not sync (embed) retrieval chunks inline", async () => {
    const ctx = context({ status: "published" });
    await runInNewContext(publishedBranch("app/api/teacher/lessons/route.ts"), ctx)();
    expect(ctx.syncCurriculumContentRagChunks).not.toHaveBeenCalled();
    expect(ctx.embedLesson).not.toHaveBeenCalled();
  });

  it("blank SQS_QUEUE_URL counts as not configured (no send attempted)", () => {
    vi.stubEnv("SQS_QUEUE_URL", "   ");
    expect(isQueueConfigured()).toBe(false);
  });
});
