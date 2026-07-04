# PHASE 4A — Hybrid Lesson Media (hero + inline illustrations)

Visual scaffolding for lessons: AI illustrations for concrete/visual subjects,
curated real photography for civic/cultural/health subjects, nothing for
abstract math/grammar/logic.

## Content categorization (5,905 approved lessons)

| Category | K-3 | 4-8 | 9-12 | Total | Strategy |
|---|---|---|---|---|---|
| VISUAL | 187 | 430 | 791 | **1,408** | AI illustration (Fal.ai Flux schnell) |
| PHOTO | 358 | 986 | 549 | **1,893** | Curated Unsplash / Pexels ($0) |
| ABSTRACT | 380 | 1,538 | 686 | **2,604** | No media |

Categorization is deterministic (`lib/media/categorize.ts`): coarse subject +
title-keyword refinement (health/nutrition science → PHOTO; geography/history
structures → VISUAL).

## Cost model

- Fal Flux schnell ≈ **$0.003/image** (conservative). 1,408 heroes ≈ **$4.22**;
  with full inline (cap 3/lesson on qualifying VISUAL science lessons) the
  ceiling is still well under the **$30 cap**. Hard stop at **$28** in the batch.
- Curated photos: **$0** (Unsplash/Pexels free commercial tiers, attribution).

## Provider choice

**Fal.ai Flux schnell** (`https://fal.run/fal-ai/flux/schnell`) — cleanest HTTP
API, reliable, ~$0.003/image. Chosen over Together (cheaper but rate-limit
friction) and AI Gateway (Flux availability varies).

## Environment variables

| Var | Purpose |
|---|---|
| `FAL_KEY` | Fal.ai `id:secret` key (VISUAL generation) |
| `UNSPLASH_ACCESS_KEY` | Unsplash API access key (PHOTO) |
| `PEXELS_API_KEY` | Pexels API key (PHOTO) |
| `MEDIA_VISION_QA` | `1` to enable paid vision QA gate (default off) |
| `MEDIA_VISION_MODEL` | vision model for QA (default `gpt-4o-mini`) |

## Running the batch

```bash
# PHOTO subjects (free): CIVICS is 100% PHOTO
npx dotenv -e .env.production -e .env.local -- \
  npx tsx scripts/generate-lesson-media.ts --subjects CIVICS --limit 40

# VISUAL subjects (needs Fal balance): heroes first, then full inline
npx dotenv -e .env.production -e .env.local -- \
  npx tsx scripts/generate-lesson-media.ts --subjects SCIENCE,BIOLOGY,PHYSICS,CHEMISTRY --limit 100
```

Flags: `--subjects`, `--grades`, `--limit`, `--heroes-only`, `--dry-run`,
`--force`. Idempotent (skips GENERATED/CURATED/SKIPPED unless `--force`);
rejections logged to `scripts/data/media-rejections.json`.

## Known blockers / operational notes

1. **Fal account balance** — VISUAL generation is fully code-complete and the
   key authenticates, but the Fal account is balance-locked
   (`403 Exhausted balance`). Top up at fal.ai/dashboard/billing (a few dollars
   covers the whole corpus), then run the VISUAL batch above. Until then, all
   1,408 VISUAL lessons remain `PENDING`.
2. **Photo-provider rate limits** — Unsplash demo tier is 50 req/hr; Pexels is
   200 req/hr. The batch queries both per lesson, so the 1,893 PHOTO lessons
   must be run in throttled chunks (or after promoting the Unsplash app to
   production tier, 5,000/hr). Run PHOTO in `--limit` batches spaced over time.
3. **Vision QA cost** — off by default. Prompt-side negative guidance
   (no text / no people) is the first line of defense; enable `MEDIA_VISION_QA=1`
   for a paid backstop on a subject that shows quality problems.

## Doc B (future work)

- Abstract math lessons could benefit from *mathematical diagrams* (function
  plots, geometry figures) generated deterministically (not via image models).
  Separate work — not attempted here.
- Inline illustrations are planned from body prose (`lib/media/inlinePlan.ts`);
  once `visualAssetSpecs` is populated by the content pipeline, inline subjects
  and positions could be sourced from there for higher precision.
