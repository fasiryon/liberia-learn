# LiberiaLearn Environment Variables

Last updated: 2026-04-01

LiberiaLearn validates environment variables during `next build` through `next.config.js`. The validator is authoritative for core runtime requirements and conditionally requires provider secrets when the related AI features are enabled.

## Required for every deployment

| Group | Variables | Notes |
|---|---|---|
| Core app | `DATABASE_URL`, `DIRECT_URL` | Runtime pooler URL plus direct migration URL |
| Auth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | Required for NextAuth session and callback handling |

If any of these are missing, `npm run build` fails immediately.

## Required only when specific features are enabled

`OPENAI_API_KEY` becomes required when any of these flags are `true`:

- `AI_TUTOR_ENABLED`
- `AI_TEACHER_ASSIST_ENABLED`
- `ENABLE_RAG_TUTOR`
- `ENABLE_TEACHER_GENERATION`
- `ENABLE_ASSIGNMENT_TUTOR`
- `ENABLE_AI_GRADING_ASSIST`
- `AI_INTERVENTIONS_AI_ENHANCED`
- `AI_DROPOUT_RISK_ENABLED`
- `ENABLE_CURRICULUM_OPTIMIZATION_AI`
- `ENABLE_DELIVERY_PROFILE`

This keeps local and production builds truthful: AI providers are not treated as globally required when all AI features remain disabled.

`ENABLE_AI_ASSIGNMENT_GENERATION` and `ENABLE_TEXTBOOK_COMPILER` do not require `OPENAI_API_KEY` in the current codebase. Both routes are deterministic and operate on existing curriculum data.

When `PRIVILEGED_MFA_ENFORCEMENT_ENABLED=true`, all of these are required:

- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_ISSUER`
- `AUTH0_M2M_CLIENT_ID`
- `AUTH0_M2M_CLIENT_SECRET`

`PRIVILEGED_STEP_UP_MAX_AGE_SECONDS` defaults to 600 and is clamped between
60 and 1800 seconds. Keep enforcement disabled until the P1-C migration is
applied, privileged identities are provisioned in Auth0, the post-login MFA
Action is deployed, and recovery ownership is confirmed. See
`docs/security/PRIVILEGED_MFA_RUNBOOK.md`.

## Recommended but optional

Warnings are emitted when these are unset:

- Observability: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`
- Notifications: `RESEND_API_KEY`, `EMAIL_FROM`, `AT_API_KEY`, `AT_USERNAME`

If any of `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, or `SENTRY_PROJECT` are set, all three should be set together for source-map upload consistency.

Sentry runtime behavior is now explicit:

- Browser capture is active only when `NEXT_PUBLIC_SENTRY_DSN` is set.
- Server and edge capture are active only when `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` is set.
- Worker capture is active only when `SENTRY_DSN` is set.
- Without a DSN, the app still emits structured JSON logs but Sentry is inactive.

## Offline curriculum signing

Offline lesson signing is fail closed unless the three cryptographic values are configured:

- `CONTENT_MANIFEST_PRIVATE_KEY`: server-only RSA private key in PKCS#8 PEM format.
- `CONTENT_MANIFEST_KEY_ID`: deployment-controlled identifier for the active key.
- `NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEY`: matching RSA public key in SPKI PEM format.

The policy-authority envelope also signs:

- `expiresAt`: canonical UTC ISO-8601 timestamp, exactly seven days after the
  persisted authority issue time. A non-revoked statement is not accepted for
  new cache trust or offline serving after this instant. A revoked statement
  remains authoritative after expiry so expiry can never weaken revocation.
- `minClientVersion`: strict `MAJOR.MINOR.PATCH` SemVer with no leading zeros.
  The current browser client must be at least this version; malformed or
  unavailable client versions fail closed. `CONTENT_MANIFEST_MIN_CLIENT_VERSION`
  overrides the default `1.0.0` for newly issued statements.
- `contents`: a stable, lexicographically sorted list of unique content IDs.
  Each entry carries its version and a lowercase 64-hex SHA-256. The hash is
  over canonical JSON for `{contentId, version, metadata, payload, audio}` as
  delivered to the offline cache. Reordering is not semantic; duplicates,
  malformed hashes, and content/hash mismatches are rejected.

The client verifies the signature and these fields before writing or opening
cached curriculum. Legacy manifests that predate these fields remain usable
under their existing signed trust and rollback rules, but their unavailable
policy fields are never treated as trusted and they cannot satisfy new policy
checks. No new issuer emits a legacy manifest.

`NEXT_PUBLIC_CONTENT_MANIFEST_PUBLIC_KEYS`, when set, is a JSON array of
`{keyId, publicKeyPem}` entries. It replaces the legacy single-key lookup;
unknown or removed key IDs fail closed. This preserves Phase C retirement and
rotation behavior. Changing any `NEXT_PUBLIC_*` value requires a rebuild.
Changing the public key requires a rebuild because `NEXT_PUBLIC_*` values are
compiled into the client bundle. Never place the private key in a
`NEXT_PUBLIC_*` variable.

## Canonical env names

Use these names in new deployments:

```bash
# Email
RESEND_API_KEY="re_..."
EMAIL_FROM="LiberiaLearn <noreply@liberialearn.edu.lr>"

# SMS
AT_API_KEY="..."
AT_USERNAME="liberialearn"
AT_ENVIRONMENT="production"
AT_SENDER_ID="LRLEARN"
```

Backward-compatible aliases still accepted by runtime code:

- `RESEND_FROM_EMAIL` for email sender
- `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_USERNAME`, `AFRICA_TALKING_SENDER_ID` for SMS

## Example local setup

```bash
cp .env.example .env.local
```

Minimum local values:

```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-random-secret"
```

Optional local additions for AI work:

```bash
OPENAI_API_KEY="sk-..."
AI_TUTOR_ENABLED="true"
ENABLE_RAG_TUTOR="true"
```

## Production notes

- `DATABASE_URL` should use the pooled Supabase/Prisma runtime URL.
- `DIRECT_URL` should use the direct connection string for migrations only.
- `NEXT_PUBLIC_*` variables are inlined at build time and require a rebuild when changed.
- Server-only `ENABLE_*` flags are read at request time unless they are mirrored into a client-visible `NEXT_PUBLIC_*` variable.

## Current default-on product flags

These flags now default to enabled unless you set them to `"false"`:

- `ENABLE_ADAPTIVE_ENGINE`
- `ENABLE_INTERVENTION_ENGINE`
- `ENABLE_INTERVENTION_WORKFLOW`
- `ENABLE_GUARDIAN_PORTAL`
- `NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL`
- `ENABLE_GUARDIAN_LINKING`
- `ENABLE_GUARDIAN_DASHBOARD`
- `ENABLE_TEXTBOOK_COMPILER`
- `ENABLE_AI_ASSIGNMENT_GENERATION`

## Related files

- `next.config.js`
- `lib/validateEnv.shared.js`
- `.env.example`
