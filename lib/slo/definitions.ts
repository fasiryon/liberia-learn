export const SLO_TARGETS = {
  LOGIN_SUCCESS_RATE: 0.995,
  TUTOR_RESPONSE_SUCCESS: 0.95,
  ASSIGNMENT_SUBMIT_SUCCESS: 0.99,
  EXPORT_GENERATION_SUCCESS: 0.98,
  DB_QUERY_P95_MS: 500,
  AI_RESPONSE_P95_MS: 8000,
} as const;

export type SloService = "login" | "tutor" | "submit" | "export";
export type SloSummaryStatus = "healthy" | "degraded" | "critical";

export const SLO_WINDOW_HOURS = 24;
