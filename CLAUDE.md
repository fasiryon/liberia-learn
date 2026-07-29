# LiberiaLearn Repository Context

LiberiaLearn is a national-scale education platform. This file is the root
entry point for resuming work.

## Canonical reading order

Read these files before selecting or changing work:

1. `AGENTS.md`
2. `docs/roadmaps/NATIONAL_ROLLOUT_EXECUTION_PLAN.md`
3. `docs/roadmaps/CURRENT_EXECUTION_STATE.md`
4. `docs/agents/ADVISOR_ESCALATION_CONTRACT.md`

`docs/roadmaps/MASTER_EXECUTION_PLAN.md`, `rules.md`, and `SPEC.md` are
historical references. They are superseded for live execution and must not be
used to select the next sprint.

## Resume discipline

- Start from the short `Resume here` block at the top of
  `CURRENT_EXECUTION_STATE.md`.
- For national rollout work, execute only the first sprint marked `PENDING` in
  `NATIONAL_ROLLOUT_EXECUTION_PLAN.md`.
- Do not skip sprints.
- Stop at the union of the standing escalation contract and the selected
  sprint's named escalation points.
- Re-derive at least one concrete success claim from live state before
  accepting any reported gate as passed.
- Run no more than one sprint per unattended cycle, then stop and report.
- Unattended work commits only to a dedicated branch, never directly to
  `main`. A human reviews and merges.

The unattended loop driver described in project handoff notes is not currently
built. Do not claim that pending work is executing automatically.

## Mandatory code gate

1. `npx prisma generate`
2. `npx tsc --noEmit`
3. `npx vitest run`
4. `npm run build`

Stop on a code failure. Never weaken RBAC, tenant isolation, audit logging, or
cost controls to pass a gate.

## Release constraints

- `AGENT_TEACHING_RUNTIME_ENABLED` stays disabled in production until a
  deliberate release decision.
- Teaching Runtime Whisper persistence is verified, but real-device push
  delivery must be verified with an active subscription before release.
- Check current provider funding and pricing before paid generation. In
  particular, independently verify ElevenLabs balance and pricing before audio
  spend.
