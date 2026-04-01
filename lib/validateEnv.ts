/**
 * lib/validateEnv.ts
 * Validates required environment variables at build/startup time.
 * Called from next.config.js so missing vars fail fast before deployment.
 */

export function validateEnv(): void {
  const required = [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "OPENAI_API_KEY",
    "AT_API_KEY",
  ];

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  // Warn on recommended but optional vars
  const recommended = ["SENTRY_DSN", "AT_USERNAME"];
  for (const k of recommended) {
    if (!process.env[k]) {
      console.warn(`[ENV] Recommended env var not set: ${k}`);
    }
  }
}
