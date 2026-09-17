# Workflow: MOE Pre-Meeting Brief Generator
# Trigger: N8N webhook OR manual QUEUE drop — BRIEF-MOE-[date].md
# Output: GENERATED/briefings/YYYY-MM-DD-MOE-brief.md

## Instructions for Claude

You are preparing a government stakeholder briefing for a Ministry of Education meeting.
Read `SYSTEM/CLAUDE.md`, `01-CLIENTS/MOE/overview.md`, and the triggering QUEUE
file. Read communications since the previous meeting, newest first. Open older
communications only when a current record references them.

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
**Platform version:** [Current evidence, or Unknown]
**Validation status:** [Current evidence with date, or Unknown]
**MOE standard coverage:** [Current governed evidence, or Unknown]
**Audit gate status:** [Current signed or recorded evidence, or Unknown]
**Key capabilities ready:** [Only capabilities supported by current evidence]

## Suggested Agenda (3 items)
1. [Most critical business item]
2. Platform readiness and technical progress update
3. Pilot school selection criteria and next steps timeline

## Key Points to Make
- [Most important evidence-backed readiness point]
- [Current curriculum-alignment evidence, if verified]
- [National oversight capability, only if current evidence confirms aggregate-only output]
- [Offline behavior, only if current evidence confirms the claimed conditions]
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
  → Answer from current access-control and response-shape evidence; never expose PII
- What happens when connectivity is lost?
  → Answer from current offline-delivery and synchronization evidence
- [Additional questions based on communications history]

---
*Generated: {TIMESTAMP} | REVIEW BEFORE USE — do not send without human approval*
---

Save the file. Flag for human review. Log the write to SYSTEM/logs/operations.md.
