import { logger } from "@/lib/logger";

export type ProviderRetryErrorCode =
  | "rate_limit"
  | "timeout"
  | "network_transient"
  | "malformed_output"
  | "quality_gate_failure"
  | "validation_failure"
  | "unknown";

export type ProviderRetryContext = {
  provider?: string | null;
  model?: string | null;
  operation: string;
  maxAttempts?: number;
  baseDelayMs?: number;
  jitterMs?: number;
};

export type ProviderRetryMetadata = {
  provider?: string | null;
  model?: string | null;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUSD?: number;
};

export class NonRetryableProviderError extends Error {
  code: ProviderRetryErrorCode;

  constructor(message: string, code: ProviderRetryErrorCode = "validation_failure") {
    super(message);
    this.name = "NonRetryableProviderError";
    this.code = code;
  }
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function classifyProviderError(error: unknown): ProviderRetryErrorCode {
  if (error instanceof NonRetryableProviderError) return error.code;
  const anyError = error as { status?: number; code?: string; name?: string };
  const message = messageFor(error).toLowerCase();

  if (message.includes("quality gate") || message.includes("quality_gate")) return "quality_gate_failure";
  if (message.includes("validation") && !message.includes("json")) return "validation_failure";
  if (anyError.status === 429 || message.includes("rate limit") || message.includes("too many requests")) return "rate_limit";
  if (anyError.name === "AbortError" || message.includes("timeout") || message.includes("timed out")) return "timeout";
  if (
    anyError.code === "ECONNRESET" ||
    anyError.code === "ETIMEDOUT" ||
    anyError.code === "EAI_AGAIN" ||
    message.includes("econnreset") ||
    message.includes("socket hang up") ||
    message.includes("network")
  ) {
    return "network_transient";
  }
  if (message.includes("json") || message.includes("malformed")) return "malformed_output";
  return "unknown";
}

export function maxAttemptsForError(code: ProviderRetryErrorCode, configured?: number) {
  if (configured && configured > 0) return configured;
  if (code === "rate_limit" || code === "network_transient") return 3;
  if (code === "timeout") return 2;
  if (code === "malformed_output") return 1;
  if (code === "quality_gate_failure" || code === "validation_failure") return 1;
  return 2;
}

function isRetryable(code: ProviderRetryErrorCode) {
  return code === "rate_limit" || code === "timeout" || code === "network_transient" || code === "malformed_output" || code === "unknown";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextDelayMs(attempt: number, baseDelayMs: number, jitterMs: number) {
  return baseDelayMs * 2 ** Math.max(0, attempt - 1) + Math.floor(Math.random() * Math.max(0, jitterMs));
}

export async function withProviderRetry<T>(
  context: ProviderRetryContext,
  operation: (attempt: number) => Promise<T>,
  metadata?: (result: T) => ProviderRetryMetadata
): Promise<T> {
  const baseDelayMs = context.baseDelayMs ?? 500;
  const jitterMs = context.jitterMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; ; attempt += 1) {
    const startedAt = Date.now();
    try {
      const result = await operation(attempt);
      const safeMetadata = metadata?.(result) ?? {};
      logger.info("[AI_RETRY] provider operation succeeded", {
        operation: context.operation,
        attempt,
        provider: safeMetadata.provider ?? context.provider ?? null,
        model: safeMetadata.model ?? context.model ?? null,
        latencyMs: safeMetadata.latencyMs ?? Date.now() - startedAt,
        inputTokens: safeMetadata.inputTokens,
        outputTokens: safeMetadata.outputTokens,
        estimatedCostUSD: safeMetadata.estimatedCostUSD,
      });
      return result;
    } catch (error) {
      lastError = error;
      const code = classifyProviderError(error);
      const maxAttempts = maxAttemptsForError(code, context.maxAttempts);
      const shouldRetry = isRetryable(code) && attempt < maxAttempts;

      logger.warn("[AI_RETRY] provider operation failed", {
        operation: context.operation,
        attempt,
        maxAttempts,
        retry: shouldRetry,
        code,
        provider: context.provider ?? null,
        model: context.model ?? null,
        latencyMs: Date.now() - startedAt,
        message: messageFor(error).slice(0, 500),
      });

      if (!shouldRetry) throw error;
      await delay(nextDelayMs(attempt, baseDelayMs, jitterMs));
    }
  }

  throw lastError;
}
