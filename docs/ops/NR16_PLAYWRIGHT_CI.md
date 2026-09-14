# NR-16 production browser gate

Implementation is pending certification. NR-16 and Phase 5 Integrity/QA Phase 6
remain open until the merged main production run and full release gate pass.
This does not close the national-launch Phase 6 or any external gate.

## Authorities

- `playwright.config.ts` is the only configuration. Existing local PWA runs use
  `npm run test:e2e:pwa`. The former audit configuration is selected with
  `PLAYWRIGHT_AUDIT=1 npx playwright test` in this same configuration.
- `.github/workflows/playwright-production.yml` runs for every push to `main`
  and supports manual dispatch on main. It runs `npx playwright test` with
  `PLAYWRIGHT_PRODUCTION=1`, selecting only the NR-16 smoke.
- Repository variable `PLAYWRIGHT_BASE_URL` must equal the code-reviewed
  canonical origin, `https://liberia-learn.vercel.app`. Production mode rejects
  every other hostname, port, path, credential, or protocol, so a mistaken
  variable cannot receive the test credentials.
- GitHub repository secrets `E2E_DEMO_STUDENT_EMAIL` and
  `E2E_DEMO_STUDENT_PASSWORD` use the existing approved student identity from
  `DEMO_ACCESS.md`. Missing credentials fail config validation, never skip.
- The normal credentials login is used. No token signing, database credentials,
  privileged role, or test-only authorization bypass is introduced.

## Scope and evidence

The smoke checks public app rendering, manifest and worker assets, anonymous
protected-route denial, real student login, dashboard rendering, student role
and tenant-bearing session, self-scoped mastery reads under spoofed query
parameters, and admin route denial. Query tampering checks session scoping;
it is not a comprehensive cross-tenant penetration test.

The production suite never navigates to learner progress or lesson pages.
Progress GET can synchronize badge awards. Dashboard navigation prefetch is
suppressed so unused linked pages cannot execute server work. Browser writes
other than the real credentials callback are blocked and fail the test.
Once credentials enter the login form, cross-origin requests are also blocked
and fail the test so a compromised page cannot transmit them to another host.
Workers are blocked in the production browser context so they cannot bypass
that request guard. Production worker/manifest assets are checked over HTTP;
the separate existing local PWA gate exercises real worker lifecycle behavior.
The auth rate-limit counter still operates normally. No seeding, student data
writes, notification delivery, provider actions, or settings updates are used.

The production deployment's build-time `X-Deployment-Sha` and
`X-Deployment-Environment: production` headers come from Vercel's system
environment. Preview builds do not emit either header. Because GitHub and
Vercel start independently after a main push, readiness checks wait up to ten
minutes for the canonical origin to serve the workflow SHA. Stale runs are
cancelled when a newer main SHA arrives, and the smoke rechecks deployment
identity after its authenticated assertions so one run cannot mix revisions.
Unavailability fails the infrastructure step separately from browser assertions.
No browser retries, fixed assertion sleeps, or continue-on-error are used.

Videos, traces, screenshots, and retained test output are disabled for production
because they can capture credentials or learner/session data. Job logs retain
static scenario names and sanitized assertion failures. No API response bodies
or session objects are included in test assertion diagnostics.

## Certification record

- Implementation PR: pending
- Exact PR-head validation: pending
- Merged main SHA and production workflow run: pending
- Full gate, local real-browser PWA, Runtime Gate, GitGuardian: pending
- Phase 6 close and canonical execution-state update: pending evidence

NR-17 remains NOT STARTED. Load proof, external penetration test, and live
reviewer activation remain separate authorization gates.
