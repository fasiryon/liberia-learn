// Deterministic review scenarios for the Interactive Lab Production Team.
// A scenario is a named learner state reached by replaying real LabActions through the kernel from
// initializeLab. Reviewers inspect captures of these states in the actual renderer; nothing here
// renders, records evidence, or writes mastery. See docs/architecture/INTERACTIVE_LAB_PRODUCTION_TEAM.md.
import { acceptLabAction, initializeLab } from "../kernel";
import type { CapabilityProfile, InteractiveLabDefinition, LabAction, LabState } from "../types";

export const LAB_REVIEW_SCENARIO_VERSION = "lab-review-scenario/1.0.0" as const;
/** Motion review strips: 8–16 frames per key transition. */
export const LAB_REVIEW_MOTION_FRAMES = Object.freeze({ min: 8, max: 16 });
export const LAB_REVIEW_PROFILES: readonly CapabilityProfile[] = Object.freeze(["HIGH", "STANDARD", "LOW", "FALLBACK_2D"]);

/** What a capture is for. The production team requires one capture per applicable stage. */
export type LabReviewStage =
  | "overview"
  | "guided"
  | "exploded"
  | "cutaway"
  | "net"
  | "process"
  | "variable"
  | "fault"
  | "challenge"
  | "assessment";

export type LabReviewScenario = {
  id: string;
  title: string;
  stage: LabReviewStage;
  /** The storyboard scene this capture point stands for (from the experience director's shot list). */
  storyboardScene?: string;
  /** Replayed through acceptLabAction from initializeLab. Any rejected action fails the scenario. */
  actions: LabAction[] | ((definition: InteractiveLabDefinition<LabState>) => LabAction[]);
  /** Checks that must be complete after replay, so a capture labelled "assessment" really shows a passed check. */
  expectCompletedChecks?: string[];
  /**
   * Motion review: the final action is dispatched live in the renderer and frames are sampled on a fixed
   * virtual clock, so the transition (explode, flow start, camera move) can be reviewed frame by frame.
   */
  motion?: { frames: number; intervalMs: number };
};

export type LabReviewScenarioSet = {
  scenarioVersion: typeof LAB_REVIEW_SCENARIO_VERSION;
  labId: string;
  labVersion: string;
  scenarios: LabReviewScenario[];
};

export type ScenarioReplay =
  | { ok: true; state: LabState; actions: LabAction[] }
  | { ok: false; reason: string; failedIndex: number; action: LabAction | null };

export function scenarioActions(definition: InteractiveLabDefinition<LabState>, scenario: LabReviewScenario): LabAction[] {
  return typeof scenario.actions === "function" ? scenario.actions(definition) : scenario.actions;
}

/** Replays a scenario through the real kernel. `holdFinalAction` stops one action early for motion capture. */
export function replayReviewScenario(definition: InteractiveLabDefinition<LabState>, scenario: LabReviewScenario, options: { holdFinalAction?: boolean } = {}): ScenarioReplay {
  const all = scenarioActions(definition, scenario);
  const actions = options.holdFinalAction && all.length > 0 ? all.slice(0, -1) : all;
  let state = initializeLab(definition);
  for (const [index, action] of actions.entries()) {
    const result = acceptLabAction(definition, state, action);
    if ("reason" in result) return { ok: false, reason: result.reason, failedIndex: index, action };
    state = result.state;
  }
  if (!options.holdFinalAction) {
    const missing = (scenario.expectCompletedChecks ?? []).filter((checkId) => !state.completedChecks.includes(checkId));
    if (missing.length > 0) return { ok: false, reason: `Expected completed checks are missing: ${missing.join(", ")}.`, failedIndex: actions.length, action: null };
  }
  return { ok: true, state, actions };
}

/** Stages a definition must cover, derived from what its fidelity layer actually contains. */
export function requiredReviewStages(definition: InteractiveLabDefinition<LabState>): LabReviewStage[] {
  const stages: LabReviewStage[] = ["overview", "guided", "challenge", "assessment"];
  const fidelity = definition.fidelity;
  if (fidelity?.exploded.length) stages.push("exploded");
  if (fidelity?.cutaways.length) stages.push("cutaway");
  if (fidelity?.flows.length) stages.push("process");
  // A causal lab (one with a process flow) must show a learner-controlled variable changing the outcome.
  if (fidelity?.flows.length && fidelity.variables.some((variable) => variable.learnerControlled)) stages.push("variable");
  return stages;
}

/** Problems with a scenario set: wrong lab/version, duplicate ids, missing stages, replay failures. */
export function validateScenarioSet(definition: InteractiveLabDefinition<LabState>, set: LabReviewScenarioSet): string[] {
  const problems: string[] = [];
  if (set.labId !== definition.id) problems.push(`Scenario set is for ${set.labId}, not ${definition.id}.`);
  if (set.labVersion !== definition.version) problems.push(`Scenario set targets ${set.labId}@${set.labVersion} but the definition is ${definition.version}.`);
  const ids = new Set<string>();
  for (const scenario of set.scenarios) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(scenario.id)) problems.push(`Scenario id "${scenario.id}" must be kebab-case (it names capture files).`);
    if (ids.has(scenario.id)) problems.push(`Duplicate scenario id "${scenario.id}".`);
    ids.add(scenario.id);
    const replay = replayReviewScenario(definition, scenario);
    if ("reason" in replay) problems.push(`Scenario "${scenario.id}" does not replay: action ${replay.failedIndex} ${replay.action ? JSON.stringify(replay.action) : ""} — ${replay.reason}`.trim());
    if (scenario.motion && (scenario.motion.frames < LAB_REVIEW_MOTION_FRAMES.min || scenario.motion.frames > LAB_REVIEW_MOTION_FRAMES.max || scenario.motion.intervalMs <= 0)) problems.push(`Scenario "${scenario.id}" motion must sample ${LAB_REVIEW_MOTION_FRAMES.min}–${LAB_REVIEW_MOTION_FRAMES.max} frames at a positive interval.`);
    if (scenario.motion && scenarioActions(definition, scenario).length === 0) problems.push(`Scenario "${scenario.id}" has motion but no final action to animate.`);
  }
  const covered = new Set(set.scenarios.map((scenario) => scenario.stage));
  for (const stage of requiredReviewStages(definition)) if (!covered.has(stage)) problems.push(`No "${stage}" scenario; the production team requires one.`);
  return problems;
}

/**
 * The review harness renders unapproved labs, so it must never be reachable in a deployed build.
 * It is enabled only in a non-production Node process with an explicit opt-in flag, never on Vercel.
 */
export function isLabReviewHarnessEnabled(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production" && env.VERCEL !== "1" && env.LAB_REVIEW_HARNESS === "1";
}
