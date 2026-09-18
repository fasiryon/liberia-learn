# Queue Processing Rules

Drop a .md file into QUEUE/ with one of these prefixes:

| Prefix | Output folder | Purpose |
|--------|--------------|---------|
| RESEARCH- | GENERATED/briefings/ | Research brief |
| DRAFT- | GENERATED/drafts/ | Content draft |
| AUDIT- | GENERATED/audits/ | Audit report |
| SPRINT-REVIEW- | GENERATED/reviews/ | Sprint review |
| BRIEF-MOE- | GENERATED/briefings/ | MOE document |

Files without a recognised prefix land in GENERATED/misc/.

Files are renamed _DONE.md on success or _FAILED.md on error.

## Context Inputs

Queue jobs run without filesystem or web tools. The daemon always attaches the
matching workflow prompt and the triggering request. It also attaches the
route's standard inputs (for example, the MOE overview and communications for
an MOE brief). List every additional source the job must inspect under a
`## Context Inputs` heading in the queue file:

```md
## Context Inputs
- `docs/architecture/SECURITY.md`
- `app/api/example/route.ts`
```

Paths are repository-relative. Absolute paths, traversal, secrets, credentials,
`.env*`, `.git`, and `node_modules` are rejected. Each file and request has a
bounded size and file count; omitted or missing sources are declared to the
model and must be reported as `Unknown`.

Security audits must enumerate the code and configuration files in scope.
Sprint reviews should enumerate the sprint record and any daily notes outside
the automatically attached vault notes. Research jobs may enumerate existing
research, while claims requiring live web verification remain `Unknown` in the
daemon workflow.
