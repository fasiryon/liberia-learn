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
- `ENABLE_AI_ASSIGNMENT_GENERATION`
- `ENABLE_DELIVERY_PROFILE`
- `ENABLE_TEXTBOOK_COMPILER`

This keeps local and production builds truthful: AI providers are not treated as globally required when all AI features remain disabled.

## Recommended but optional

Warnings are emitted when these are unset:

- Observability: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`
- Notifications: `RESEND_API_KEY`, `EMAIL_FROM`, `AT_API_KEY`, `AT_USERNAME`

If any of `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, or `SENTRY_PROJECT` are set, all three should be set together for source-map upload consistency.

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

## Related files

- `next.config.js`
- `lib/validateEnv.shared.js`
- `.env.example`
