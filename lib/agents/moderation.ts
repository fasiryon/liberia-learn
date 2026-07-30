import { routedCompletion } from "@/lib/ai/routedCompletion";
import { getSystemPrompt } from "@/lib/ai/promptRegistry";
import { logger } from "@/lib/logger";
// The moderation prompts are registered as a side effect of this import.
// Previously only lib/agents/bootstrap.ts imported infraPrompts, so any
// caller of moderateText() that did not go through the runAgent() harness
// (e.g. groundedAnswerService.ts, labAnalyzer.ts - NR-9.5) silently failed
// open to UNCERTAIN with "Prompt registry entry not found." Importing here
// makes moderateText self-sufficient regardless of caller. ES-module
// caching means this runs exactly once per process even though
// bootstrap.ts also imports it.
import "@/lib/agents/infraPrompts";

export type ModerationVerdict = "SAFE" | "UNSAFE" | "UNCERTAIN";

export interface ModerationResult {
  verdict: ModerationVerdict;
  reason?: string;
}

function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

/**
 * Classify agent input or output for safety via routedCompletion. Fails OPEN to
 * UNCERTAIN on classifier error or malformed output (never silently SAFE) so
 * the runtime can log/flag rather than crash on a moderation outage.
 */
export async function moderateText(
  text: string,
  kind: "input" | "output"
): Promise<ModerationResult> {
  if (!text || !text.trim()) return { verdict: "SAFE" };

  const promptKey =
    kind === "input"
      ? "agent.moderation.input.system"
      : "agent.moderation.output.system";

  try {
    const completion = await routedCompletion({
      messages: [
        { role: "system", content: getSystemPrompt(promptKey) },
        { role: "user", content: text },
      ],
      maxTokens: 120,
      responseFormat: "json",
      aiUsage: {
        route: "agent/moderation",
        feature: "agent_platform" as never,
        requestType: `agent_moderation_${kind}`,
      },
    });

    const parsed = JSON.parse(stripFences(completion.content)) as {
      verdict?: string;
      reason?: string;
    };
    const verdict = parsed.verdict;
    if (verdict === "SAFE" || verdict === "UNSAFE" || verdict === "UNCERTAIN") {
      return { verdict, reason: parsed.reason || undefined };
    }
    return { verdict: "UNCERTAIN", reason: "unrecognized_verdict" };
  } catch (e) {
    logger.warn("[agent.moderation] classifier failed — failing open to UNCERTAIN", {
      kind,
      message: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
    return { verdict: "UNCERTAIN", reason: "moderation_error" };
  }
}
