import { checkRateLimit } from "@/lib/rateLimit";
import type { SessionUser } from "@/lib/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/rateLimit";

export async function checkAiRateLimit(input: {
  userId: string;
  role: SessionUser["role"];
  endpoint: string;
  schoolId?: string | null;
}) {
  const max =
    input.role === "STUDENT"
      ? RATE_LIMIT_POLICIES.AI_HEAVY.student
      : input.role === "TEACHER"
      ? RATE_LIMIT_POLICIES.AI_HEAVY.teacher
      : RATE_LIMIT_POLICIES.AI_HEAVY.admin;
  if (!max) {
    return {
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: Date.now(),
      limit: Number.POSITIVE_INFINITY,
      retryAfter: 0,
      backend: "memory" as const,
      scope: "instance" as const,
      namespace: "ai",
    };
  }

  const tenantKey = input.schoolId ? `${input.schoolId}:${input.userId}` : input.userId;
  return checkRateLimit(`${input.role}:${tenantKey}:${input.endpoint}`, {
    windowMs: RATE_LIMIT_POLICIES.AI_HEAVY.windowMs,
    limit: max,
    namespace: "ai",
  });
}
