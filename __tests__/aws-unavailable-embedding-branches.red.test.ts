import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-sqs", () => ({ SQSClient: class { send = h.send; }, SendMessageCommand: class { constructor(readonly input: unknown) {} } }));
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";

// Execute the actual queue/fallback branch from each pinned route. This isolates
// the outage decision without running content generation or academic writers.
// It is branch evidence, not whole-route or SQL evidence.
function embeddingBranch(path: string) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  let branch: ts.IfStatement | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node) && ["isQueueConfigured()", "queueConfigured"].includes(node.expression.getText(source)) && node.thenStatement.getText(source).includes("JobType.GENERATE_EMBEDDINGS")) branch = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!branch) throw Error(`Missing production embedding branch ${path}`);
  return ts.transpileModule(`(async function () { ${branch.getText(source)} })`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}
describe("AWS unavailable: existing embedding failure fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("SQS_QUEUE_URL", "https://synthetic.invalid/queue.fifo");
    vi.stubGlobal("fetch", vi.fn(() => { throw Error("External requests forbidden"); }));
    h.send.mockRejectedValue(Error("Synthetic AWS unavailable"));
  });
  afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it.each([
    "app/api/admin/curriculum/approve/route.ts", "app/api/admin/curriculum/generate/route.ts",
    "app/api/admin/curriculum/generate-full-pack/route.ts", "app/api/teacher/lessons/route.ts",
  ])("%s must handle rejected SDK delivery like its existing failure branch", async path => {
    const embedLesson = vi.fn(async () => undefined);
    const run = runInNewContext(embeddingBranch(path), {
      enqueueJob, isQueueConfigured, JobType, queueConfigured: true,
      record: { id: "synthetic-row", contentId: "synthetic-content" }, recordId: "synthetic-row", contentId: "synthetic-content",
      logger: { warn: vi.fn() }, embedLesson, syncCurriculumContentRagChunks: vi.fn(async () => undefined),
    });
    await run(); expect(h.send).toHaveBeenCalledOnce();
    // The existing fallback is synthetic here. A reviewed fix may instead
    // expose durable deferral; it must not silently discard the rejected job.
    expect(embedLesson).toHaveBeenCalledOnce();
  });
});
