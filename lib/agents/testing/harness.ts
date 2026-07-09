import type { RunResult } from "@/lib/agents/runtime";

/**
 * Agent test harness: scripted LLM responses, record-and-replay fixtures, and
 * behavior assertions. Lets tests drive an agent deterministically (no live
 * LLM) and detect behavior regressions when agent code changes.
 */

export interface ScriptedCompletionResult {
  content: string;
  tier: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
}

/**
 * A drop-in `routedCompletion` implementation that returns the given raw JSON
 * responses in order. Install via `routedCompletion.mockImplementation(...)`.
 */
export function makeScriptedCompletion(responses: string[], costPerCall = 0.0001) {
  let i = 0;
  return async (): Promise<ScriptedCompletionResult> => {
    const content = responses[i] ?? responses[responses.length - 1] ?? "{}";
    i += 1;
    return { content, tier: "fast", model: "scripted", inputTokens: 5, outputTokens: 3, estimatedCostUSD: costPerCall };
  };
}

export interface AgentFixture {
  agentName: string;
  userInput: string;
  expected: {
    status: string;
    response: string | null;
    toolCalls: Array<{ tool: string; ok: boolean }>;
  };
}

/** Normalize a RunResult into the behavior we assert on (tool sequence + status + response). */
export function buildFixture(agentName: string, userInput: string, result: RunResult): AgentFixture {
  return {
    agentName,
    userInput,
    expected: {
      status: result.status,
      response: result.response,
      toolCalls: result.toolCalls.map((c) => ({ tool: c.tool, ok: c.ok })),
    },
  };
}

/** Compare a fresh run against a recorded fixture. Empty array = no regression. */
export function diffFixture(fixture: AgentFixture, result: RunResult): string[] {
  const diffs: string[] = [];
  if (result.status !== fixture.expected.status) {
    diffs.push(`status: expected ${fixture.expected.status}, got ${result.status}`);
  }
  if (result.response !== fixture.expected.response) {
    diffs.push(`response: expected ${JSON.stringify(fixture.expected.response)}, got ${JSON.stringify(result.response)}`);
  }
  const got = result.toolCalls.map((c) => `${c.tool}:${c.ok}`).join(",");
  const want = fixture.expected.toolCalls.map((c) => `${c.tool}:${c.ok}`).join(",");
  if (got !== want) diffs.push(`toolCalls: expected [${want}], got [${got}]`);
  return diffs;
}

// ── Behavior assertions ──────────────────────────────────────────────────────
export interface AssertResult {
  pass: boolean;
  message: string;
}

export function assertToolCalled(result: RunResult, tool: string): AssertResult {
  const pass = result.toolCalls.some((c) => c.tool === tool && c.ok);
  return { pass, message: pass ? `tool ${tool} was called` : `expected tool ${tool} to be called` };
}

export function assertStatus(result: RunResult, status: string): AssertResult {
  const pass = result.status === status;
  return { pass, message: pass ? `status is ${status}` : `expected status ${status}, got ${result.status}` };
}

export function assertFinalIncludes(result: RunResult, text: string): AssertResult {
  const pass = (result.response ?? "").includes(text);
  return { pass, message: pass ? `response includes "${text}"` : `expected response to include "${text}"` };
}

export function assertEscalated(result: RunResult): AssertResult {
  const pass = result.status === "ESCALATED";
  return { pass, message: pass ? "run escalated" : `expected ESCALATED, got ${result.status}` };
}

export function assertRefused(result: RunResult): AssertResult {
  const pass = result.status === "FAILURE" && /moderation|refus/i.test(result.error ?? "");
  return { pass, message: pass ? "run was refused" : `expected a moderation refusal, got ${result.status}/${result.error}` };
}
