// Called from instrumentation.ts register() so it fires on every cold start.
// Hard-fails immediately if critical env vars are absent in production.

const REQUIRED_PROD_VARS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
  "BLOB_READ_WRITE_TOKEN",
];

export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED_PROD_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`[Startup] Missing required env vars: ${missing.join(", ")}`);
  }
}
