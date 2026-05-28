# NR-14 Audio Pipeline Log

> Sprint: NR-14 — National Audio Pipeline  
> Date started: 2026-05-28  
> Status: **IN PROGRESS**  
> Gate: G1-G6 core subjects (MATH/SCIENCE/LITERACY) ≥ 50% audio coverage

---

## ElevenLabs Plan

| Field | Value |
|---|---|
| API Key location | `ELEVENLABS_API_KEY` in Vercel + `.env.local` |
| Model | `eleven_turbo_v2` (fastest + cheapest) |
| Max chars/request | 4,800 (hard cap: 5,000) |
| Voice | Rachel (`21m00Tcm4TlvDq8ikWAM`) |
| Est. cost/lesson | ~$0.0014 (4,800 chars × $0.0003/1k) |

> **Note**: The `.env.local` key does not have `user_read` permission — quota
> cannot be checked via API. Check the dashboard directly:
> https://elevenlabs.io/app/subscription

---

## Baseline Audit (2026-05-28)

Run: `npx dotenv -e .env.production -- npx tsx scripts/audio-coverage-audit.ts`

```
=== NR-14 AUDIO COVERAGE AUDIT ===

       MATH     SCI      LIT      ENG      SOC_STU  CIVICS   CS       ENGRG
G1       ✗        ✗        ✗        ✗        ✗        ✗        ✗        ✗
G2       ✗        ✗        ✗        ✗        ✗        ✗        ✗        ✗
G3       ✗        ✗        ✗        ✗        ✗        ✗        ✗        ✗
G4       ✗        ✗        ✗        ✗        ✗        ✗        ✗        ✗
G5      48%⚠     38%⚠     55%      89%       ✗       27%⚠      ✗        ✗
G6       ✗        ✗        ✗        ✗        ✗        ✗        ✗        ✗
G7       ✗        ✗        ✗        ✗        ✗        ✗        ✗        ✗
...

Overall audio coverage: 284/4,856 (6%)
Remaining: 4,572 lessons need audio

=== PRIORITY 1 (MATH/SCIENCE/LITERACY G1-G6) ===
131/938 (14%) — Gate: ≥50% to close NR-14
✗ NR-14 GATE: 36% to go (need ~336 more Priority 1 lessons narrated)
```

**Per-subject breakdown:**

| Subject | Approved | With Audio | Coverage |
|---|---|---|---|
| MATH | 676 | 43 | 6% |
| SCIENCE | 659 | 42 | 6% |
| LITERACY | 692 | 46 | 7% |
| ENGLISH | 535 | 142 | 27% |
| SOCIAL_STUDIES | 911 | 0 | 0% |
| CIVICS | 621 | 11 | 2% |
| COMPUTER_SCIENCE | 408 | 0 | 0% |
| ENGINEERING_FOUNDATIONS | 354 | 0 | 0% |

---

## Required Environment Variables

The audio generation script requires:
- `ELEVENLABS_API_KEY` — in `.env.local` ✓
- `DATABASE_URL` / `DIRECT_URL` — in `.env.production` ✓
- `SUPABASE_URL` — **NOT in local env** (Vercel only)
- `SUPABASE_SERVICE_ROLE_KEY` — **NOT in local env** (Vercel only)

Supabase project URL (derivable from DB URL):
`https://bnphuinpvgpmebcsvmsp.supabase.co`

### To enable local generation — add to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://bnphuinpvgpmebcsvmsp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard → Settings → API>
```

### Run command (once env is complete):
```bash
npx dotenv -e .env.production -e .env.local -- \
  npx tsx scripts/generate-lesson-audio.ts \
  --subject MATH --grade G1 --limit 40
```

---

## Priority Order

### Priority 1 — Core subjects, lower grades (pilot schools) — **DO FIRST**
`MATH G1-G6`, `SCIENCE G1-G6`, `LITERACY G1-G6`  
~938 lessons × 4,800 chars = **~4.5M chars** total

### Priority 2 — Core subjects, upper grades
`MATH G7-G12`, `SCIENCE G7-G12`, `LITERACY G7-G12`

### Priority 3 — Secondary subjects all grades
`ENGLISH`, `SOCIAL_STUDIES`, `CIVICS`

### Priority 4 — New subjects
`COMPUTER_SCIENCE`, `ENGINEERING_FOUNDATIONS`

---

## Generation Schedule

Run **outside school hours**: Mon-Fri 15:00+ GMT, weekends anytime.  
Batch size: **40-50 lessons per run** (monitor quota in ElevenLabs dashboard).

### Priority 1 run commands:
```bash
# MATH G1-G6 (one run per grade, ~40 lessons each)
npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject MATH --grade G1 --limit 40
npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject MATH --grade G2 --limit 40
npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject MATH --grade G3 --limit 40
npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject MATH --grade G4 --limit 40
npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject MATH --grade G5 --limit 40
npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject MATH --grade G6 --limit 40

# SCIENCE G1-G6
npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject SCIENCE --grade G1 --limit 40
# ... repeat G2-G6

# LITERACY G1-G6
npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-audio.ts --subject LITERACY --grade G1 --limit 40
# ... repeat G2-G6
```

After each subject (or after 6 grades), run the audit:
```bash
npx dotenv -e .env.production -- npx tsx scripts/audio-coverage-audit.ts
```

---

## Run Log

| Date | Subject | Grades | Lessons Narrated | Chars Used | Notes |
|---|---|---|---|---|---|
| — | — | — | — | — | Pipeline not yet started (Supabase key needed) |

---

## NR-14 Gate Status

Gate condition: **Priority 1 (MATH/SCIENCE/LITERACY G1-G6) ≥ 50% audio coverage**

| Date | P1 Coverage | Gate |
|---|---|---|
| 2026-05-28 (baseline) | 14% (131/938) | ✗ OPEN |

---

## Audio Coverage Grid — History

### 2026-05-28 (baseline)
```
Overall: 284/4,856 (6%) — 4,572 remaining
Priority 1: 131/938 (14%)
```
