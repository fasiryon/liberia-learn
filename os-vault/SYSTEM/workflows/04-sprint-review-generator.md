# Workflow: Sprint Review Generator
# Trigger: Manual QUEUE drop — SPRINT-REVIEW-[sprint-number].md
# Output: GENERATED/reports/YYYY-MM-DD-sprint-[N]-review.md

## Instructions for Claude

You are closing a sprint and generating the official review document.
First, read `SYSTEM/CLAUDE.md`.
Then read all daily notes from the sprint period in `06-DAILY-NOTES/`.
Then read `02-PROJECTS/LiberiaLearn/overview.md`.
Then read the triggering QUEUE file for the sprint number and date range.

LiberiaLearn sprint context:
- Sprints 1–16C are complete (history in CLAUDE.md)
- Current sprint numbering follows the phase system (sprint N or phase M.N)
- Test count is tracked per sprint — delta matters
- Deployment is Vercel auto-deploy on git push to main

Look for patterns in daily notes:
- DONE: entries = completed work
- BLOCKED: entries = impediments
- SHIPPED: entries = deployed items
- RECEIVED: entries = revenue/milestones
- DECISION: entries = architectural or product decisions made

Generate a sprint review with this structure:

---
# Sprint [N] Review — {DATE RANGE}

## What Was Committed
[List commitments from the sprint planning — if not found, note "not documented"]

## What Was Delivered
[Every DONE: entry, grouped by category: features / fixes / infrastructure / tests / documentation]

## What Was NOT Delivered
[Committed items not found in DONE: entries — with honest reason]

## Velocity
**Completed items:** [count]
**Blocked items:** [count and average days blocked]
**Carry-over to next sprint:** [list]

## Technical Health
**Tests at sprint start:** [from previous sprint review or daily notes]
**Tests at sprint end:** [from latest daily note]
**New debt introduced:** [HACK/TODO items added this sprint]
**Debt resolved:** [HACK/TODO items closed this sprint]
**Migrations added:** [count — additive only, or note if destructive]

## Deployment Record
**Deployments this sprint:** [SHIPPED: entries or git commit messages]
**Incidents:** [any production issues from Sentry mentions]
**Rollbacks:** [any]

## Blockers Analysis
[Every BLOCKED: entry with: what it was, how long it lasted, how it was resolved]

## What the Sprint Tells Us
[One paragraph: the honest narrative — what went well, what didn't, what to change]

## Next Sprint Recommendations
**Carry over:** [items]
**New priorities based on this sprint:** [items]
**Process change to make:** [one specific change]

---
*Generated: {TIMESTAMP} | Review before sharing with stakeholders*
---

Save to GENERATED/reports/. Also append a one-line summary to 05-REVIEWS/weekly/ for this period.
Log the write to SYSTEM/logs/operations.md.
