/**
 * Loads the Grade 7 inputs for the excellence gap reports.
 *
 * Each report set lives in its own directory with a source.json that pins the exact revision:
 *   - a git commit (read with `git show`, never from a working tree), for a revision that is already
 *     committed elsewhere, such as v0.2.0 on PR #191; or
 *   - `gitCommit: null` for the revision in this tree, pinned by its expected candidate hashes.
 * Judgments and proposed plans are optional per lesson. Read-only: nothing here writes.
 */
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import type { AgentIdentity, JudgmentSubmission } from "./instructionalReviewer";
import type { PlannedAssessmentTask } from "./assessmentBlueprint";
import type { ErrorModel } from "./misconceptionErrorModels";

export const G7_EXCELLENCE_DIR = "curriculum/excellence/g7-v0.2.0";
export const G7_EXCELLENCE_V030_DIR = "curriculum/excellence/g7-v0.3.0";
export const G7_EXCELLENCE_DIRS = Object.freeze([G7_EXCELLENCE_DIR, G7_EXCELLENCE_V030_DIR]);

export type G7LessonSource = Readonly<{
  lessonKey: string;
  contentKey: string;
  subject: string;
  grade: number;
  candidatePath: string;
  assessmentPath: string;
  expectedCandidateSha256: string;
  misconceptionSignatures: Readonly<Record<string, ErrorModel>>;
  packageGaps: readonly string[];
  waecBaseline: Readonly<{ examination: string; competency: string; evidenceSpecificity: string; note: string }>;
}>;

export type G7SourcePin = Readonly<{
  /** Directory this pin was read from (set by the loader). */
  dir: string;
  revisionLabel: string;
  pullRequest: number;
  /** null: the revision in this tree, pinned by expected candidate hashes. */
  gitCommit: string | null;
  candidateAuthors: readonly AgentIdentity[];
  reviewer: AgentIdentity;
  /** An AI reviewer to attempt judgment review with; recorded as blocked when it authored the revision. */
  aiJudgmentReviewer?: AgentIdentity;
  /** Report set for the previous revision, used to carry its findings forward. */
  priorReportDir?: string;
  lessons: readonly G7LessonSource[];
}>;

export type ProposedTask = PlannedAssessmentTask & Readonly<{
  prompt: string;
  key?: string;
  scoringGuide?: unknown;
  targetsMisconceptions?: readonly string[];
  note?: string;
}>;

export type MisconceptionCorrections = Readonly<{
  catalogueAdditions: readonly Readonly<{ id: string; objectiveId: string; description: string; response: string; condition?: string }>[];
  remaps: readonly Readonly<{ itemId: string; optionIndex: number; from: string; to: string | null; rationale?: string }>[];
  optionReplacements: readonly Readonly<{ itemId: string; optionIndex: number; from: string; to: string; mapTo: string; expectedErrorModel: ErrorModel; rationale: string }>[];
  signatureAdditions?: Readonly<Record<string, ErrorModel>>;
  diagnosabilityAdditions?: readonly Readonly<{ misconceptionId: string; via: string; rationale: string }>[];
}>;

export type ProposedPlan = Readonly<{
  planId: string;
  status: "PROPOSED_CANDIDATE_ONLY";
  revision: Readonly<{ contentKey: string; candidateSha256: string }>;
  authors: readonly AgentIdentity[];
  supersedesCandidateTaskIds: readonly string[];
  supersedeRationale?: string;
  tasks: readonly ProposedTask[];
  misconceptionCorrections: MisconceptionCorrections;
}>;

/** How a finding on the previous revision was handled in this one. Authored; never a review verdict. */
export type PriorFindingDisposition = Readonly<{
  findingId: string;
  disposition: "CORRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW" | "OPEN_CURRICULUM_OWNER_DECISION" | "OPEN_NOT_ADDRESSED";
  change: string;
}>;

export type G7LessonInputs = Readonly<{
  source: G7LessonSource;
  candidate: CandidateLessonV2;
  assessment: unknown;
  judgments: readonly JudgmentSubmission[];
  plan: ProposedPlan | null;
  priorDispositions: readonly PriorFindingDisposition[];
}>;

const readJson = <T>(root: string, file: string): T => JSON.parse(readFileSync(path.join(root, file), "utf8")) as T;
const readOptional = <T>(root: string, file: string): T | null => (existsSync(path.join(root, file)) ? readJson<T>(root, file) : null);

export function readSourcePin(root = process.cwd(), dir = G7_EXCELLENCE_DIR): G7SourcePin {
  const pin = readJson<Omit<G7SourcePin, "dir">>(root, `${dir}/source.json`);
  return { revisionLabel: "v0.2.0", ...pin, dir };
}

/** True when the pinned revision can be read here (always, for a working-tree pin). */
export function pinnedCommitAvailable(pin: G7SourcePin, root = process.cwd()): boolean {
  if (pin.gitCommit === null) return true;
  try {
    execFileSync("git", ["cat-file", "-e", `${pin.gitCommit}^{commit}`], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function readRevisionJson(root: string, commit: string | null, file: string): unknown {
  if (commit === null) return readJson<unknown>(root, file);
  return JSON.parse(execFileSync("git", ["show", `${commit}:${file}`], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
}

export function loadG7LessonInputs(root = process.cwd(), dir = G7_EXCELLENCE_DIR): readonly G7LessonInputs[] {
  const pin = readSourcePin(root, dir);
  return pin.lessons.map((source) => ({
    source,
    candidate: readRevisionJson(root, pin.gitCommit, source.candidatePath) as CandidateLessonV2,
    assessment: readRevisionJson(root, pin.gitCommit, source.assessmentPath),
    judgments: readOptional<{ judgments: JudgmentSubmission[] }>(root, `${dir}/${source.lessonKey}/judgments.json`)?.judgments ?? [],
    plan: readOptional<ProposedPlan>(root, `${dir}/${source.lessonKey}/assessment-plan.json`),
    priorDispositions: readOptional<{ dispositions: PriorFindingDisposition[] }>(root, `${dir}/${source.lessonKey}/prior-findings.json`)?.dispositions ?? [],
  }));
}
