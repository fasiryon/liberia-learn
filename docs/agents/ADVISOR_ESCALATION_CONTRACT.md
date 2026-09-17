# Advisor and parallel-work escalation contract

Load this contract only for schema/migration work, explicitly gated sprints, or
work that is likely to require parallel execution. Universal boundaries live
in `CORE_AGENT_RULES.md`.

## Execution mode

- Use one executor by default.
- Use subagents only for independent parallel work or specialized review whose
  benefit exceeds coordination cost. Do not delegate tiny reads, edits, or
  routine reasoning.
- When parallelizing, give each worker a narrow scope and deliverable. The main
  executor owns synthesis and validation.

## Stop and request a decision

Stop only when the next action would:

1. Change a production-used schema or cross an explicit migration gate.
2. Mutate staging or production, require unavailable real credentials, or
   increase paid-resource spend.
3. Resolve a material architecture, security, privacy, child-safety,
   curriculum-governance, or educational-authority conflict.
4. Break an explicitly documented compatibility contract or named sprint gate.
5. Perform a destructive shared-worktree or history operation.

Ordinary implementation mistakes, local test/type/build failures, normal code
or schema defects, and routine conflicts in an isolated branch are not stop
conditions. Diagnose, fix, and rerun the affected checks.

Record the reason and the human decision when an escalation occurs. A named
model or advisor in an older document means the human decision owner when that
model is unavailable; never proceed silently through a named gate.

## Domain notes

- Guardian identity verification, phone changes, multi-household behavior,
  safeguarding escalation, and per-guardian cost accounting remain explicit
  review points when that workflow is changed.
- Large governed curriculum generation may be parallelized by grade and
  subject, but publication and approval remain human-governed.
