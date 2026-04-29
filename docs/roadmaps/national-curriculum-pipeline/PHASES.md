# LiberiaLearn — Pipeline Phases

## Target State

**180 approved lessons × 88 grade/subject combinations = 15,840 lessons**
(Current: 4,093 approved — 25.7% coverage. Remaining 11,747 need curriculum generation.)

Audio target: every approved lesson has a GENERATED `LessonAudio` row with a Supabase URL.
Textbook target: student + teacher + workbook + assessment PDF per grade/subject per year.

---

## Phase Map

```
Phase 0 ── DONE      Prerequisites
Phase 1 ── IN PROGRESS  G5 ENGLISH Audio
Phase 2 ── READY     G5 ENGLISH Textbooks
Phase 3 ── NEXT      G5 Subject Cluster Audio (LITERACY, MATH, SCIENCE)
Phase 4 ── NEXT      G7 Subject Cluster Audio (CIVICS, MATH, SCIENCE, SS)
Phase 5 ── PLANNED   All remaining audio (3,807 + future lessons)
Phase 6 ── PLANNED   Curriculum generation fill (missing weeks/grades)
Phase 7 ── PLANNED   All textbooks
Phase 8 ── PLANNED   MOE national package
```

---

## Phase 0 — Prerequisites (COMPLETE)

**Goal:** Storage, queue, and admin tooling operational.

| Item                                     | Status   |
|---|---|
| Supabase `lesson-audio` bucket created   | ✓ Done   |
| `SUPABASE_URL` in `.env.local`           | ✓ Done   |
| `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` | ✓ Done |
| `SUPABASE_LESSON_AUDIO_BUCKET=lesson-audio` | ✓ Done |
| `ENABLE_LESSON_AUDIO_GENERATION=true`    | ✓ Done   |
| `lib/audio/audioGenerationQueue.ts`      | ✓ Done   |
| `/api/admin/audio-generation/*` routes   | ✓ Done   |
| `/api/cron/process-audio-generation`     | ✓ Done   |
| `/admin/audio-generation` UI             | ✓ Done   |
| Storage validation (3 files end-to-end)  | ✓ Done   |

---

## Phase 1 — Grade 5 ENGLISH Audio (IN PROGRESS)

**Goal:** 180/180 G5 ENGLISH lessons with GENERATED Supabase audio.

**Current state:** 6 GENERATED, 174 PENDING, 0 FAILED.

**Cost estimate:** 174 × $0.017 = **~$2.96**

**Execution:**
```bash
# Enqueue (already done — 174 rows are PENDING)
# Process in batches via CLI:
npx tsx scripts/process-lesson-audio.ts \
  --grade 5 --subject ENGLISH \
  --limit 10 --approved --provider openai --voice alloy

# Or trigger via admin UI: /admin/audio-generation
# Process Next Batch (3) button — repeat until pending = 0

# Or via cron: POST /api/cron/process-audio-generation
# with Authorization: Bearer $CRON_SECRET
```

**Completion criteria:**
- `getAudioQueueStatus({ grade: 5, subject: 'ENGLISH' })` → `pending: 0, failed: 0, generated: 180`
- Zero `/generated-audio` local paths in storageUrl column
- CLI dry-run returns `inspected: 0`

**Risks:**
- OpenAI TTS rate limits: default 3–5 lessons/batch, ~30 min total for 174 lessons
- Supabase storage RLS: verify service role can write to bucket
- Cost overrun: 174 × $0.017 = $2.96 — trivial, no cap risk

---

## Phase 2 — Grade 5 ENGLISH Textbooks (READY)

**Goal:** Compile and export four textbook formats for G5 ENGLISH.

**Prerequisite:** Phase 1 complete (all audio GENERATED).

**Current state:** `compileTextbook` + `renderTextbookPdfStream` exist and work.
Student edition route is live: `GET /api/admin/curriculum/textbook?gradeLevel=5&subject=ENGLISH`.

**Formats to produce:**

| Format           | Route / Mechanism                              | Status     |
|---|---|---|
| Student textbook | `/api/admin/curriculum/textbook?gradeLevel=5&subject=ENGLISH` | ✓ Route exists |
| Teacher edition  | Same compiler + teacher-specific template      | Needs template |
| Student workbook | Exercises extracted from lesson payload        | Needs extractor |
| Assessment booklet | Assessment lessons compiled separately       | Needs route |

**Execution (student edition — ready now):**
```bash
curl -H "Cookie: <admin-session>" \
  "http://localhost:3000/api/admin/curriculum/textbook?gradeLevel=5&subject=ENGLISH" \
  -o grade5-english-textbook.pdf
```

**Prerequisite for teacher/workbook/assessment:** Sprint to add alternate compilation
modes. See AGENT.md §Textbook Variants for design spec.

**Completion criteria:**
- Four PDF files produced and archived to Supabase `lesson-pdf/` bucket
- File names include academic year: `english-grade5-2026-student.pdf`
- PDFs survive a re-run without content drift (idempotent compilation)

---

## Phase 3 — Grade 5 Subject Cluster Audio (NEXT)

**Goal:** Process audio for G5 LITERACY, G5 MATH, G5 SCIENCE — all STRONG readiness.

**Volume:** ~80–82 missing LessonAudio rows each (audit counts lessons with any row;
actual PENDING will be higher once enqueued).

| Combo       | approvedLessons | missingAudioRows | Est. cost |
|---|---|---|---|
| G5 LITERACY | 46 (of 180 target) | 82  | ~$1.39 |
| G5 MATH     | 81 (of 180 target) | 81  | ~$1.38 |
| G5 SCIENCE  | 83 (of 180 target) | 80  | ~$1.36 |

**Total Phase 3 estimate: ~$4.13**

**Execution per combo:**
```bash
# Step 1: Enqueue
POST /api/admin/audio-generation/enqueue
{ "grade": 5, "subject": "LITERACY", "limit": 200 }

# Step 2: Process in batches
POST /api/admin/audio-generation/process { "limit": 5 }
# Repeat until status.pending = 0

# Step 3: Verify
GET /api/admin/audio-generation/status?grade=5&subject=LITERACY
```

---

## Phase 4 — Grade 7 Subject Cluster Audio (NEXT)

**Goal:** G7 CIVICS, G7 MATH, G7 SCIENCE, G7 SOCIAL_STUDIES — all STRONG readiness.

| Combo            | missingAudioRows | Est. cost |
|---|---|---|
| G7 CIVICS        | 77  | ~$1.31 |
| G7 MATH          | 88  | ~$1.50 |
| G7 SCIENCE       | 75  | ~$1.28 |
| G7 SOCIAL_STUDIES| 76  | ~$1.29 |

**Total Phase 4 estimate: ~$5.38**

**Execution:** Same pattern as Phase 3, substituting grade=7 and subject=*.

---

## Phase 5 — All Remaining Audio (PLANNED)

**Goal:** All 88 grade/subject combinations have GENERATED audio for every approved lesson.

**Volume:** 3,807 lessons with no LessonAudio row + 174 G5 ENGLISH PENDING
= **3,981 lessons total remaining audio work**

**Cost estimate:** 3,981 × $0.017 = **~$67.68 total**

**Execution strategy:**
- Process grade clusters (G5, G7, G3, G10) rather than all at once
- Batch size 5 per cron invocation (Vercel free tier: 5-min cron minimum)
- 3,981 lessons ÷ 5 per batch = ~797 cron invocations
- At 5-min intervals = ~66 hours wall-clock time
- Alternatively: admin manual processing at 10/batch = ~398 invocations

**Grade/subject priority order:**
```
Priority 1 (STRONG, high lesson count):
  G5: ENGLISH, LITERACY, MATH, SCIENCE
  G7: CIVICS, MATH, SCIENCE, SOCIAL_STUDIES
  G3: SCIENCE
  G10: MATH

Priority 2 (PARTIAL, >80 approved lessons):
  G1-12: CIVICS, LITERACY, MATH, PE, SCIENCE, SOCIAL_STUDIES

Priority 3 (PARTIAL, <80 approved lessons — need content generation):
  G1-12: BIOLOGY, CHEMISTRY, GEOGRAPHY, HISTORY, PHYSICS, ECONOMICS
  Special: COMPUTER_SCIENCE, ENGLISH (non-G5)
```

---

## Phase 6 — Curriculum Generation Fill (PLANNED)

**Goal:** Fill missing weeks across all PARTIAL grade/subject combinations.

**Current gap:** 78 of 88 combos are PARTIAL (average 25.7% readiness).
Missing weeks represent **~11,747 lessons** that don't exist yet.

**Approach:**
- Use `scripts/generate-missing-curriculum-content.ts` (exists, untracked)
- Or use `/api/admin/curriculum/generate-full-pack` per grade/subject
- Safety: never overwrite APPROVED lessons — only generate for missing weeks
- Validation: all generated content enters as DRAFT, requires human approval before audio

**Priority order:** Follow Phase 5 priority — fill STRONG combos first to maintain
delivery capability in schools that are already partially operational.

**Volume per combo:** ~100 missing lessons average (varies by current coverage)

**Caution:** This is AI generation — requires editorial review before approval.
Target: 2–3 combos reviewed and approved per sprint.

---

## Phase 7 — All Textbooks (PLANNED)

**Goal:** Student, teacher, workbook, assessment PDFs for all 88 grade/subject combos.

**Prerequisites:** Phase 5 complete (all audio), Phase 6 underway (content fill).

**Strategy:** Compile textbooks only for combos where readiness ≥ 80% (i.e., ≥ 144/180 lessons).
Currently: only G5 ENGLISH meets this bar (100%).

| Format             | Trigger                              | Storage              |
|---|---|---|
| Student textbook   | `/api/admin/curriculum/textbook` (GET) | Supabase `lesson-pdf/` |
| Teacher edition    | Planned endpoint (same compiler)     | Supabase `lesson-pdf/` |
| Workbook           | Planned endpoint                     | Supabase `lesson-pdf/` |
| Assessment booklet | Planned endpoint                     | Supabase `lesson-pdf/` |

**Versioning:** Filenames include academic year: `{subject}-grade{N}-{year}-{format}.pdf`

---

## Phase 8 — MOE National Package (PLANNED)

**Goal:** Produce the national curriculum delivery package for MOE submission.

**Contents:**
1. National curriculum readiness report (per grade/subject coverage)
2. Audio readiness report (GENERATED counts, cost, URLs)
3. Textbook readiness report (PDFs available per grade)
4. MOE export ZIP (all PDFs + metadata manifest)
5. Delivery compliance report (`/api/admin/governance/exports/class-summary`)

**Output format:**
```
moe-national-package-2026/
  manifests/
    curriculum-readiness.json
    audio-readiness.json
    textbook-inventory.json
  textbooks/
    grade-{N}/{subject}/student.pdf
    grade-{N}/{subject}/teacher.pdf
    grade-{N}/{subject}/workbook.pdf
    grade-{N}/{subject}/assessments.pdf
  audio/
    (links to Supabase public URLs — not bundled)
  README.md
```

**Readiness gate:** Phases 5, 6, 7 complete.

---

## Phase Dependencies

```
Phase 0 (Prerequisites)
  └── Phase 1 (G5 ENGLISH Audio)
        └── Phase 2 (G5 ENGLISH Textbooks)
              └── [validate textbook pipeline before Phase 7]

Phase 0
  └── Phase 3 (G5 Cluster Audio)
  └── Phase 4 (G7 Cluster Audio)
  └── Phase 5 (All Audio) — depends on 3 & 4 completion
        └── Phase 7 (All Textbooks) — each combo independently compilable

Phase 6 (Curriculum Fill) — independent, feeds Phase 5 for new lessons
  └── Phase 7 (more complete textbooks)

Phases 5 + 6 + 7 → Phase 8 (MOE Package)
```
