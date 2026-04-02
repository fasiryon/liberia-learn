import * as Sentry from "@sentry/node";
import { scrubSentryEvent, SENTRY_IGNORE_ERRORS } from "@/lib/sentry";

let initialized = false;

export function initWorkerSentry() {
  if (initialized) {
    return;
  }

  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: Boolean(process.env.SENTRY_DSN),
    tracesSampleRate: 0.1,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });

  initialized = true;
}

export { Sentry };
