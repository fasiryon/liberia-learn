# Hardening Wave 1C

## What Changed

- Replaced the prompt registry's simple key-template map with an authoritative registry API in `lib/ai/promptRegistry.ts`.
- Added `getSystemPrompt(key)`, `buildPrompt(key, context)`, and `getPromptMetadata(key)`.
- Added placeholder enforcement so governed prompts fail fast when required context is missing.
- Migrated these AI paths to the registry:
  - `student.tutor.system`
  - `teacher.assist.system`
  - `teacher.grading.system`
  - `teacher.assignment-tutor.system`
  - `placement.question.system`
- Kept curriculum generation on the approved dynamic path by registering `lesson.deep` as an approved dynamic base prompt and leaving runtime composition inside `lib/ai/curriculum-factory.ts`.
- Updated the admin prompts route to expose prompt metadata only: key, version, hash, preview, createdAt, placeholder list, and dynamic-approval status.

## Production-Ready

- Prompt metadata governance: yes
- Prompt hashing/version visibility: yes
- Placeholder enforcement for governed prompts: yes
- Curriculum prompt centralization: partially by design

## External Setup Still Required

- No external infrastructure is required for prompt registry governance itself.
- Overall AI behavior still depends on the configured model/provider stack and any observability/rate-limit infrastructure from prior waves.

## Known Limitations

- `lesson.deep` remains an approved dynamic prompt because curriculum generation still appends schema, delivery-profile, lab, tone, and depth blocks at runtime.
- The admin prompt route intentionally returns previews only and does not expose full prompt text.
