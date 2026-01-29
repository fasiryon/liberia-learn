@'
# Lesson Quality Framework (Tiered)

## Level A — Required (Hard Validation)
Pipeline cannot proceed without:
- Units: >= 1
- Lessons per unit: >= 1
- Objectives per lesson: >= 3
- Activities per lesson: >= 2 (must include >= 1 PRACTICE)
- Assessments per lesson: >= 1 with >= 5 questions
- Per activity: duration_minutes (10–45), offline_capable, instructions.student+teacher, differentiation, materials
- Per question: correct_answer, explanation, >= 2 hints; rubric required for SHORT_ANSWER / OPEN_RESPONSE
- Localization: >= 3 Liberian examples; must include money (LD) + geography/community reference
- Enums: valid values only

## Level B — Quality (Soft Gate → REPAIR / Score Penalty)
Governance scores and repairs if missing:
- misconceptions + teacher_moves (>=2 each)
- common_errors + remediation_hints
- vocabulary (5–10 terms, simple definitions)
- materials alternatives
- accessibility supports (low literacy, hearing, vision)
- answer keys + rubric coverage

## Level C — Production Standard (Future Hard Gate)
Only enforce after Level B is consistently met:
- spiral review
- mastery tracking per objective
- multi-day pacing
- standards mapping
- multilingual scaffolding (en-LR + Koloqua)
'@ | Set-Content -Encoding UTF8 .\docs\internal\requirements\lesson-quality-framework.md
