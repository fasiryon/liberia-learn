# Workflow: Research Queue Processor
# Trigger: New file dropped in QUEUE/ matching RESEARCH-*.md
# Output: GENERATED/briefings/YYYY-MM-DD-research-[topic].md

## Instructions for Claude

A research request has been queued. Process it fully.
First, read `SYSTEM/CLAUDE.md` for business context.
Then read the triggering QUEUE file completely — it contains the research request and guiding questions.
Then search the vault for any existing research on this topic in `04-RESEARCH/`.

LiberiaLearn priority research areas:
- EdTech policy and platforms in West Africa / Sub-Saharan Africa
- Liberia Ministry of Education curriculum framework and recent initiatives
- Government SaaS procurement in emerging markets (especially West Africa)
- Offline-first education technology approaches and case studies
- AI in education for low-connectivity environments (AI4ED)
- Liberia infrastructure: internet penetration, device penetration, electricity access
- National LMS deployments in African countries (Kenya, Rwanda, Ghana comparisons)
- WAEC (West African Examinations Council) integration requirements
- School fee structures and public school funding in Liberia
- Africa's Talking vs Twilio for SMS reach in Liberia

Generate a research brief:

---
# Research Brief — [TOPIC]
**Requested:** {QUEUE FILE DATE} | **Completed:** {TODAY'S DATE}

## Bottom Line Up Front
[2-3 sentences: what the most important finding is and what it means for LiberiaLearn specifically]

## Key Findings

### Finding 1: [Title]
[Finding with source. What it means for LiberiaLearn specifically.]

### Finding 2: [Title]
[Finding with source. What it means for LiberiaLearn specifically.]

### Finding 3: [Title]
[Finding with source. What it means for LiberiaLearn specifically.]

[Continue for all significant findings — max 7]

## What This Means for LiberiaLearn
**Opportunity:** [Specific opportunity this research reveals]
**Risk:** [Specific risk this research reveals]
**Recommended action:** [One concrete next step]

## What This Means for Liberia Data Engine
[If relevant — how this connects to the Data Engine opportunity]

## Sources
[List all sources consulted with dates]

## Related Vault Research
[Link to any related files already in 04-RESEARCH/]

## Follow-Up Questions
[Questions this research raised that should be investigated next — drop as new RESEARCH files]

---
*Generated: {TIMESTAMP} | Research processor workflow*
---

Save to GENERATED/briefings/ AND copy to 04-RESEARCH/[relevant-subfolder]/[YYYY-MM-DD-topic].md.
Log the write to SYSTEM/logs/operations.md.
