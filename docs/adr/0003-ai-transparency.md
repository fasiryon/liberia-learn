# ADR 0003 — AI Transparency and Teacher Override

## Status
Accepted

## Context
LiberiaLearn uses AI for curriculum/lesson generation and instructional assistance. AI must not act as a black box in education.

## Decision
All AI outputs must be:
- explainable ("why")
- overrideable (teacher can edit/reject)
- audited (inputs, outputs, versions logged)
- measurable (accept/reject telemetry)

AI features must be feature-flagged and degrade gracefully.

## Consequences
- Additional UI and logging requirements for AI features
- Prompt/template/schema versioning becomes mandatory
- Better trust, safer national adoption

## Alternatives Considered
- Opaque AI suggestions (rejected: low trust, high risk)
- Fully autonomous AI grading/decisions (restricted: must be human-governed)