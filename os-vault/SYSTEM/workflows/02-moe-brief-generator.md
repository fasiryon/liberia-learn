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
**What is complete:** [Specific features/milestones — be concrete, use numbers]
**What is in progress:** [With realistic completion timeline]
**What changed from the plan:** [Be honest — MOE values transparency]
**Pilot readiness status:** [Red / Yellow / Green with one-sentence reason]

## Metrics to Present
**Platform version:** 1.0.0 (released 2026-03-01)
**Test coverage:** 363 test files, 2712+ tests passing
**MOE standard coverage:** 94% (50/53 standard codes with content)
**Audit gate status:** Gate 1 passed; Gate 2 passed; Gate 3 certified
**Key capabilities ready:** Multi-tenant isolation, AI curriculum generation, governance exports,
  offline mode (service worker + IndexedDB), guardian SMS notifications, live class sessions,
  national MOE oversight portal (5 read-only routes), disaster recovery runbook

## Suggested Agenda (3 items)
1. [Most critical business item]
2. Platform readiness and technical progress update
3. Pilot school selection criteria and next steps timeline

## Key Points to Make
- Platform has been production-ready since v1.0.0 (2026-03-01)
- 53 MOE curriculum standards aligned; 94% standard coverage
- National oversight portal live: MOE officials can view aggregate data without school PII
- Offline-first design: works on 2G and intermittent connectivity (service worker + sync)
- [Any additional point from the triggering QUEUE file]

## Things NOT to say
- No specific deployment dates without sprint confirmation
- No cost figures without finance review
- No data privacy commitments beyond what is already documented in governance docs
- Do not promise customization features not in the current sprint plan

## Questions to Expect
- What is the timeline for school onboarding?
- How is student data protected?
- Can MOE officials access individual student records?
  → Answer: No — MOE portal shows only aggregate national/district data, zero PII
- What happens when connectivity is lost?
  → Answer: Offline-first design; lessons cached; sync resumes when connection returns
- [Additional questions based on communications history]

---
*Generated: {TIMESTAMP} | REVIEW BEFORE USE — do not send without human approval*
---

Save the file. Flag for human review. Log the write to SYSTEM/logs/operations.md.
