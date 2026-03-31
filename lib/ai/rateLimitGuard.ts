import { checkRateLimit } from "@/lib/rateLimit";
import type { SessionUser } from "@/lib/auth";

const ONE_HOUR_MS = 60 * 60 * 1000;

const AI_ROLE_LIMITS: Partial<Record<SessionUser["role"], number>> = {
  STUDENT: 20,
  TEACHER: 50,
  ADMIN: 100,
  DISTRICT_ADMIN: 100,
  MOE_OFFICIAL: 100,
};

export function checkAiRateLimit(input: {
  userId: string;
  role: SessionUser["role"];
  endpoint: string;
}) {
  const max = AI_ROLE_LIMITS[input.role];
  if (!max) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, resetAt: Date.now() };
  }

  return checkRateLimit(`ai:${input.role}:${input.userId}:${input.endpoint}`, {
    windowMs: ONE_HOUR_MS,
    max,
  });
}
