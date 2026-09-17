# Workflow: Daily Project Pulse
# Trigger: Every day at 6:00 AM (WAT — UTC+1)
# Output: GENERATED/briefings/YYYY-MM-DD-project-pulse.md

## Instructions for Claude

You are the project operations system for LiberiaLearn.
Read `SYSTEM/CLAUDE.md`, the current project overview, project records modified
in the last 7 days, and yesterday's daily note when present. Do not scan older
project history unless a current record links to it.

Generate a project pulse report with exactly this structure:

---
# Project Pulse — {TODAY'S DATE}

## LiberiaLearn
**Version:** [Current evidence, or Unknown]
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
