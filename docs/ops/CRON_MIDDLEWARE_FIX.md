# Cron execution: three stacked bugs, found 2026-07-15

STATUS: **Bugs 1 and 2 fixed and gated (tsc/tests/build); pending deploy and
live verification of a real end-to-end success (bug 3 was never actually a
separate bug - see below).**

## What was actually broken

No cron job in this system has ever successfully completed via Vercel's real
scheduled invocation, for almost the entire life of the deployed app. Three
independent bugs stacked on top of each other, each fully masking the ones
behind it - flipping `AGENT_CRON_ENABLED`/`AGENT_OPS_SENTINEL_ENABLED` before
this investigation would have looked like "the crons still aren't running"
with no visibility into why, because the first bug alone was sufficient to
explain 100% of the symptom.

### Bug 1 — `middleware.ts` had no `/api/cron` exclusion (fixed, commit `56bc5ff`)

`middleware.ts`'s global auth gate (`getToken()` against a NextAuth session)
applied to every path except an explicit bypass list - which never included
`/api/cron/` or `/api/crons/`. A cron invocation carries only
`Authorization: Bearer <CRON_SECRET>`, never a session cookie, so
`getToken()` returned `null` and middleware itself returned 401 before the
request ever reached the route file. Confirmed via production runtime logs:
every cron route, every invocation, 401 at the `edge-middleware` layer.
`middleware.ts` has never excluded these paths since it was introduced
(`1b2ba4f`) - not a recent regression.

Fix: added `/api/cron/` and `/api/crons/` to the middleware bypass list.
Verified safe first - all 24 route.ts files under those two prefixes
independently check `CRON_SECRET` themselves, so nothing loses its only auth
layer.

### Bug 2 — 18 of 23 cron routes only exported `POST`, Vercel Cron sends `GET`

Fixing bug 1 let requests reach the route handlers for the first time -
which immediately surfaced this: Vercel's Cron Jobs scheduler always
invokes via `GET`. Next.js's App Router auto-405s any route missing the
requested method. 18 of 23 real cron routes only exported `POST`
(matching how e.g. Ops Sentinel's `retryCron` re-invokes a route via
`fetch(..., { method: "POST" })` - a caller-side convention that never
matched what Vercel itself actually sends).

Fix: appended `export const GET = POST;` to all 14 real, reachable
POST-only routes (excluded the 5 `/api/cron/autonomous/*` routes - already
unreachable regardless, since `vercel.json` points at
`/api/admin/ops/cron/autonomous/*`, a path with no matching route file; a
separate, already-tracked, non-blocking cleanup item). Confirmed two of the
14 (`process-audio-generation`, `process-textbook-generation`) already
handle a missing/empty body gracefully (`req.json().catch(() => ({}))`), so
aliasing GET is safe for them too - a GET request never carries a body.

### Bug 3 — `echo.md` missing from the serverless bundle (fixed)

With bugs 1 and 2 fixed, `agents-tick` and `ops-sentinel` (the two routes
that already exported both `GET`/`POST`) still 500'd:
`ENOENT: .../lib/agents/prompts/echo.md`. `loadPromptFile()`
(`lib/agents/prompts.ts`) reads prompt files at runtime via
`readFileSync(new URL(relativePath, import.meta.url))` - a pattern Next's
automatic output-file-tracing (`@vercel/nft`) failed to statically resolve
for at least this one file, so `echo.md` never made it into the deployed
function bundle. Any agent-platform cron route that transitively imports
`lib/agents/bootstrap` (which eagerly loads every prompt file) hit this.

Fix: `next.config.js` `experimental.outputFileTracingIncludes: { "/*":
["./lib/agents/prompts/**/*.md"] }` - force-includes the whole prompts
directory in every route's bundle, rather than enumerating routes/files one
at a time (guards against the next prompt file added hitting the same gap).

## Verification status

- tsc, full test suite (3975 tests), and build all pass with both fixes.
- Not yet verified: a real, live, post-deploy 200 + heartbeat for any of
  `agents-tick`/`check-dlq`/`check-ai-budget` after this second deploy -
  update this doc once confirmed.
- 3 routes (`guardian-weekly-digest`, `rebuild-leaderboards`,
  `refresh-demo-schedule`) were GET-compatible and bootstrap-free even
  before this fix - only blocked by bug 1. Worth checking whether
  `refresh-demo-schedule` (previously flagged broken - see
  `project_demo_refresh_cron` memory) finally succeeds on its next real
  midnight run now that bug 1 is fixed.
- Worth checking separately: has `nightly-backup` ever actually produced a
  real backup? It hit bug 1 (then bug 2) on every attempt like everything
  else - Doc B's B5 ("database restore has not been test-restored") may
  have a more fundamental precondition problem than originally scoped.
