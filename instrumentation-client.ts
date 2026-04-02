import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, SENTRY_IGNORE_ERRORS } from "@/lib/sentry";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  ignoreErrors: SENTRY_IGNORE_ERRORS,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
