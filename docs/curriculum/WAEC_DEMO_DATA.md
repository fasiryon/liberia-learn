# WAEC Prep — Demo Data

> Seeded demonstration data for the WAEC Prep track. Exists so the `/student/waec`
> surface shows a populated, multi-subject dashboard. **This is demo data**, clearly
> labeled, and can be reset at any time. No real student data is touched.

## The demo student

| Field | Value |
|---|---|
| Email | `waec-demo-g11@cha.edu.lr` |
| Password | `WaecDemo!2026` |
| Display name | **WAEC Demo Student (Grade 11)** — the "Demo" label is intentional so anyone (principal, MOE) viewing a surface can tell this is seeded data |
| Grade | 11 |
| School | CHA High Academy |

## What was seeded

Realistic lesson completions across **Math, Physics, Chemistry, English** (Grade 9+
existing tagged lessons only):

- Each covered WAEC syllabus topic receives 3–6 completions on its primary mastery strand.
- Exit-ticket-style scores vary **70–90%**, drift **upward over ~6 weeks** (so the trend
  computation is real), with a minority of strands intentionally flat (steady).
- A small **skip-set of topics is left unassessed per subject** so coverage is realistically
  partial, never 100%:
  - Math: skips Trigonometry, Vectors & Transformation
  - Physics: skips Atomic & Nuclear
  - Chemistry: skips Organic Chemistry
  - English: skips Oral English

## How it flows (NOT hardcoded)

Completions are fed through the **real mastery engine** — `updateMasteryProfile()`, the same
service `completeScheduledLesson` calls — writing `StudentMasteryProfile` rows. Readiness is
**never written**; it is recomputed on read by `lib/waec/readiness.ts` from those profiles.
So readiness %, coverage %, and trend are all **derived**, not set.

## Verified result (production)

```
WAEC Mathematics   88.1%  coverage 84%  trend improving  next: Coordinate Geometry & Calculus
WAEC English       81.6%  coverage 86%  trend improving  next: Comprehension
WAEC Physics       80.6%  coverage 90%  trend improving  next: Interaction of Matter, Space & Time
WAEC Chemistry     90.0%  coverage 84%  trend improving  next: Separation Techniques
WAEC Literature    73.0%  coverage 72%  (incidental — shares LITERACY strands with English)
WAEC Biology       — (take placement)   (not seeded for this student)
WAEC Geography     — (unavailable)      (no mastery strand — deferred)
```

Coverage is partial (72–90%), trends are computed from the seeded score progression, and all
scores originate from the mastery engine.

## Commands

Seed (or re-seed — deterministic):
```
npx dotenv -e .env.production -- npx tsx scripts/seed-waec-demo-mastery.ts
```

Verify:
```
npx dotenv -e .env.production -- npx tsx scripts/verify-waec-readiness.ts --email waec-demo-g11@cha.edu.lr
```

Reset (removes the demo student + its mastery profiles entirely):
```
npx dotenv -e .env.production -- npx tsx scripts/seed-waec-demo-mastery.ts --reset
```
