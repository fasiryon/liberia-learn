/**
 * Loads the Grade 7 v0.2.0 inputs for the excellence gap reports.
 *
 * Candidates are read from the pinned git commit with `git show`, never from a working tree, so a
 * report is always about the exact revision named in source.json. Judgments and proposed plans are
 * read from curriculum/excellence/g7-v0.2.0/. Read-only: nothing here writes.
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import type { AgentIdentity, JudgmentSubmission } from "./instructionalReviewer";
import type { PlannedAssessmentTask } from "./assessmentBlueprint";
import type { ErrorModel } from "./misconceptionErrorModels";

export const G7_EXCELLENCE_DIR = "curriculum/excellence/g7-v0.2.0";

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
  pullRequest: number;
  gitCommit: string;
  candidateAuthors: readonly AgentIdentity[];
  reviewer: AgentIdentity;
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

export type G7LessonInputs = Readonly<{
  source: G7LessonSource;
  candidate: CandidateLessonV2;
  assessment: unknown;
  judgments: readonly JudgmentSubmission[];
  plan: ProposedPlan;
}>;

const readJson = <T>(root: string, file: string): T => JSON.parse(readFileSync(path.join(root, file), "utf8")) as T;

export function readSourcePin(root = process.cwd()): G7SourcePin {
  return readJson<G7SourcePin>(root, `${G7_EXCELLENCE_DIR}/source.json`);
}

/** True when the pinned commit is available in the local object store. */
export function pinnedCommitAvailable(pin: G7SourcePin, root = process.cwd()): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${pin.gitCommit}^{commit}`], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gitShowJson(root: string, commit: string, file: string): unknown {
  return JSON.parse(execFileSync("git", ["show", `${commit}:${file}`], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
}

export function loadG7LessonInputs(root = process.cwd()): readonly G7LessonInputs[] {
  const pin = readSourcePin(root);
  return pin.lessons.map((source) => ({
    source,
    candidate: gitShowJson(root, pin.gitCommit, source.candidatePath) as CandidateLessonV2,
    assessment: gitShowJson(root, pin.gitCommit, source.assessmentPath),
    judgments: readJson<{ judgments: JudgmentSubmission[] }>(root, `${G7_EXCELLENCE_DIR}/${source.lessonKey}/judgments.json`).judgments,
    plan: readJson<ProposedPlan>(root, `${G7_EXCELLENCE_DIR}/${source.lessonKey}/assessment-plan.json`),
  }));
}
