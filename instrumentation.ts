import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, SENTRY_IGNORE_ERRORS } from "@/lib/sentry";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === "production" && Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
      tracesSampleRate: 0.1,
      ignoreErrors: SENTRY_IGNORE_ERRORS,
      beforeSend(event) {
        return scrubSentryEvent(event);
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === "production" && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      tracesSampleRate: 0.1,
      ignoreErrors: SENTRY_IGNORE_ERRORS,
      beforeSend(event) {
        return scrubSentryEvent(event);
      },
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
