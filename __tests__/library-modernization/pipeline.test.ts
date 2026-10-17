// Library Modernization Pipeline V1: exact legacy binding, immutable packages, resumability, budget and
// loop guards, and learner-safe projections. Uses a synthetic legacy lesson and the committed Grade 6
// pilot candidate re-bound to it.
import { mkdtempSync, readFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { buildLibraryAuditContext } from "@/lib/curriculum/modernization/legacyAudit";
import { DEFAULT_BUDGET, PipelineError, runModernizationPipeline, type CandidateAuthor, type ModernizationSpec } from "@/lib/curriculum/modernization/pipeline";
import { PILOT_AUTHOR } from "@/lib/curriculum/modernization/pilot";
import { splitSections } from "@/lib/curriculum/modernization/text";
import { legacyRecord, SOUND_BODY } from "./fixtures";

const PILOT = "curriculum/modernization/v1/pilot/g6-math-decimal-place-value";
const pilotCandidate = JSON.parse(readFileSync(`${PILOT}/candidate.json`, "utf8"));
const pilotAssessment = JSON.parse(readFileSync(`${PILOT}/assessment-definitions.json`, "utf8"));
const pilotSpec = JSON.parse(readFileSync(`${PILOT}/spec.json`, "utf8")) as ModernizationSpec;

const legacy = legacyRecord({ grade: 6, contentId: "fixture-g6-decimals" });
const context = buildLibraryAuditContext([legacy]);
const dispositions = splitSections(SOUND_BODY).map((section) => ({ section: section.index, heading: section.heading, disposition: "REPLACED" as const, candidateScenes: ["chart"], rationale: "fixture" }));
const spec = (overrides: Partial<ModernizationSpec> = {}): ModernizationSpec => ({
  ...pilotSpec, contentId: legacy.contentId, legacy: { revisionId: legacy.revision!.id, contentHash: legacy.revision!.contentHash }, legacyDisposition: dispositions, ...overrides,
});

const author = (input: { spec?: ModernizationSpec; candidate?: unknown; assessment?: unknown; fail?: boolean; tokens?: number; hash?: string } = {}): CandidateAuthor => ({
  identity: PILOT_AUTHOR,
  inputHash: () => input.hash ?? "fixture-author-input",
  author: () => {
    if (input.fail) throw new Error("author failed");
    return { spec: input.spec ?? spec(), candidate: input.candidate ?? pilotCandidate, assessment: (input.assessment ?? pilotAssessment) as never, costTokens: input.tokens ?? 0 };
  },
});

const dirs: string[] = [];
const outDir = () => { const dir = mkdtempSync(path.join(os.tmpdir(), "lmv1-")); dirs.push(dir); return dir; };
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

const run = (overrides: Partial<Parameters<typeof runModernizationPipeline>[0]> = {}) => runModernizationPipeline({
  contentId: legacy.contentId, legacy, auditContext: context, ledgerLive: { revisionId: legacy.revision!.id, contentHash: legacy.revision!.contentHash },
  author: author(), outDir: outDir(), at: "2026-10-16T00:00:00.000Z", pipelineRunId: "test", ...overrides,
});
const code = (fn: () => unknown) => { try { fn(); } catch (error) { return (error as PipelineError).code ?? (error as Error).message; } return "NO_ERROR"; };

describe("exact legacy revision", () => {
  it("builds a ready package bound to the legacy revision and queues it for independent review only", () => {
    const result = run();
    expect(result.status).toBe("READY_FOR_INDEPENDENT_REVIEW");
    expect(result.ledgerEvents.map((event) => event.body.type)).toEqual(["WORK_STARTED", "CANDIDATE_REGISTERED", "REVIEW_REQUESTED"]);
    const registered = result.ledgerEvents[1].body as { legacyRevisionId: string; legacyContentHash: string };
    expect(registered.legacyRevisionId).toBe(legacy.revision!.id);
    expect(registered.legacyContentHash).toBe(legacy.revision!.contentHash);
    expect(result.ledgerEvents.some((event) => ["REVIEW_RECORDED", "RELEASE_AUTHORIZED", "RELEASED"].includes(event.body.type))).toBe(false);
  });
  it("refuses an extract that is not the ledger's live revision (stale extract)", () => {
    expect(code(() => run({ ledgerLive: { revisionId: "rev-newer", contentHash: "h-newer" } }))).toBe("STALE_EXTRACT");
  });
  it("refuses a legacy revision whose hash does not recompute", () => {
    const tampered = { ...legacy, revision: { ...legacy.revision!, contentHash: "0".repeat(64) } };
    expect(code(() => run({ legacy: tampered, ledgerLive: null }))).toBe("LEGACY_HASH_MISMATCH");
  });
  it("refuses a spec written against a different legacy revision", () => {
    expect(code(() => run({ author: author({ spec: spec({ legacy: { revisionId: "rev-old", contentHash: "h-old" } }) }) }))).toBe("SPEC_STALE_LEGACY_BINDING");
  });
  it("requires a disposition for every legacy section", () => {
    const result = run({ author: author({ spec: spec({ legacyDisposition: dispositions.slice(1) }) }) });
    expect(result.status).toBe("REVISE_BEFORE_REVIEW");
    expect(result.checks.find((check) => check.id === "LEGACY-DISPOSITION-COMPLETE")!.passed).toBe(false);
    expect(result.ledgerEvents.map((event) => event.body.type)).not.toContain("REVIEW_REQUESTED");
  });
});

describe("authority and assessment safety", () => {
  it("rejects an invented MOE objective id", () => {
    const objectives = spec().objectives.map((objective, index) => index === 0 ? { ...objective, moe: { ...objective.moe, objectiveId: "moe-math-g6-invented-obj9" } } : objective);
    const result = run({ author: author({ spec: spec({ objectives }) }) });
    expect(result.checks.find((check) => check.id === "AUTHORITY-NO-INVENTED-MOE")!.passed).toBe(false);
    expect(result.status).toBe("REVISE_BEFORE_REVIEW");
  });
  it("detects a mastery key copied into learner content", () => {
    const leaked = structuredClone(pilotCandidate);
    leaked.scenes[0].content.body += " 0.06 < 0.6 < 0.606 < 0.66";
    const result = run({ author: author({ candidate: leaked }) });
    expect(result.checks.find((check) => check.id === "PROTECTED-KEYS-SEPARATE")!.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "PROJECTION-NO-REVIEWER-CONTENT")!.passed).toBe(false);
  });
  it("fails the blueprint when retention and transfer are missing", () => {
    const thin = { ...pilotAssessment, tasks: pilotAssessment.tasks.filter((task: { kind: string }) => task.kind !== "DELAYED_RETRIEVAL" && task.kind !== "TRANSFER_TASK") };
    const result = run({ author: author({ assessment: thin }) });
    expect(result.checks.find((check) => check.id === "BLUEPRINT")!.detail).toMatch(/BP-RETENTION.*BP-TRANSFER|BP-TRANSFER.*BP-RETENTION/);
  });
  it("refuses a candidate that smuggles an authority field", () => {
    expect(code(() => run({ author: author({ candidate: { ...pilotCandidate, approvalStatus: "APPROVED" } }) }))).not.toBe("NO_ERROR");
  });
});

describe("immutability, resumability and budget", () => {
  it("is idempotent: a second run reuses the package and the author stage", () => {
    const dir = outDir();
    const first = run({ outDir: dir });
    const second = run({ outDir: dir });
    expect(second.manifestHash).toBe(first.manifestHash);
    expect(second.skippedStages).toEqual(expect.arrayContaining(["AUTHOR", "PACKAGE"]));
  });
  it("refuses a changed candidate under an existing version", () => {
    const dir = outDir();
    run({ outDir: dir });
    const changed = structuredClone(pilotCandidate);
    changed.title = "Decimal place value, revised";
    expect(code(() => run({ outDir: dir, author: author({ candidate: changed, hash: "changed" }) }))).toBe("CANDIDATE_VERSION_IMMUTABLE");
  });
  it("stops at the authoring budget", () => {
    expect(code(() => run({ budget: { ...DEFAULT_BUDGET, maxAuthoringCalls: 1 }, budgetState: { authoringCalls: 1, tokens: 0 } }))).toBe("BUDGET_EXHAUSTED");
    expect(code(() => run({ budget: { ...DEFAULT_BUDGET, maxTokens: 100 }, author: author({ tokens: 500 }) }))).toBe("BUDGET_EXHAUSTED");
  });
  it("stops an author that keeps failing on the same input (no regeneration loop)", () => {
    const dir = outDir();
    const failing = author({ fail: true });
    expect(code(() => run({ outDir: dir, author: failing }))).toBe("author failed");
    expect(code(() => run({ outDir: dir, author: failing }))).toBe("author failed");
    expect(code(() => run({ outDir: dir, author: failing }))).toBe("AUTHOR_LOOP_STOPPED");
  });
  it("caps attempts per lesson across changed inputs", () => {
    const dir = outDir();
    run({ outDir: dir, author: author({ hash: "v1" }) });
    const v2 = structuredClone(pilotSpec);
    expect(code(() => run({ outDir: dir, budget: { ...DEFAULT_BUDGET, maxAttemptsPerLesson: 1 }, author: author({ hash: "v2", spec: spec({ candidateVersion: "0.2.0" }) }) }))).toBe("LESSON_ATTEMPT_CAP");
    expect(v2.candidateVersion).toBe("0.1.0");
  });
});

describe("learner projection", () => {
  it("is a draft, keeps formative feedback, and carries no reviewer-only fields", () => {
    const dir = outDir();
    const result = run({ outDir: dir });
    const projection = readFileSync(path.join(dir, "package", result.candidateVersion, "learner-projection.json"), "utf8");
    expect(JSON.parse(projection).authority.status).toBe("CURRICULUM_V2_DRAFT");
    for (const field of ["expectedObservation", "rubric", "fallbackRoute", "targetsMisconceptions", "key"]) expect(projection).not.toContain(`"${field}":`);
    for (const task of pilotAssessment.tasks as { timing: string; key?: string }[]) if (task.key && task.key.length >= 12 && task.timing !== "PRE_LESSON") expect(projection).not.toContain(task.key);
  });
});
