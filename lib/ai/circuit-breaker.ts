/**
 * lib/ai/circuit-breaker.ts
 *
 * In-memory circuit breaker for AI provider calls (per serverless instance).
 *
 * States:
 *   CLOSED   — requests pass through normally
 *   OPEN     — requests immediately return fallback (opens after 5 consecutive
 *              failures within 60s; stays open for 30s then moves to HALF_OPEN)
 *   HALF_OPEN — one test request is allowed through
 *               success → CLOSED; failure → OPEN again
 */

export class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly timeout: number;

  constructor(options?: { threshold?: number; timeoutMs?: number }) {
    this.threshold = options?.threshold ?? 5;
    this.timeout = options?.timeoutMs ?? 30_000;
  }

  async call<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = "HALF_OPEN";
      } else {
        return fallback;
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch {
      this.onFailure();
      return fallback;
    }
  }

  getState(): "CLOSED" | "OPEN" | "HALF_OPEN" {
    return this.state;
  }

  reset(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.lastFailureTime = 0;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) this.state = "OPEN";
  }
}

export const openAiBreaker = new CircuitBreaker();
export const groqBreaker = new CircuitBreaker();
