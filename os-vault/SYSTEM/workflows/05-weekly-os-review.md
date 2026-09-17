# Workflow: Weekly Operating System Review
# Trigger: Every Sunday at 8:00 PM (WAT — UTC+1)
# Output: GENERATED/reports/YYYY-MM-DD-weekly-review.md

## Instructions for Claude

You are reviewing the entire week and synthesizing it into a single, honest document.
Read `SYSTEM/CLAUDE.md`, daily notes and generated artifacts from this week,
the current overview for each active project, and this week's entries in
`SYSTEM/logs/operations.md`. Do not open records outside the week unless a
current item references them.

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
**Phase progress:** [What moved in current sprint/phase]
**Open items resolved:** [count]
**New open items:** [count]
**Test coverage delta:** [sprint start vs sprint end test count]
**Deployment health:** [any issues this week — check Sentry or daily notes]
**MOE standard coverage:** [any movement on ACTION-2, ACTION-4, ACTION-5 gaps]

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
**Revenue events this week:** [RECEIVED: entries from daily notes]
**Notable expenses:** [any AI/TTS/infrastructure costs worth noting]

## Three Priorities for Next Week
1. **[Most leveraged action]** — because [specific reason]
2. **[Second priority]** — because [specific reason]
3. **[Third priority]** — because [specific reason]

## One Personal Insight
[One honest observation about how you worked this week — not what you did, but how]

## Monday Morning Action
**First thing Monday:** [Single specific action, not a category]
**Update CLAUDE.md Weekly Focus to:**
```
**Week of:** [Next Monday's date]
**Top priority:** [One thing]
**Secondary:** [One thing]
**Blocked on:** [What's blocking]
**Shipping this week:** [What goes out]
```

---
*Generated: {TIMESTAMP} | Automated weekly synthesis*
---

Save to GENERATED/reports/ AND copy to 05-REVIEWS/weekly/[week-of-date].md.
Update the Weekly Focus section in SYSTEM/CLAUDE.md with the suggested new focus.
Log all writes to SYSTEM/logs/operations.md.
