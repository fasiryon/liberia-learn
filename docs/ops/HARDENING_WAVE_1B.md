# Hardening Wave 1B

## What changed

- Moved server and edge Sentry registration into `app/instrumentation.ts` and kept the root `instrumentation.ts` as a compatibility re-export.
- Kept browser Sentry wiring in `instrumentation-client.ts` and made activation depend strictly on DSN presence.
- Updated `app/global-error.tsx` to capture browser boundary failures through Sentry instead of plain console logging.
- Tightened `lib/errors/apiErrorHandler.ts` so 5xx responses emit structured logs, include a request ID, attach `X-Request-Id`, and call `Sentry.captureException`.
- Upgraded `lib/logger.ts` to structured JSON with simple PII scrubbing and optional request IDs.
- Switched `lib/logging/requestLogger.ts` to the shared logger.
- Replaced remaining `console.log` operational paths in `lib/` and `app/api/` with the shared logger.
- Standardized several noisy best-effort AI and queue fallback paths onto structured warn/error logging.

## Production-ready status

- Structured logging: ready
- App/browser/server Sentry wiring: code-ready
- Worker Sentry wiring: code-ready
- Wave 1B production-ready right now: no

This wave is only production-ready after Sentry DSNs are configured in the deployment environment.

## External setup still required

- `SENTRY_DSN` for server and worker error export
- `NEXT_PUBLIC_SENTRY_DSN` for browser error export
- Optional source map upload settings:
  - `SENTRY_AUTH_TOKEN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`

## Known limitations

- Without DSNs, structured logs still work but Sentry capture is inactive.
- Worker errors are only exported when the separate worker process runs with `SENTRY_DSN` configured.
- This wave does not add a managed external log sink; logs still rely on platform collection of stdout/stderr.
