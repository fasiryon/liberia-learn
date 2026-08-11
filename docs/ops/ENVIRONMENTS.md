# Environments

| Environment | DEMO_MODE | VERCEL_ENV | Demo hints | Reset |
|---|---|---|---|---|
| Production | false | production | No | No |
| Staging | false | preview or staging | No | No |
| Development | any | - | Yes | Yes |

## Detection

LiberiaLearn resolves runtime environment through `lib/environment.ts`.

- `development`: `NODE_ENV=development`
- `demo`: `DEMO_MODE=true`
- `staging`: `VERCEL_ENV=preview` or a Vercel custom environment named
  `staging`
- `production`: everything else

## Guardrails

- Demo credentials render only in `demo` and `development`.
- Demo reset and platform demo simulation routes return `403` in `production` and `staging`.
- Production login remains free of seeded credentials and demo-only helper content.
- Staging cold starts fail if `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, or
  `NEXT_PUBLIC_SUPABASE_URL` resolves to the known production Supabase project.
- `STAGING_SUPABASE_PROJECT_REF` is required for Vercel Preview and custom
  staging deployments. It is a non-secret identifier and must differ from the
  production project identifier.
