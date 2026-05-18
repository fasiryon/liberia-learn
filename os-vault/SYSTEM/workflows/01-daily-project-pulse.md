# Workflow: Daily Project Pulse
# Trigger: Every day at 6:00 AM (WAT — UTC+1)
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
**Version:** 1.0.0 (post-release hardening active)
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
