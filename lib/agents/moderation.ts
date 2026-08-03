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

export type ModerationAudience = "general" | "minor";

export interface ModerationOptions {
  audience?: ModerationAudience;
}

function applyAudiencePolicy(
  result: ModerationResult,
  options?: ModerationOptions
): ModerationResult {
  if (options?.audience === "minor" && result.verdict === "UNCERTAIN") {
    return {
      verdict: "UNSAFE",
      reason: result.reason
        ? `minor_fail_closed:${result.reason}`
        : "minor_fail_closed:uncertain",
    };
  }

  return result;
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
  kind: "input" | "output",
  options?: ModerationOptions
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
      return applyAudiencePolicy(
        { verdict, reason: parsed.reason || undefined },
        options
      );
    }
    return applyAudiencePolicy(
      { verdict: "UNCERTAIN", reason: "unrecognized_verdict" },
      options
    );
  } catch (e) {
    logger.warn("[agent.moderation] classifier failed — failing open to UNCERTAIN", {
      kind,
      message: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
    return applyAudiencePolicy(
      { verdict: "UNCERTAIN", reason: "moderation_error" },
      options
    );
  }
}
