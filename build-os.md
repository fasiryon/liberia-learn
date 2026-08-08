# Command: Build LiberiaLearn Operating System

You are about to build a complete, automated business operating system for this project.
This is a one-time setup command. It will scan the repo, extract real data, and generate
a fully operational Obsidian vault with automation prompts for every recurring workflow.

Do not skip any step. Do not use placeholders. Every file must contain real content.

---

## PHASE 1 — DEEP REPO SCAN

Read every file listed below. Do not generate anything yet. Build an internal picture first.

### 1A — Core Project Files
- `package.json` — name, version, ALL dependencies with versions
- `next.config.js` or `next.config.ts`
- `tsconfig.json`
- `vitest.config.ts` or `jest.config.*`
- `.env.example` — every key name, grouped by service
- `Dockerfile` and `docker-compose.yml` if present
- `README.md` if present
- `CLAUDE.md` if present — absorb everything in it

### 1B — Data Layer
- `prisma/schema.prisma` — FULL schema, every model, every field, every relation, every enum
- Any seed files in `prisma/seed*`

### 1C — Application Structure
- List all folders inside `src/app/` or `app/`
- Read `src/middleware.ts` or `middleware.ts`
- Read ALL files inside `src/lib/` — every utility, every helper
- Read ALL files inside `src/types/` — every type definition
- List all route folders under `src/app/api/` or `app/api/`
- Read any file containing: auth, tenant, rbac, permission, role, session, guard

### 1D — Infrastructure
- ALL files inside `.github/workflows/`
- Any `terraform/`, `cdk/`, or `infrastructure/` directories
- `sentry.*.config.*`

### 1E — Tests
Run: `find . -name "*.test.*" -not -path "*/node_modules/*" | head -60`
Run: `find . -name "*.spec.*" -not -path "*/node_modules/*" | head -60`
Count total test files. List test folder names.

### 1F — Hidden Knowledge
Run: `grep -r "TODO\|FIXME\|HACK\|@todo\|// temp\|// BUG\|BROKEN" src/ --include="*.ts" --include="*.tsx" -l`
For each file found, read it and extract every TODO/FIXME/HACK comment with its file path and line.

Run: `find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*"`
Read every markdown file found.

### 1G — Build Internal Summary
After reading everything, construct this internal object (show it to the user):

```
=== REPO SCAN COMPLETE ===
Project name: [from package.json]
Framework: [Next.js version]
Database: [Prisma + PostgreSQL]
Auth library: [name and version]
Test runner: [vitest/jest] — [exact run command]
Total test files: [count]
Prisma models: [count] — [list all model names]
API route groups: [list all]
CI/CD: [pipeline summary]
Env var count: [count]
TODO/FIXME count: [count]
Existing CLAUDE.md: [yes/no]
=========================
```

Tell the user: "Scan complete. Building your operating system now."

---

## PHASE 2 — BUILD VAULT STRUCTURE

Create the following folder structure at `os-vault/` in the repo root:

```
os-vault/
├── SYSTEM/
│   ├── CLAUDE.md                    ← business constitution
│   ├── logs/
│   │   └── operations.md            ← audit log of all automated writes
│   └── setup/
│       ├── n8n-workflows/           ← N8N JSON export stubs
│       └── setup-guide.md           ← how to wire N8N + Obsidian
├── 01-CLIENTS/
│   └── MOE/                         ← Ministry of Education
│       ├── overview.md
│       └── communications/
├── 02-PROJECTS/
│   ├── LiberiaLearn/
│   │   ├── overview.md
│   │   └── sprints/
│   └── LiberiaDataEngine/
│       └── overview.md
├── 03-OPERATIONS/
│   ├── content/
│   │   └── calendar.md
│   ├── finances/
│   │   ├── revenue-tracker.md
│   │   └── expenses/
│   └── devops/
│       └── deployment-log.md
├── 04-RESEARCH/
│   ├── edtech-africa/
│   └── liberia-infrastructure/
├── 05-REVIEWS/
│   ├── weekly/
│   ├── monthly/
│   └── quarterly/
├── 06-DAILY-NOTES/
│   └── template.md
├── QUEUE/
│   ├── README.md
│   ├── _templates/
│   │   ├── DRAFT-template.md
│   │   ├── RESEARCH-template.md
│   │   ├── AUDIT-template.md
│   │   └── REPORT-template.md
│   └── .gitkeep
└── GENERATED/
    ├── briefings/
    ├── drafts/
    ├── reports/
    ├── communications/
    └── README.md
```

---

## PHASE 3 — WRITE THE BUSINESS CONSTITUTION

Write `os-vault/SYSTEM/CLAUDE.md` using REAL data from the repo scan.
Every field must be populated from what you actually found.

```markdown
# LiberiaLearn — Business Operating System Constitution

> This file is loaded by every automated workflow before taking any action.
> It is the single source of truth for what this business is and how it operates.
> UPDATE: Weekly Focus every Monday. Update Active Phase after each sprint close.

---

## Business Identity

**Product:** LiberiaLearn
**Type:** Multi-tenant, AI-powered Education SaaS
**Mission:** National-scale digital education infrastructure for Liberia
**Primary Client:** Ministry of Education (MOE), Republic of Liberia
**Revenue Model:** Government SaaS contract + school tenant subscriptions
**Stage:** Pre-pilot / Production-ready

---

## Technology Identity

**Stack:**
[Populate from scan — exact framework, ORM, auth library, all key packages with versions]

**AWS Infrastructure:**
- Account: 466568847266
- Region: us-east-1
- Compute: ECS Fargate (containerized)
- Database: RDS PostgreSQL via Prisma
- Queue: SQS FIFO
- Storage: S3 (governance exports, assets)
- CI/CD: GitHub Actions (OIDC — no static keys)
- Monitoring: CloudWatch + SNS + Sentry

**Repository:**
- Test runner: [exact command from scan]
- Total tests: [count from scan]
- Deployment: git push → GitHub Actions → ECR → ECS rolling deploy

---

## Database Models

[List every Prisma model from schema.prisma]
Format per model:
**ModelName** — [one sentence: what this represents in the business domain]
Key fields: [list non-obvious fields]
Relations: [what it connects to]

---

## API Surface

[List every route group from app/api/]
Format: `POST /api/[route]` — [inferred purpose] — [auth: public/tenant/admin]

---

## Active Stakeholders

**Ministry of Education (MOE)**
Role: Primary government client and regulatory body
Status: Pre-pilot engagement
Next action: [Leave blank — user to populate]
Key contacts: [Leave blank — user to populate]
Critical requirements: MOE curriculum alignment, governance exports, audit logs

**School Tenants**
Role: End users of the platform
Status: Platform ready, pending MOE pilot approval
Onboarding model: MOE-coordinated enrollment

---

## Active Projects

**LiberiaLearn (Primary)**
Status: ~98% complete — Phase 4 active
Audit Gate 1: ✅ Passed (516 tests)
Current work: [Infer from TODO/open items found in scan]
Blocking items: [From FIXME/HACK scan]
Next milestone: MOE pilot launch

**Liberia Data Engine**
Status: v1 — national infrastructure intelligence platform
Score: 9.1/10 identified
Gaps: Monetization model, data acquisition plan, GTM pilot strategy
Next action: [Leave blank — user to populate]

---

## Communication Standards

**Technical documentation style:** Precise, structured, no fluff
**MOE communication style:** Formal, government-appropriate, metric-driven
**Stakeholder updates:** Executive summary first, detail second
**Code review comments:** Specific, actionable, reference line numbers

**What we never do:**
- Promise features without sprint capacity confirmation
- Send MOE communications without human review
- Share tenant data across tenant boundaries (ever)
- Deploy without passing the full test suite
- Merge without a deployment checklist review

---

## Financial Framework

**Revenue targets:** [User to populate]
**Current MRR:** [User to populate]
**Key metrics to track:**
- Active school tenants
- Monthly active users (MAU)
- AI generation requests / month
- Infrastructure cost per tenant
- Test coverage percentage

---

## Sprint Operations

**Sprint cadence:** [Infer from repo or leave for user]
**Test command:** [Exact command from scan]
**Deployment command:** git push → pipeline handles the rest
**Pre-deploy checklist:** See QUEUE/_templates/deploy-checklist.md
**Definition of done:** Tests pass + audit gate clear + no P0 open items

---

## Windows/PowerShell Notes

[If PowerShell patterns found in scan, document them here]
**BOM-safe file write:**
```powershell
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
```
**AWS CLI:** Must be added to PATH each new session if not persistent
**Test runner:** Always use `npx vitest run` — not `npm test` alone

---

## Open Items

[Populate from TODO/FIXME scan — every item with file path]
Format: `[ ] FILE:LINE — description`

---

## Operating Rules

1. Never delete vault files. Archive with `_ARCHIVED_YYYYMMDD_` prefix instead.
2. Never send external communications (MOE, stakeholders) without human review and approval.
3. Always date-stamp generated files as `YYYY-MM-DD-filename.md`.
4. Log every automated write to `SYSTEM/logs/operations.md`.
5. When uncertain about a decision: write to GENERATED and flag for review.
6. Escalate to human for: money, MOE commitments, architecture changes, security issues.
7. Never expose tenant data. Any query touching user data must include tenantId scoping.
8. Security audit findings are P0 — nothing ships until they are resolved.

---

## Weekly Focus

> UPDATE THIS EVERY MONDAY MORNING — 2 minutes, maximum impact.
> This weights every automated output toward what actually matters this week.

**Week of:** [Date]
**Top priority:** [One thing]
**Secondary:** [One thing]
**Blocked on:** [What's blocking]
**Shipping this week:** [What goes out]
```

---

## PHASE 4 — WRITE ALL SIX AUTOMATED WORKFLOW PROMPTS

Create these files. Each is a complete, self-contained prompt that N8N will feed to Claude API.
They read SYSTEM/CLAUDE.md first, then do their specific job.

---

### `os-vault/SYSTEM/workflows/01-daily-project-pulse.md`

```markdown
# Workflow: Daily Project Pulse
# Trigger: Every day at 6:00 AM
# Output: GENERATED/briefings/YYYY-MM-DD-project-pulse.md

## Instructions for Claude

You are the project operations system for LiberiaLearn. 
First, read `SYSTEM/CLAUDE.md` completely.
Then read all overview.md files in `02-PROJECTS/`.
Then read all sprint files in `02-PROJECTS/LiberiaLearn/sprints/` from the last 7 days.
Then read yesterday's daily note in `06-DAILY-NOTES/` if it exists.

Generate a project pulse report with exactly this structure:

---
# Project Pulse — {TODAY'S DATE}

## LiberiaLearn
**Phase:** [Current phase from CLAUDE.md]
**Overall status:** [On track / At risk / Blocked]
**Completed since last pulse:** [From yesterday's daily note — DONE: entries]
**Currently in progress:** [Infer from sprint files]
**Blocked items:** [Any BLOCKED: entries from daily notes]
**Next 24h priority:** [Single most important task]
**Days to next milestone:** [Calculate if milestone date exists]

## Liberia Data Engine
**Status:** [From project overview]
**Next action:** [From CLAUDE.md active projects]

## Flags 🚩
[List any project that is: overdue / blocked 3+ days / approaching deadline within 7 days]

## Today's Single Most Important Action
**→ [One specific, concrete action that moves the most critical needle today]**

---
*Generated: {TIMESTAMP} | Source: project-pulse workflow*
---

Save the file. Log the write to SYSTEM/logs/operations.md.
```

---

### `os-vault/SYSTEM/workflows/02-moe-brief-generator.md`

```markdown
# Workflow: MOE Pre-Meeting Brief Generator
# Trigger: N8N webhook OR manual QUEUE drop — BRIEF-MOE-[date].md
# Output: GENERATED/briefings/YYYY-MM-DD-MOE-brief.md

## Instructions for Claude

You are preparing a government stakeholder briefing for a Ministry of Education meeting.
First, read `SYSTEM/CLAUDE.md` completely — especially the MOE stakeholder section.
Then read `01-CLIENTS/MOE/overview.md`.
Then read ALL files in `01-CLIENTS/MOE/communications/` sorted by date, newest first.
Then read the triggering QUEUE file for any specific agenda items requested.

Generate a pre-meeting brief with exactly this structure:

---
# MOE Meeting Brief — {MEETING DATE}

## Relationship Status
**Last contact:** [Date and method from communications log]
**Outstanding commitments:** [What was promised, what was delivered]
**Open items from last meeting:** [List with status]

## LiberiaLearn Progress Since Last Meeting
**What is complete:** [Specific features/milestones — be concrete]
**What is in progress:** [With realistic completion timeline]
**What changed from the plan:** [Be honest — MOE values transparency]
**Pilot readiness status:** [Red / Yellow / Green with one-sentence reason]

## Metrics to Present
**Test coverage:** [From CLAUDE.md]
**Audit status:** [Audit Gate 1 passed — next gate status]
**Platform uptime:** [If logged anywhere]
**AI generation capability:** [Brief description]

## Suggested Agenda (3 items)
1. [Most critical business item]
2. [Technical progress update]
3. [Next steps and timeline confirmation]

## Key Points to Make
- [The single most important thing to communicate]
- [Any risk the MOE should be aware of]
- [What you need from MOE to move forward]

## Things NOT to say
- No specific deployment dates without sprint confirmation
- No cost figures without finance review
- No data privacy commitments beyond what is already documented

## Questions to Expect
- [Based on communications history, what will they ask]
- [Prepare answers for each]

---
*Generated: {TIMESTAMP} | Review before use — do not send without human approval*
---

Save the file. Flag for human review. Log the write.
```

---

### `os-vault/SYSTEM/workflows/03-security-audit-runner.md`

```markdown
# Workflow: Security Audit Runner
# Trigger: Manual QUEUE drop — AUDIT-[scope]-[date].md
# Output: GENERATED/reports/YYYY-MM-DD-security-audit-[scope].md

## Instructions for Claude

You are running a security audit on the LiberiaLearn codebase.
First, read `SYSTEM/CLAUDE.md` — especially the operating rules about tenant isolation.
Read the QUEUE file to determine audit scope: auth / pii / database / infrastructure / full.

Then execute the appropriate audit based on scope:

### AUTH AUDIT
Read all files matching: *auth*, *session*, *jwt*, *middleware*, *guard*, *protect*
Check for:
- [ ] Session tokens properly invalidated on logout
- [ ] Password reset tokens are single-use and expire
- [ ] Auth routes protected against brute force
- [ ] JWT secrets are environment variables, never hardcoded
- [ ] Role checks happen server-side, not client-side only
- [ ] Admin routes inaccessible to non-admin roles
- [ ] MOE admin role properly separated from school admin role

### PII AUDIT  
Read all files that handle user data, logs, or AI prompts.
Check for:
- [ ] Student names/emails never appear in raw Claude API prompts
- [ ] PII not logged to CloudWatch in plain text
- [ ] User data not exposed in error messages
- [ ] Personal data fields in Prisma models properly handled
- [ ] API responses don't leak fields not requested by client
- [ ] GDPR/data residency considerations documented

### DATABASE AUDIT
Read all Prisma queries and API route handlers.
Check for:
- [ ] EVERY query that touches tenant data includes a tenantId WHERE clause
- [ ] No raw SQL queries that could bypass tenant scoping
- [ ] No N+1 queries in list endpoints
- [ ] Sensitive fields (passwords, tokens) never returned in API responses
- [ ] Prisma migrations don't drop data without a backup step
- [ ] Database connection string is an env variable

### INFRASTRUCTURE AUDIT
Read GitHub Actions workflows, Dockerfile, any IaC files.
Check for:
- [ ] No AWS credentials hardcoded anywhere (OIDC only)
- [ ] ECR image scanned for vulnerabilities in pipeline
- [ ] Secrets in GitHub Actions use repository secrets, not plaintext
- [ ] ECS task role follows least-privilege
- [ ] S3 buckets not publicly accessible
- [ ] CloudWatch alarms configured for critical failures
- [ ] Sentry DSN is an environment variable

### Output Format

---
# Security Audit — [SCOPE] — {TODAY'S DATE}

## Executive Summary
**Overall risk level:** [Critical / High / Medium / Low]
**Issues found:** [count by severity]
**Immediate actions required:** [P0 items only]

## Findings

### P0 — Critical (Fix before any deployment)
[List with file path, line number, description, exact fix required]

### P1 — High (Fix within current sprint)
[List with file path, description, recommended fix]

### P2 — Medium (Fix within 2 sprints)
[List with description]

### Passed Checks ✅
[List every check that passed]

## Recommended Next Steps
1. [Immediate action]
2. [This week]
3. [This sprint]

---
*Generated: {TIMESTAMP} | P0 findings require immediate human review*
---

Save file. If P0 findings exist, create a separate GENERATED/briefings/URGENT-[date]-security.md 
with only the P0 items. Log the write.
```

---

### `os-vault/SYSTEM/workflows/04-sprint-review-generator.md`

```markdown
# Workflow: Sprint Review Generator
# Trigger: Manual QUEUE drop — SPRINT-REVIEW-[sprint-number].md
# Output: GENERATED/reports/YYYY-MM-DD-sprint-[N]-review.md

## Instructions for Claude

You are closing a sprint and generating the official review document.
First, read `SYSTEM/CLAUDE.md`.
Then read all daily notes from the sprint period in `06-DAILY-NOTES/`.
Then read `02-PROJECTS/LiberiaLearn/overview.md`.
Then read the triggering QUEUE file for the sprint number and date range.

Look for patterns in daily notes:
- DONE: entries = completed work
- BLOCKED: entries = impediments
- RECEIVED: entries = revenue/milestones
- SHIPPED: entries = deployed items

Generate a sprint review with this structure:

---
# Sprint [N] Review — {DATE RANGE}

## What Was Committed
[List commitments from the sprint planning — if not found, note "not documented"]

## What Was Delivered
[Every DONE: entry, grouped by category: features / fixes / infrastructure / documentation]

## What Was NOT Delivered
[Committed items not found in DONE: entries — with honest reason]

## Velocity
**Completed items:** [count]
**Blocked items:** [count and average days blocked]
**Carry-over to next sprint:** [list]

## Technical Health
**Tests at sprint start:** [if logged]
**Tests at sprint end:** [from latest test run]
**New debt introduced:** [HACK/TODO items added this sprint]
**Debt resolved:** [HACK/TODO items closed this sprint]

## Deployment Record
**Deployments this sprint:** [from deployment log or git commits]
**Incidents:** [any production issues from Sentry mentions in notes]
**Rollbacks:** [any]

## Blockers Analysis
[Every BLOCKED: entry with: what it was, how long it lasted, how it was resolved]

## What the Sprint Tells Us
[One paragraph: the honest narrative of this sprint — what went well, what didn't, what to change]

## Next Sprint Recommendations
**Carry over:** [items]
**New priorities based on this sprint:** [items]
**Process change to make:** [one specific change]

---
*Generated: {TIMESTAMP} | Review before sharing with stakeholders*
---

Save to GENERATED/reports. Also append a one-line summary to 05-REVIEWS/weekly/ for this period.
Log the write.
```

---

### `os-vault/SYSTEM/workflows/05-weekly-os-review.md`

```markdown
# Workflow: Weekly Operating System Review
# Trigger: Every Sunday at 8:00 PM
# Output: GENERATED/reports/YYYY-MM-DD-weekly-review.md

## Instructions for Claude

You are reviewing the entire week and synthesizing it into a single, honest document.
First, read `SYSTEM/CLAUDE.md` — especially the Weekly Focus section.
Then read ALL daily notes from this week in `06-DAILY-NOTES/`.
Then read all GENERATED files created this week (briefings, reports, drafts).
Then read `02-PROJECTS/LiberiaLearn/overview.md` and `02-PROJECTS/LiberiaDataEngine/overview.md`.
Then read `SYSTEM/logs/operations.md` for this week's automated activity.

Generate the weekly review:

---
# Weekly Review — Week of {MONDAY'S DATE}

## Weekly Focus Results
**This week's stated priority was:** [From CLAUDE.md Weekly Focus]
**Achieved:** [Yes / Partially / No — with honest reason]

## What Moved Forward
[Every meaningful progress item, with the specific cause of the progress]

## What Did Not Move
[Every stalled item, with the honest reason — not excuses, diagnosis]

## The Week's Pattern
[One paragraph: what pattern appeared across the week? 
What does the distribution of your time and energy reveal?
What does the gap between planned and actual work tell you?]

## LiberiaLearn Status
**Phase progress:** [What moved in Phase 4]
**Open items resolved:** [count]
**New open items:** [count]
**Test coverage delta:** [if measurable]
**Deployment health:** [any issues this week]

## MOE / Stakeholder Status
**Communications sent:** [count and nature]
**Outstanding items:** [what is pending from MOE]
**Next scheduled touchpoint:** [date if known]

## Automated System Performance
**Workflows that ran this week:** [from operations.md log]
**Workflows that failed or produced poor output:** [honest assessment]
**Queue items submitted:** [count]
**Queue items completed:** [count]

## Financial Pulse
**Revenue events this week:** [RECEIVED: entries]
**Notable expenses:** [any]

## Three Priorities for Next Week
1. **[Most leveraged action]** — because [specific reason]
2. **[Second priority]** — because [specific reason]  
3. **[Third priority]** — because [specific reason]

## One Personal Insight
[One honest observation about how you worked this week — not what you did, but how]

## Monday Morning Action
**First thing Monday:** [Single specific action, not a category]
**Update CLAUDE.md Weekly Focus to:** [Draft the new Weekly Focus section]

---
*Generated: {TIMESTAMP} | Automated weekly synthesis*
---

Save to GENERATED/reports AND copy to 05-REVIEWS/weekly/[week].md.
Update the Weekly Focus section in SYSTEM/CLAUDE.md with the suggested new focus.
Log all writes.
```

---

### `os-vault/SYSTEM/workflows/06-research-processor.md`

```markdown
# Workflow: Research Queue Processor
# Trigger: New file dropped in QUEUE/ matching RESEARCH-*.md
# Output: GENERATED/briefings/YYYY-MM-DD-research-[topic].md

## Instructions for Claude

A research request has been queued. Process it fully.
First, read `SYSTEM/CLAUDE.md` for business context.
Then read the triggering QUEUE file completely — it contains the research request and any guiding questions.
Then search the vault for any existing research on this topic in `04-RESEARCH/`.

Use web search to find current, authoritative information. 
For LiberiaLearn, priority research areas include:
- EdTech policy and platforms in West Africa / Sub-Saharan Africa
- Liberia Ministry of Education initiatives and curriculum
- Government SaaS procurement in emerging markets
- Offline-first education technology approaches
- AI in education for low-connectivity environments
- AWS infrastructure costs for African deployments
- Liberia infrastructure, connectivity, device penetration data

Generate a research brief:

---
# Research Brief — [TOPIC]
**Requested:** {DATE} | **Completed:** {DATE}

## Bottom Line Up Front
[2-3 sentences: what the most important finding is and what it means for LiberiaLearn]

## Key Findings

### Finding 1: [Title]
[Finding with source. What it means for us specifically.]

### Finding 2: [Title]
[Finding with source. What it means for us specifically.]

### Finding 3: [Title]
[Finding with source. What it means for us specifically.]

[Continue for all significant findings]

## What This Means for LiberiaLearn
**Opportunity:** [Specific opportunity this research reveals]
**Risk:** [Specific risk this research reveals]
**Recommended action:** [One concrete next step]

## What This Means for Liberia Data Engine
[If relevant — connection to the Data Engine project]

## Sources
[List all sources consulted]

## Related Vault Research
[Link to any related files already in 04-RESEARCH/]

## Follow-Up Questions
[Questions this research raised that should be investigated next]

---
*Generated: {TIMESTAMP} | Research processor workflow*
---

Save to GENERATED/briefings AND copy to 04-RESEARCH/[relevant-subfolder]/[topic].md.
Log the write.
```

---

## PHASE 5 — WRITE QUEUE TEMPLATES

### `os-vault/QUEUE/README.md`

```markdown
# QUEUE — How to Use

Drop a file here. The system processes it on the next cycle and delivers output to GENERATED/.

## Naming Convention

| File name | What it does |
|---|---|
| `RESEARCH-[topic].md` | Deep research on any topic |
| `DRAFT-[type]-[topic].md` | Generate a document draft |
| `AUDIT-[scope].md` | Run a security audit (auth/pii/database/infrastructure/full) |
| `SPRINT-REVIEW-[N].md` | Close and document a sprint |
| `BRIEF-MOE-[date].md` | Generate MOE meeting brief |
| `DEPLOY-CHECK.md` | Run pre-deployment verification checklist |

## What to Put Inside Each File

**RESEARCH files:** Write your questions. Add any context that helps. 
The more specific the question, the more useful the output.

**DRAFT files:** Write the key points you want included. 
Add any constraints (length, audience, format).

**AUDIT files:** Specify scope. Add any specific concerns to focus on.

**SPRINT-REVIEW files:** Include sprint number, date range, and sprint goals.

## Cycle Time
Files are processed on the next scheduled cycle (or immediately if N8N is watching the folder).
Output lands in `GENERATED/` with today's date prefix.
```

### `os-vault/QUEUE/_templates/DRAFT-template.md`

```markdown
# Draft Request

**Type:** [technical-doc / moe-report / stakeholder-update / changelog / readme / blog]
**Topic:** [specific topic]
**Audience:** [who will read this]
**Length:** [approximate — short/medium/long or word count]
**Tone:** [formal/technical/executive/plain]

## Key Points to Include
- [Point 1]
- [Point 2]
- [Point 3]

## Context
[Any specific context Claude needs — links to relevant vault files, background]

## What Good Looks Like
[One sentence describing what a successful output feels like]
```

### `os-vault/QUEUE/_templates/RESEARCH-template.md`

```markdown
# Research Request

**Topic:** [specific topic]
**Why this matters:** [connection to LiberiaLearn or Data Engine]
**Deadline:** [when you need it]

## Core Questions
1. [Most important question]
2. [Second question]
3. [Third question]

## Context
[What you already know. What you've already read. What gaps you're trying to fill.]

## Output Format Preference
[Summary only / Full brief / Just the sources / Actionable recommendations]
```

### `os-vault/QUEUE/_templates/AUDIT-template.md`

```markdown
# Security Audit Request

**Scope:** [auth / pii / database / infrastructure / full]
**Focus area:** [optional — specific module or concern]
**Priority:** [P0-urgent / scheduled / exploratory]

## Specific Concerns
[Any specific vulnerabilities or patterns you want investigated]

## Context
[Recent changes that might have introduced issues]
[Sprint number or date range to focus on]
```

---

## PHASE 6 — WRITE THE DAILY NOTE TEMPLATE

### `os-vault/06-DAILY-NOTES/template.md`

```markdown
# Daily Note — {{date}}

> Conventions: DONE: / BLOCKED: / SHIPPED: / RECEIVED: / TODO: / DECISION:
> These keywords trigger automated workflow updates. Use them consistently.

---

## Morning Pulse
**Energy level:** [1-5]
**Today's single most important outcome:** 

## Work Log

### LiberiaLearn
- DONE: 
- BLOCKED: 
- TODO: 

### Liberia Data Engine
- DONE: 
- TODO: 

### MOE / Stakeholders
- [Meeting notes, communications, decisions]

### Infrastructure / DevOps
- SHIPPED: 
- [Deployment notes, incidents, fixes]

---

## Revenue & Finance
- RECEIVED: $[amount] — [client] — [description]
- [Other financial notes]

---

## Decisions Made Today
- DECISION: [What was decided] — [Why] — [Trade-off accepted]

---

## Tomorrow's First Action
→ 

## Queue Items for Tonight
[Files to drop in QUEUE/ before sleep — system processes overnight]
-
```

---

## PHASE 7 — WRITE N8N SETUP GUIDE AND WORKFLOW STUBS

### `os-vault/SYSTEM/setup/setup-guide.md`

```markdown
# Operating System Setup Guide

## What You Need
1. **Obsidian** — open `os-vault/` as a vault
2. **N8N** — self-hosted on any always-on server (DigitalOcean $6/mo droplet works)
3. **Anthropic API key** — for automated workflow API calls
4. **Obsidian Smart Connections plugin** — for semantic search within Obsidian

## Step 1 — Obsidian Setup
1. Install Obsidian from obsidian.md
2. Open Obsidian → "Open folder as vault" → select `os-vault/`
3. Install plugins: Smart Connections, Dataview, Calendar
4. In Smart Connections settings, set to use Claude API

## Step 2 — N8N Setup
1. Deploy N8N: `docker run -d -p 5678:5678 n8nio/n8n`
2. Or use N8N Cloud (n8n.io) for managed hosting
3. Add credentials: Anthropic API key, filesystem access to vault path

## Step 3 — Wire the Workflows

Import each workflow from `SYSTEM/setup/n8n-workflows/`.
For each workflow, update:
- `VAULT_PATH` → absolute path to your os-vault/ folder
- `ANTHROPIC_API_KEY` → your key
- Cron schedule → adjust timezone to WAT (West Africa Time, UTC+1)

## Step 4 — Schedules

| Workflow | Schedule | Timezone |
|---|---|---|
| Daily Project Pulse | 6:00 AM daily | WAT (UTC+1) |
| Weekly OS Review | Sunday 8:00 PM | WAT |
| Queue Processor | Every 15 minutes | WAT |
| Monthly Financial | 1st of month, 7:00 AM | WAT |

## Step 5 — First Run
1. Update `SYSTEM/CLAUDE.md` → Weekly Focus section
2. Fill in `01-CLIENTS/MOE/overview.md` with MOE contact details
3. Drop a test file in QUEUE/ → `RESEARCH-liberia-edtech-landscape.md`
4. Confirm output appears in GENERATED/briefings/

## Maintenance
- Every Monday: Update Weekly Focus in SYSTEM/CLAUDE.md (2 minutes)
- Every sprint close: Drop SPRINT-REVIEW-[N].md in QUEUE/
- Every quarter: Read 05-REVIEWS/quarterly/ summary
```

### `os-vault/SYSTEM/setup/n8n-workflows/daily-pulse-workflow.json`

```json
{
  "name": "LiberiaLearn Daily Project Pulse",
  "nodes": [
    {
      "name": "Cron Trigger",
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "triggerTimes": {
          "item": [{ "hour": 6, "minute": 0 }]
        }
      }
    },
    {
      "name": "Read CLAUDE.md",
      "type": "n8n-nodes-base.readBinaryFile",
      "parameters": {
        "filePath": "={{$env.VAULT_PATH}}/SYSTEM/CLAUDE.md"
      }
    },
    {
      "name": "Read Workflow Prompt",
      "type": "n8n-nodes-base.readBinaryFile",
      "parameters": {
        "filePath": "={{$env.VAULT_PATH}}/SYSTEM/workflows/01-daily-project-pulse.md"
      }
    },
    {
      "name": "Call Claude API",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.anthropic.com/v1/messages",
        "method": "POST",
        "headers": {
          "x-api-key": "={{$env.ANTHROPIC_API_KEY}}",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        "body": {
          "model": "claude-sonnet-4-20250514",
          "max_tokens": 2000,
          "system": "={{$node['Read CLAUDE.md'].data}}",
          "messages": [
            {
              "role": "user",
              "content": "={{$node['Read Workflow Prompt'].data}}"
            }
          ]
        }
      }
    },
    {
      "name": "Write Output to Vault",
      "type": "n8n-nodes-base.writeBinaryFile",
      "parameters": {
        "filePath": "={{$env.VAULT_PATH}}/GENERATED/briefings/{{$now.format('YYYY-MM-DD')}}-project-pulse.md",
        "data": "={{$node['Call Claude API'].json.content[0].text}}"
      }
    },
    {
      "name": "Log Operation",
      "type": "n8n-nodes-base.appendToFile",
      "parameters": {
        "filePath": "={{$env.VAULT_PATH}}/SYSTEM/logs/operations.md",
        "data": "\n- {{$now.toISO()}} | daily-pulse | wrote GENERATED/briefings/{{$now.format('YYYY-MM-DD')}}-project-pulse.md"
      }
    }
  ]
}
```

---

## PHASE 8 — WRITE THE OPERATIONS LOG

### `os-vault/SYSTEM/logs/operations.md`

```markdown
# Operations Log

> Every automated write is appended here by the system.
> Format: TIMESTAMP | workflow-name | action taken

## Log

- {TIMESTAMP} | build-os | Initial vault generated from repo scan
```

---

## PHASE 9 — WRITE CLIENT AND PROJECT SEED FILES

### `os-vault/01-CLIENTS/MOE/overview.md`

```markdown
# Ministry of Education — Client Overview

**Country:** Republic of Liberia
**Type:** Government ministry — primary platform client
**Relationship:** Platform built to MOE curriculum and governance standards
**Status:** Pre-pilot engagement

## Key Information
**Primary contact:** [User to populate]
**Ministry website:** [User to populate]
**Curriculum framework:** [Reference to Liberian national curriculum]

## What MOE Needs from LiberiaLearn
- National curriculum alignment in all AI-generated content
- Government-grade audit logs and governance exports
- School-level reporting dashboard
- Offline capability for low-connectivity schools
- Data residency compliance
- Multi-tenant isolation (each school's data is private)

## Our Commitments to MOE
[User to populate — what has been promised in writing]

## Communications History
[Files in communications/ folder — add after each touchpoint]

## Open Items from MOE
[User to populate]
```

### `os-vault/02-PROJECTS/LiberiaLearn/overview.md`

```markdown
# LiberiaLearn — Project Overview

**Type:** Multi-tenant AI education SaaS
**Client:** Ministry of Education, Liberia
**Status:** ~98% complete — Phase 4

## Completion by System
[Infer from repo scan — list major systems and their status]

## Audit Gates
- Gate 1: ✅ Passed — 516 tests
- Gate 2: [Status — to populate]

## Architecture
See: [[System-Overview]] [[AWS-Infrastructure]] [[Auth-and-Tenancy]]

## Current Sprint
See: [[Current-Phase]]

## Technical Debt
[From TODO/FIXME scan in Phase 1]

## Deployment Info
- Pipeline: GitHub Actions → ECR → ECS
- Account: 466568847266 / us-east-1
- Test command: [from scan]
```

---

## PHASE 10 — FINAL CONFIRMATION

After writing every file, output this exact message to the user:

```
╔══════════════════════════════════════════════════════════════╗
║         LIBERIALEARN OPERATING SYSTEM — BUILD COMPLETE       ║
╚══════════════════════════════════════════════════════════════╝

📁 Vault location: os-vault/

FILES CREATED:
[List every file path you wrote, with a 5-word description]

AUTOMATED WORKFLOWS READY:
  01 → Daily Project Pulse          (runs 6AM daily)
  02 → MOE Brief Generator          (on-demand via QUEUE)
  03 → Security Audit Runner        (on-demand via QUEUE)
  04 → Sprint Review Generator      (on-demand via QUEUE)
  05 → Weekly OS Review             (runs Sunday 8PM)
  06 → Research Processor           (on-demand via QUEUE)

IMMEDIATE NEXT STEPS (in order):
  1. Open Obsidian → open os-vault/ as vault
  2. Read os-vault/SYSTEM/CLAUDE.md — fill in the [blank] sections
     (MOE contacts, financial targets, current weekly focus)
  3. Read os-vault/SYSTEM/setup/setup-guide.md — wire N8N
  4. Drop a test research request:
     Create QUEUE/RESEARCH-liberia-edtech-landscape.md and run
     workflow 06 manually to confirm everything works
  5. Update Weekly Focus in SYSTEM/CLAUDE.md every Monday

TOKEN IMPACT:
  Before: Claude re-learns your entire stack every session.
  After:  Paste GENERATED/briefings/[latest]-project-pulse.md
          at session start. Full context in ~300 tokens.

The system runs. You direct it.
```
