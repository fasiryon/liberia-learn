# Environments

| Environment | DEMO_MODE | VERCEL_ENV | Demo hints | Reset |
|---|---|---|---|---|
| Production | false | production | No | No |
| Staging | true | preview | Yes | Yes |
| Development | any | - | Yes | Yes |

## Detection

LiberiaLearn resolves runtime environment through `lib/environment.ts`.

- `development`: `NODE_ENV=development`
- `demo`: `DEMO_MODE=true`
- `staging`: `VERCEL_ENV=preview`
- `production`: everything else

## Guardrails

- Demo credentials render only in `demo` and `development`.
- Demo reset and platform demo simulation routes return `403` in `production` and `staging`.
- Production login remains free of seeded credentials and demo-only helper content.
