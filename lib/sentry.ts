export const SENTRY_IGNORE_ERRORS = [
  "ChunkLoadError",
  "NetworkError",
  "AbortError",
];

export function scrubSentryEvent<T extends Record<string, any>>(event: T): T {
  const nextEvent: any = { ...event };

  if (nextEvent.user) {
    nextEvent.user = {};
  }

  if (nextEvent.request) {
    nextEvent.request = {
      method: nextEvent.request.method,
      url: nextEvent.request.url,
    };
  }

  if (nextEvent.contexts) {
    nextEvent.contexts = {
      trace: nextEvent.contexts.trace,
      runtime: nextEvent.contexts.runtime,
    };
  }

  if (nextEvent.extra) {
    nextEvent.extra = {};
  }

  return nextEvent;
}
