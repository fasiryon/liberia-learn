# Hardening Wave 1A

## What changed

- Replaced the old rate limiter with a backend abstraction in `lib/rateLimit.ts`.
- Added `MemoryBackend` with a one-time warning that it is not production-safe.
- Added `UpstashBackend` using `@upstash/ratelimit` and `@upstash/redis`.
- Added backend auto-selection based on:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Added environment-aware backend selection so tests and builds always force `MemoryBackend`.
- Moved Upstash client creation to lazy first-use initialization instead of module-load time.
- Added build-safe guards so rate limiting does not trigger network work during static evaluation.
- Added named policy tiers in `RATE_LIMIT_POLICIES`.
- Updated rate-limited routes to use named policies instead of inline magic numbers.
- Standardized 429 responses to:
  - `error: "Too many requests"`
  - `retryAfter: number`
- Standardized rate-limit headers on rate-limited routes:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
  - `Retry-After`
- Added distributed limiter tests in `__tests__/rateLimit.distributed.test.ts`.

## Production-ready status

- Code path for distributed rate limiting: ready
- Distributed limiting active in this repo by default: no
- Wave 1A production-ready right now: no

This wave is only production-ready after real Upstash credentials are configured in the deployment environment. Test and build stability are now fixed, but distributed protection is still environment-dependent.

## External setup still required

- Upstash Redis:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

Without those variables, the application falls back to the in-memory limiter and remains instance-local only.

## Known limitations

- In-memory fallback is not safe for multi-instance or horizontally scaled deployments.
- Current test coverage proves backend selection, memory behavior, and header contract, but does not perform a live Upstash integration test.
- Browser and API clients now receive standard headers, but rate-limit accuracy across instances depends entirely on Upstash being configured.
- Test runs intentionally bypass external Redis even if credentials are present, to keep the suite deterministic and free of external dependencies.

## Production truth

- Distributed limiting ACTIVE: no
- Why not: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not configured in the current environment, so the backend selector uses `MemoryBackend`.
