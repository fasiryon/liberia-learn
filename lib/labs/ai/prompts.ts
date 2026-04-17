import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import type { LabDefinition } from "@/lib/labs/types";

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildLabActionPlannerPrompt(params: {
  lab: LabDefinition<unknown>;
  currentState: unknown;
  studentRequest: string;
}): string {
  return buildPrompt("lab.action.planner", {
    labTitle: params.lab.title,
    labId: params.lab.id,
    subject: params.lab.subject,
    gradeBand: params.lab.gradeBand,
    allowedActions: params.lab.allowedActions.join(", "),
    currentStateJson: stableJson(params.currentState),
    studentRequest: params.studentRequest,
  });
}

export function buildLabStateExplainerPrompt(params: {
  lab: LabDefinition<unknown>;
  previousState: unknown;
  nextState: unknown;
  actionType: string;
}): string {
  return buildPrompt("lab.state.explainer", {
    labTitle: params.lab.title,
    labId: params.lab.id,
    subject: params.lab.subject,
    gradeBand: params.lab.gradeBand,
    actionType: params.actionType,
    previousStateJson: stableJson(params.previousState),
    nextStateJson: stableJson(params.nextState),
  });
}

export function getLabPlannerPromptMetadata() {
  return getPromptMetadata("lab.action.planner");
}

export function getLabExplainerPromptMetadata() {
  return getPromptMetadata("lab.state.explainer");
}

export function buildLabActionPlannerSystemPrompt(): string {
  return buildPrompt("lab.action.planner.system");
}

export function buildLabStateExplainerSystemPrompt(): string {
  return buildPrompt("lab.state.explainer.system");
}
