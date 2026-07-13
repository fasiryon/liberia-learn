# LiberiaLearn Fine-Tuning Pipeline

SFT pipeline that fine-tunes a small model (gpt-4o-mini) on LiberiaLearn's
human-approved lessons, so lesson generation runs cheaper and more consistently
than prompting a general model. DPO (grading alignment) is phase 2 on the same
harness.

## Why fine-tune here
We already own the asset fine-tuning needs: **~5,905 human-approved lessons**
(they passed the quality gate and human review). That is a proprietary SFT gold
set. The value is twofold:

1. **Prompt reduction (the real cost win).** The base model needs a large
   curriculum system prompt (thousands of tokens) on every generation. A model
   fine-tuned on the lesson format runs with a ~20-token system prompt, so input
   tokens per generation drop sharply. Note: fine-tuned gpt-4o-mini *inference*
   is ~2x the base per-token rate, so the win comes from the shorter prompt and
   more consistent structure, not the per-token price. The eval measures the
   real delta honestly.
2. **Consistency.** The model internalizes the required lesson structure, so
   fewer quality-gate rejections and re-generations.

## The pipeline (3 steps)

**1. Export the dataset** (read-only, pooler):
```
npx dotenv -e .env.production -- npx tsx scripts/finetune/export-sft-dataset.ts \
  [--limit 500] [--grades 4,5,6] [--subjects MATH,SCIENCE] [--val-ratio 0.1]
```
Writes `scripts/finetune/data/{sft-train.jsonl, sft-val.jsonl, manifest.json}`.
JSONL is OpenAI chat FT format: system (short) / user (grade+subject+title+objectives) / assistant (approved `payload.body`).

**2. Submit the training job** (GATED - dry run by default, no spend):
```
# dry run: prints the cost estimate, submits nothing
npx dotenv -e .env.production -- npx tsx scripts/finetune/submit-finetune.ts
# actually train:
npx dotenv -e .env.production -- npx tsx scripts/finetune/submit-finetune.ts --confirm
```
Writes `scripts/finetune/data/ft-job.json` with the fine-tuned model id.

**3. Evaluate base vs fine-tuned**:
```
npx dotenv -e .env.production -- npx tsx scripts/finetune/eval-compare.ts \
  --ft-model ft:gpt-4o-mini-...:... [--limit 20]
```
Generates a lesson with each model from held-out specs, scores quality, and
reports quality / cost / latency and the FT win rate.

## Cost model
gpt-4o-mini fine-tuning training is ~$3.00 per 1M training tokens, billed per
epoch (default 3). The exporter and submit script both print the estimate before
any spend.

Verified run (2026-07-10, read-only): 60 approved G4-6 MATH/SCIENCE lessons ->
54 train / 6 val, ~67k train tokens, **~$0.61** estimated (3 epochs). Full corpus
(~5,900 lessons) would be a larger but still modest one-time cost.

### Verified end-to-end (minus paid trigger) - 2026-07-13
Ran the full OpenAI integration path against the live API using the 60-lesson
G4-6 MATH/SCIENCE export (54 train examples), stopping short of the paid
`fineTuning.jobs.create` call:

- **Auth** - `OPENAI_API_KEY` pulled fresh from Vercel production env, `.trim()`
  applied (carry-forward rule 4); no CRLF/whitespace found. `client.models.list()`
  succeeded (123 models visible). PASS.
- **Upload** - `files.create({ purpose: "fine-tune" })` on the 54-example train
  file. PASS - file id `file-6j12N41JeRruLKxSk5HpAp`.
- **Retrieve** - `files.retrieve()` returned `status: "processed"` on the first
  poll (~5s, well under the 30-60s expected window for a file this small). PASS.
- **Delete** - `files.delete()` returned `{ deleted: true }`. PASS.
- Total wall time for auth+upload+retrieve+delete: ~5.1s. No rate limits, no
  unexpected error shapes. `getOpenAIClientOrNull()` in `lib/ai/openaiClient.ts`
  does not itself `.trim()` the key - relies on the caller/env being clean.
  The live pulled key had no whitespace, so this did not surface as a bug here,
  but it is a latent landmine if a future Vercel env write reintroduces CRLF.
  The only remaining step to a real fine-tuned model is `--confirm` on
  `scripts/finetune/submit-finetune.ts`, which is a paid call and stays gated.

## Wiring the fine-tuned model into production
Add the fine-tuned model id behind a feature flag and route to it via
`routedCompletion` (it already supports `modelOverride` for OpenAI). A/B log
base vs FT quality + cost in production before switching the default.

## Phase 2 - DPO (grading alignment)
Reuse this harness with a preference-pair builder over `GradedSubmission` +
teacher grade overrides (chosen = teacher-corrected, rejected = original AI
grade). Same eval structure, different objective.

## Interview talking points (honest)
- Proprietary domain dataset (approved Liberian curriculum) + a real cost
  motivation + an eval harness to prove it + a router to ship it = a complete
  applied fine-tuning story.
- The value is prompt reduction + consistency, not a cheaper per-token rate.
  Being precise about that is the "explain the tradeoff" signal.
- Pipeline is built and verified end-to-end; the paid training run is a single
  gated command (deliberately not auto-run).

## Files
- `lib/finetune/datasetBuilder.ts` - SFT example builder, dedup, split, cost estimate (tested)
- `lib/finetune/score.ts` - lesson quality proxy for the eval (tested)
- `lib/finetune/evalCompare.ts` - base-vs-FT aggregation (tested)
- `scripts/finetune/{export-sft-dataset,submit-finetune,eval-compare}.ts` - runners
