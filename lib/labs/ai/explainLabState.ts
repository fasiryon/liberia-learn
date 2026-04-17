import { logAIInteraction } from "@/lib/ai/interactionLog";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { getLabDefinition, isValidLabId } from "@/lib/labs/registry";
import {
  buildLabStateExplainerPrompt,
  buildLabStateExplainerSystemPrompt,
  getLabExplainerPromptMetadata,
} from "@/lib/labs/ai/prompts";

type ExplainLabStateParams = {
  labId: string;
  previousState: unknown;
  nextState: unknown;
  actionType?: string | null;
  userId?: string | null;
  studentId?: string | null;
  schoolId?: string | null;
  lessonId?: string | null;
  route?: string;
};

const FALLBACK_EXPLANATION =
  "The lab state changed. Compare the before and after values to connect the action with the result.";

function under120Words(value: string): string {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, 120).join(" ");
}

async function logExplainerCall(params: {
  input: ExplainLabStateParams;
  labId: string;
  promptVersion?: string | null;
  promptHash?: string | null;
  result?: Awaited<ReturnType<typeof routedCompletion>> | null;
  fallbackUsed: boolean;
  latencyMs: number;
}) {
  await logAIInteraction({
    route: params.input.route ?? "/api/labs/[labId]/explain",
    feature: "labs",
    schoolId: params.input.schoolId ?? null,
    userId: params.input.userId ?? null,
    studentId: params.input.studentId ?? params.input.userId ?? null,
    lessonId: params.input.lessonId ?? null,
    requestType: "lab_state_explainer",
    inputTokens: params.result?.inputTokens ?? 0,
    outputTokens: params.result?.outputTokens ?? 0,
    estimatedCostUSD: params.result?.estimatedCostUSD ?? 0,
    model: params.result?.model ?? null,
    tier: params.result?.tier ?? "smart",
    promptKey: "lab.state.explainer",
    promptVersion: params.promptVersion ?? null,
    promptHash: params.promptHash ?? null,
    fallbackUsed: params.fallbackUsed,
    latencyMs: params.latencyMs,
    metadata: {
      labId: params.labId,
      actionType: params.input.actionType ?? null,
    },
  });
}

export async function explainLabState(input: ExplainLabStateParams): Promise<string> {
  const startedAt = Date.now();
  let result: Awaited<ReturnType<typeof routedCompletion>> | null = null;
  let promptVersion: string | null = null;
  let promptHash: string | null = null;

  try {
    if (!isValidLabId(input.labId)) {
      await logExplainerCall({
        input,
        labId: input.labId,
        fallbackUsed: true,
        latencyMs: Date.now() - startedAt,
      });
      return FALLBACK_EXPLANATION;
    }

    const lab = getLabDefinition(input.labId);
    const metadata = getLabExplainerPromptMetadata();
    promptVersion = metadata.version;
    promptHash = metadata.hash;
    const userPrompt = buildLabStateExplainerPrompt({
      lab,
      previousState: input.previousState,
      nextState: input.nextState,
      actionType: input.actionType ?? "UNKNOWN",
    });

    result = await routedCompletion({
      forceSmartTier: true,
      maxTokens: 180,
      messages: [
        {
          role: "system",
          content: buildLabStateExplainerSystemPrompt(),
        },
        { role: "user", content: userPrompt },
      ],
    });

    await logExplainerCall({
      input,
      labId: lab.id,
      promptVersion,
      promptHash,
      result,
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
    });
    return under120Words(result.content) || FALLBACK_EXPLANATION;
  } catch {
    await logExplainerCall({
      input,
      labId: input.labId,
      promptVersion,
      promptHash,
      result,
      fallbackUsed: true,
      latencyMs: Date.now() - startedAt,
    });
    return FALLBACK_EXPLANATION;
  }
}

export type { ExplainLabStateParams };
