# Command: Build or refresh the LiberiaLearn operating-system vault

Use this command only when the user explicitly asks to build or refresh
`os-vault/`. It does not run during ordinary repository work.

## Boundaries

- Follow `AGENTS.md` and `docs/agents/CORE_AGENT_RULES.md`.
- Preserve existing vault content and user-authored notes.
- Do not inspect secrets, mutate external systems, or infer live status from
  stale documentation.
- Do not send generated communications. Mark them for human review.

## Targeted discovery

Read only what is needed for the requested vault output:

1. `package.json` and the relevant configuration file for stack metadata.
2. `AGENTS.md` and the matching route in
   `docs/agents/CONTEXT_ROUTING.md`.
3. Existing vault files being created or refreshed.
4. Specific source, schema, workflow, or documentation files needed to verify
   a field in the output.

Use file lists and focused searches before opening large files. Do not read the
entire repository, all Markdown, all source files, all migrations, or the full
schema unless the requested artifact genuinely requires that exact scope.

## Build or refresh

- Create only missing directories and requested artifacts under `os-vault/`.
- Update facts from repository evidence and label unknown or externally owned
  facts as `Needs human input`.
- Keep recurring workflow prompts short. Each prompt should name its trigger,
  minimal inputs, output path, approval boundary, and expected output shape.
- Put domain detail in a linked supporting file rather than repeating it across
  workflows.
- Log material automated writes in `os-vault/SYSTEM/logs/operations.md` when
  that log exists.

## Validation and report

- Verify every referenced path exists or is clearly marked as a future output.
- Check generated Markdown or JSON syntax as applicable.
- Run `git diff --check`; do not run the application test suite.
- Report files created or changed, evidence sources, unresolved human inputs,
  and any approval-gated next step.
