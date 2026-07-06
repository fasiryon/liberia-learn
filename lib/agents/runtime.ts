import { routedCompletion } from "@/lib/ai/routedCompletion";
import { getSystemPrompt } from "@/lib/ai/promptRegistry";
import { getAgent } from "@/lib/agents/registry";
import { toolsForAgent } from "@/lib/agents/toolRegistry";
import { isAgentEnabled } from "@/lib/agents/flags";
import { persistInvocation } from "@/lib/agents/invocationLog";
import { recordSpend } from "@/lib/agents/costAccounting";
import { roundUSD } from "@/lib/agents/money";
import type {
  AgentRole,
  InvocationStatus,
  ToolCallRecord,
  ToolDefinition,
  TriggeredBy,
} from "@/lib/agents/types";

export interface RunContext {
  userId?: string | null;
  userRole?: AgentRole | null;
  schoolId?: string | null;
  traceId?: string | null;
  triggeredBy?: TriggeredBy;
  goalId?: string | null;
  /** Max LLM turns before a safety stop. Default 20. */
  maxDepth?: number;
  /** Wall-clock budget for the whole invocation. Default 60s. */
  timeoutMs?: number;
  /** Injectable clock (ms) for deterministic timeout tests. */
  now?: () => number;
}

export interface RunResult {
  status: InvocationStatus;
  response: string | null;
  invocationId: string | null;
  toolCalls: ToolCallRecord[];
  llmCostUSD: number;
  llmTokensIn: number;
  llmTokensOut: number;
  toolCostUnits: number;
  error?: string;
}

const DEFAULT_MAX_DEPTH = 20;
const DEFAULT_TIMEOUT_MS = 60_000;

/** Strip ```json fences the model sometimes wraps around JSON. */
function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

type ParsedTurn =
  | { kind: "tool"; tool: string; args: unknown }
  | { kind: "final"; response: string }
  | { kind: "unparseable" };

function parseTurn(content: string): ParsedTurn {
  let obj: unknown;
  try {
    obj = JSON.parse(stripFences(content));
  } catch {
    return { kind: "unparseable" };
  }
  if (!obj || typeof obj !== "object") return { kind: "unparseable" };
  const rec = obj as Record<string, unknown>;
  if (rec.action === "final") {
    return { kind: "final", response: String(rec.response ?? "") };
  }
  if (rec.action === "tool" && typeof rec.tool === "string") {
    return { kind: "tool", tool: rec.tool, args: rec.args ?? {} };
  }
  return { kind: "unparseable" };
}

function toolDescriptions(tools: ToolDefinition[]): string {
  if (tools.length === 0) return "No tools are available.";
  return tools
    .map((t) => `- ${t.name} (${t.domain}): ${t.description}`)
    .join("\n");
}

export async function runAgent(
  agentName: string,
  userInput: string,
  ctx: RunContext = {}
): Promise<RunResult> {
  const agent = getAgent(agentName); // throws "Agent not found" for unknown
  const triggeredBy: TriggeredBy = ctx.triggeredBy ?? "USER";
  const clock = ctx.now ?? Date.now;
  const startedAt = clock();

  const base = {
    agentName: agent.name,
    agentVersion: agent.version,
    goalId: ctx.goalId ?? null,
    userId: ctx.userId ?? null,
    triggeredBy,
    input: { userInput },
    schoolId: ctx.schoolId ?? null,
    traceId: ctx.traceId ?? null,
  };

  // 1. Kill switch — block before any LLM spend.
  if (!isAgentEnabled(agent.featureFlag)) {
    const { id } = await persistInvocation({
      ...base,
      output: null,
      toolCalls: [],
      llmTokensIn: 0,
      llmTokensOut: 0,
      llmCostUSD: 0,
      toolCostUnits: 0,
      latencyMs: clock() - startedAt,
      status: "FEATURE_DISABLED",
      errorMessage: "feature_disabled",
    });
    return {
      status: "FEATURE_DISABLED",
      response: null,
      invocationId: id,
      toolCalls: [],
      llmCostUSD: 0,
      llmTokensIn: 0,
      llmTokensOut: 0,
      toolCostUnits: 0,
    };
  }

  // 2. Role gate — defense-in-depth over the route's own authz.
  if (!ctx.userRole || !agent.rolesAllowed.includes(ctx.userRole)) {
    throw Object.assign(
      new Error(`Role not permitted for agent ${agent.name}`),
      { status: 403, code: "role_not_allowed" }
    );
  }

  const tools = toolsForAgent(agent);
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  const systemPrompt = [
    getSystemPrompt(agent.systemPromptKey),
    "",
    "You have these tools:",
    toolDescriptions(tools),
    "",
    "Reply with ONLY a JSON object, one of:",
    '- to call a tool: {"action":"tool","tool":"<name>","args":{...}}',
    '- to answer: {"action":"final","response":"<text>"}',
  ].join("\n");

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userInput },
  ];

  const maxDepth = ctx.maxDepth ?? DEFAULT_MAX_DEPTH;
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const toolCalls: ToolCallRecord[] = [];
  let llmCostUSD = 0;
  let llmTokensIn = 0;
  let llmTokensOut = 0;
  let toolCostUnits = 0;
  let repairsUsed = 0;

  let status: InvocationStatus = "FAILURE";
  let response: string | null = null;
  let error: string | undefined = "unterminated";

  for (let depth = 0; depth < maxDepth; depth++) {
    if (clock() - startedAt > timeoutMs) {
      status = "TIMEOUT";
      error = "timeout";
      break;
    }

    const completion = await routedCompletion({
      messages,
      maxTokens: agent.maxTokens,
      responseFormat: "json",
      modelOverride: agent.llmModel,
      aiUsage: {
        route: `agent/${agent.name}`,
        feature: "agent_platform" as never,
        userId: ctx.userId ?? null,
        schoolId: ctx.schoolId ?? null,
        requestType: `agent_${agent.name}`,
      },
    });

    llmCostUSD = roundUSD(llmCostUSD + (completion.estimatedCostUSD ?? 0));
    llmTokensIn += completion.inputTokens ?? 0;
    llmTokensOut += completion.outputTokens ?? 0;

    // Per-invocation cost cap — checked after accruing this turn's cost.
    if (llmCostUSD > agent.costLimits.perInvocationUSD) {
      status = "COST_CAPPED";
      error = "cost_capped";
      break;
    }

    messages.push({ role: "assistant", content: completion.content });
    const turn = parseTurn(completion.content);

    if (turn.kind === "unparseable") {
      if (repairsUsed < 1) {
        repairsUsed++;
        messages.push({
          role: "user",
          content:
            "Your last message was not valid JSON. Reply with ONLY the JSON object.",
        });
        continue;
      }
      status = "FAILURE";
      error = "invalid_json";
      break;
    }

    if (turn.kind === "final") {
      status = "SUCCESS";
      response = turn.response;
      error = undefined;
      break;
    }

    // turn.kind === "tool"
    const tool = toolByName.get(turn.tool);
    if (!tool) {
      toolCalls.push({
        tool: turn.tool,
        args: turn.args,
        error: "tool_not_allowed",
        costUnits: 0,
        ok: false,
      });
      messages.push({
        role: "user",
        content: `Tool "${turn.tool}" is not available. Choose an allowed tool or answer.`,
      });
      continue;
    }

    const parsed = tool.inputSchema.safeParse(turn.args);
    if (!parsed.success) {
      toolCalls.push({
        tool: tool.name,
        args: turn.args,
        error: `invalid_args: ${parsed.error.message}`,
        costUnits: 0,
        ok: false,
      });
      messages.push({
        role: "user",
        content: `Arguments for "${tool.name}" were invalid. Fix them and try again, or answer.`,
      });
      continue;
    }

    try {
      const out = await tool.handler(parsed.data, {
        userId: ctx.userId ?? null,
        userRole: ctx.userRole ?? null,
        schoolId: ctx.schoolId ?? null,
        traceId: ctx.traceId ?? null,
        agentName: agent.name,
      });
      toolCostUnits += tool.estimatedCostUnits;
      toolCalls.push({
        tool: tool.name,
        args: parsed.data,
        result: out,
        costUnits: tool.estimatedCostUnits,
        ok: true,
      });
      messages.push({
        role: "user",
        content: `Tool "${tool.name}" returned: ${JSON.stringify(out)}`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toolCalls.push({
        tool: tool.name,
        args: parsed.data,
        error: message,
        costUnits: 0,
        ok: false,
      });
      messages.push({
        role: "user",
        content: `Tool "${tool.name}" failed: ${message}. Try again or answer.`,
      });
    }
  }

  if (status === "FAILURE" && error === "unterminated") {
    error = "max_tool_depth";
  }

  const latencyMs = clock() - startedAt;
  const { id } = await persistInvocation({
    ...base,
    output: response !== null ? { response } : null,
    toolCalls,
    llmTokensIn,
    llmTokensOut,
    llmCostUSD,
    toolCostUnits,
    latencyMs,
    status,
    errorMessage: error ?? null,
  });

  await recordSpend({
    agentName: agent.name,
    llmCostUSD,
    toolCostUnits,
  });

  return {
    status,
    response,
    invocationId: id,
    toolCalls,
    llmCostUSD,
    llmTokensIn,
    llmTokensOut,
    toolCostUnits,
    error,
  };
}
