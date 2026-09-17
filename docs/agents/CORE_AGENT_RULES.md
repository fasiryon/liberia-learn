# LiberiaLearn agent rules

These rules apply to every repository task. Load additional guidance only
through `CONTEXT_ROUTING.md`.

## Safety and authority

- Preserve RBAC, tenant isolation, audit logging, cost controls, and child-data
  privacy. Client or device input cannot assert canonical educational state.
- Governed systems and authorized humans decide consequential educational
  outcomes. LLMs may recommend or draft; they do not approve, publish, grade,
  or make safeguarding decisions by themselves.
- Do not fabricate test, deployment, production, staging, curriculum, or MOE
  evidence. Repository and live evidence outrank narrative claims.

## Worktree and external boundaries

- Inspect `git status` before editing and preserve unrelated or shared changes.
- Do not use destructive history or worktree operations without explicit
  authorization. Unattended work uses an isolated branch and never commits
  directly to `main`.
- Do not mutate production or staging, use unavailable credentials, send
  external communications, or increase paid-resource spend without explicit
  authorization.
- Routine local fixes, focused reruns, and ordinary merge-conflict resolution
  in an isolated branch may proceed without approval.

## Work method

- Prefer targeted reads and focused searches. Summarize a large or unknown file
  only when that saves context.
- Work as one executor by default. Use a subagent only when parallel work or
  specialized review materially improves the result.
- Use the configured default model unless a task has a documented quality,
  latency, or cost reason to route differently. Do not pin model versions in
  general repository instructions.
- State assumptions that affect scope, and report evidence for completion.

## Validation

- During editing, run the smallest relevant focused checks. Use
  `npm run validate:changed` after a coherent edit when code is involved.
- Run related tests once the change is stable. Reserve the full gate
  (`npx prisma generate`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`)
  for merge, certification, CI, or staging/release decisions unless the task
  explicitly requires it.
- Stop for a code failure only when it remains after reasonable local diagnosis
  and focused repair, or when it reveals a gated safety or authority conflict.
