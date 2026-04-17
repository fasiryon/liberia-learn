import { logAIInteraction } from "@/lib/ai/interactionLog";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { getLabDefinition, isValidLabId } from "@/lib/labs/registry";
import {
  buildLabActionPlannerPrompt,
  buildLabActionPlannerSystemPrompt,
  getLabPlannerPromptMetadata,
} from "@/lib/labs/ai/prompts";
import type { LabAction, LabId, PlannedLabAction } from "@/lib/labs/types";

type PlanLabActionParams = {
  labId: string;
  currentState: unknown;
  studentRequest: string;
  userId?: string | null;
  studentId?: string | null;
  schoolId?: string | null;
  lessonId?: string | null;
  route?: string;
};

function rejected(userFacingMessage: string, reason: string): PlannedLabAction {
  return {
    rejected: true,
    actionType: null,
    userFacingMessage,
    reason,
  };
}

function parsePlannedAction(content: string): PlannedLabAction {
  const parsed = JSON.parse(content) as Partial<PlannedLabAction> & { action?: LabAction };
  if (parsed.rejected === true) {
    return {
      rejected: true,
      actionType: parsed.actionType ?? parsed.action?.type ?? null,
      action: parsed.action,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      userFacingMessage:
        typeof parsed.userFacingMessage === "string"
          ? parsed.userFacingMessage
          : "I cannot safely make that change in this lab.",
      reason: typeof parsed.reason === "string" ? parsed.reason : "planner_rejected",
    };
  }

  if (!parsed.action || typeof parsed.action.type !== "string") {
    throw new Error("planned action missing action.type");
  }

  return {
    rejected: false,
    action: parsed.action,
    actionType: parsed.action.type,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
    userFacingMessage:
      typeof parsed.userFacingMessage === "string"
        ? parsed.userFacingMessage
        : "I planned that lab action.",
    reason: typeof parsed.reason === "string" ? parsed.reason : null,
  };
}

async function logPlannerCall(params: {
  input: PlanLabActionParams;
  labId: string;
  promptVersion?: string | null;
  promptHash?: string | null;
  result?: Awaited<ReturnType<typeof routedCompletion>> | null;
  rejected: boolean;
  reason?: string | null;
  latencyMs: number;
}) {
  await logAIInteraction({
    route: params.input.route ?? "/api/labs/[labId]/plan",
    feature: "labs",
    schoolId: params.input.schoolId ?? null,
    userId: params.input.userId ?? null,
    studentId: params.input.studentId ?? params.input.userId ?? null,
    lessonId: params.input.lessonId ?? null,
    requestType: "lab_action_planner",
    inputTokens: params.result?.inputTokens ?? 0,
    outputTokens: params.result?.outputTokens ?? 0,
    estimatedCostUSD: params.result?.estimatedCostUSD ?? 0,
    model: params.result?.model ?? null,
    tier: params.result?.tier ?? "smart",
    promptKey: "lab.action.planner",
    promptVersion: params.promptVersion ?? null,
    promptHash: params.promptHash ?? null,
    latencyMs: params.latencyMs,
    metadata: {
      labId: params.labId,
      rejected: params.rejected,
      reason: params.reason ?? null,
    },
  });
}

export async function planLabAction(input: PlanLabActionParams): Promise<PlannedLabAction> {
  const startedAt = Date.now();
  let promptVersion: string | null = null;
  let promptHash: string | null = null;
  let result: Awaited<ReturnType<typeof routedCompletion>> | null = null;
  let labIdForLog = input.labId;

  try {
    if (!isValidLabId(input.labId)) {
      const planned = rejected("That lab is not available yet.", "unknown_lab");
      await logPlannerCall({
        input,
        labId: labIdForLog,
        rejected: true,
        reason: planned.reason,
        latencyMs: Date.now() - startedAt,
      });
      return planned;
    }

    const lab = getLabDefinition(input.labId);
    labIdForLog = lab.id;
    const metadata = getLabPlannerPromptMetadata();
    promptVersion = metadata.version;
    promptHash = metadata.hash;
    const userPrompt = buildLabActionPlannerPrompt({
      lab,
      currentState: input.currentState,
      studentRequest: input.studentRequest,
    });
    const systemPrompt = buildLabActionPlannerSystemPrompt();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      result = await routedCompletion({
        forceSmartTier: true,
        maxTokens: 280,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      try {
        const planned = parsePlannedAction(result.content);
        await logPlannerCall({
          input,
          labId: lab.id,
          promptVersion,
          promptHash,
          result,
          rejected: planned.rejected,
          reason: planned.reason,
          latencyMs: Date.now() - startedAt,
        });
        return planned;
      } catch (error) {
        if (attempt === 0) {
          continue;
        }
        const planned = rejected("I could not turn that request into a safe lab action.", "invalid_planner_json");
        await logPlannerCall({
          input,
          labId: lab.id,
          promptVersion,
          promptHash,
          result,
          rejected: true,
          reason: planned.reason,
          latencyMs: Date.now() - startedAt,
        });
        return planned;
      }
    }

    return rejected("I could not plan that lab action.", "planner_failed");
  } catch (error) {
    const planned = rejected("The lab planner is unavailable right now.", "planner_exception");
    await logPlannerCall({
      input,
      labId: labIdForLog,
      promptVersion,
      promptHash,
      result,
      rejected: true,
      reason: planned.reason,
      latencyMs: Date.now() - startedAt,
    });
    return planned;
  }
}

export type { PlanLabActionParams };
