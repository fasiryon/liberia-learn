import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, SENTRY_IGNORE_ERRORS } from "@/lib/sentry";
import { assertProductionEnv } from "@/lib/startup-checks";

function initRuntimeSentry(dsn: string) {
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    tracesSampleRate: 0.1,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}

export async function register() {
  // Crash loudly on cold start if required env vars are missing in production.
  assertProductionEnv();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "";
    if (dsn) {
      initRuntimeSentry(dsn);
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";
    if (dsn) {
      initRuntimeSentry(dsn);
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
