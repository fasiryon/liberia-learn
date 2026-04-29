# LiberiaLearn — Pipeline Execution Guide

This guide provides exact commands, batch parameters, cost checkpoints,
and go/no-go criteria for each pipeline phase.

---

## Prerequisites Check

Before running any phase, confirm env is ready:

```bash
# 1. Confirm vars present (prints names, no values)
grep -o '^[A-Z_]*' .env.local | sort | grep -E \
  "SUPABASE_URL$|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_LESSON_AUDIO_BUCKET|ENABLE_LESSON_AUDIO_GENERATION|OPENAI_API_KEY|CRON_SECRET"

# Expected output:
# CRON_SECRET
# ENABLE_LESSON_AUDIO_GENERATION
# OPENAI_API_KEY
# SUPABASE_LESSON_AUDIO_BUCKET
# SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_URL

# 2. Confirm bucket name
grep "SUPABASE_LESSON_AUDIO_BUCKET" .env.local | grep -o '"[^"]*"'
# Expected: "lesson-audio"

# 3. Confirm ENABLE flag
grep "ENABLE_LESSON_AUDIO_GENERATION" .env.local | grep -o '"[^"]*"'
# Expected: "true"
```

---

## Queue Status Check

Run this before and after any phase to confirm state transitions.

```bash
# Via admin API (requires running dev server):
curl -s "http://localhost:3000/api/admin/audio-generation/status?grade=5&subject=ENGLISH" \
  -H "Cookie: <admin-session>"

# Via CLI audit:
npx tsx scripts/audit-curriculum-year-readiness.ts --summary 2>&1
```

---

## Phase 1 — Finish Grade 5 ENGLISH Audio

**Current state:** 6 GENERATED, 174 PENDING, 0 FAILED.
**Cost gate:** 174 × $0.017 = **$2.96**. No approval needed.

### Step 1.1 — Dry-run to confirm rows
```bash
npx tsx scripts/process-lesson-audio.ts \
  --grade 5 --subject ENGLISH \
  --limit 10 --dry-run --voice alloy

# Expected: inspected: 10, processed: 10 (status: DRY_RUN), failed: 0
```

### Step 1.2 — Process in batches of 10
```bash
# Run repeatedly until output shows inspected: 0
npx tsx scripts/process-lesson-audio.ts \
  --grade 5 --subject ENGLISH \
  --limit 10 --approved --voice alloy

# Each run must show:
# - "storage": "supabase"   (NOT "not used" or local path)
# - All rows status: "GENERATED"
# - All urls: start with "https://bnphuinpvgpmebcsvmsp.supabase.co"
```

### Step 1.3 — Retry any failures immediately
```bash
# If any row shows status: "FAILED":
curl -X POST http://localhost:3000/api/admin/audio-generation/retry \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session>" \
  -d '{"grade": 5, "subject": "ENGLISH"}'
# Expected: { "retried": N }
# Then re-run Step 1.2
```

### Step 1.4 — Completion check (go/no-go for Phase 2)
```bash
curl "http://localhost:3000/api/admin/audio-generation/status?grade=5&subject=ENGLISH" \
  -H "Cookie: <admin-session>"

# GO criteria: { "pending": 0, "processing": 0, "generated": 180, "failed": 0 }
# NO-GO: any pending or failed rows remain
```

---

## Phase 2 — Grade 5 ENGLISH Textbook

**Prerequisite:** Phase 1 complete — pending: 0, generated: 180.
**Prerequisite:** `lesson-pdf/` Supabase bucket exists (create in Dashboard if not).

### Step 2.1 — Compile student edition
```bash
curl -H "Cookie: <admin-session>" \
  "http://localhost:3000/api/admin/curriculum/textbook?gradeLevel=5&subject=ENGLISH" \
  -o "grade5-english-2026-student.pdf"

# Verify non-empty PDF:
# Windows: (Get-Item grade5-english-2026-student.pdf).Length
# Expected: > 50000 bytes
```

### Step 2.2 — Manual validation checklist
- [ ] PDF opens without error
- [ ] Cover page shows Grade 5, ENGLISH, academic year
- [ ] All 10 units present
- [ ] Lesson bodies are full text (not placeholders)
- [ ] Page count is reasonable (>100 pages)

### Step 2.3 — Archive PDF to Supabase
Until the archive route is built, upload manually:
1. Supabase Dashboard → Storage → `lesson-pdf/`
2. Upload to path: `grade-5/english/2026/student.pdf`

### Step 2.4 — Teacher/workbook/assessment editions
These require a sprint to extend the textbook compiler (see AGENT.md §Textbook Variants).
Track as: **Next Sprint — Textbook Formats** (sprint blocker for Phase 7).

---

## Phase 3 — Grade 5 Subject Cluster Audio

**Combos:** G5 LITERACY, G5 MATH, G5 SCIENCE
**Total cost:** ~$4.13 (no approval needed)

### Step 3.1 — Enqueue all three
```bash
for SUBJECT in LITERACY MATH SCIENCE; do
  echo "Enqueuing G5 $SUBJECT..."
  curl -s -X POST http://localhost:3000/api/admin/audio-generation/enqueue \
    -H "Content-Type: application/json" \
    -H "Cookie: <admin-session>" \
    -d "{\"grade\": 5, \"subject\": \"$SUBJECT\", \"limit\": 200}"
  echo ""
done
```

### Step 3.2 — Process (CLI)
```bash
for SUBJECT in LITERACY MATH SCIENCE; do
  echo "Processing G5 $SUBJECT..."
  npx tsx scripts/process-lesson-audio.ts \
    --grade 5 --subject $SUBJECT \
    --limit 10 --approved --voice alloy
done
# Repeat for each subject until pending = 0
```

### Step 3.3 — Verify
```bash
for SUBJECT in LITERACY MATH SCIENCE; do
  echo "=== G5 $SUBJECT ===" &&
  curl -s "http://localhost:3000/api/admin/audio-generation/status?grade=5&subject=$SUBJECT" \
    -H "Cookie: <admin-session>"
done
```

---

## Phase 4 — Grade 7 Subject Cluster Audio

**Combos:** G7 CIVICS, G7 MATH, G7 SCIENCE, G7 SOCIAL_STUDIES
**Total cost:** ~$5.38 (no approval needed)

Same pattern as Phase 3, substitute grade=7:
```bash
for SUBJECT in CIVICS MATH SCIENCE SOCIAL_STUDIES; do
  curl -s -X POST http://localhost:3000/api/admin/audio-generation/enqueue \
    -H "Content-Type: application/json" -H "Cookie: <admin-session>" \
    -d "{\"grade\": 7, \"subject\": \"$SUBJECT\", \"limit\": 200}"
done
```

---

## Phase 5 — All Remaining Audio

**Volume:** ~3,807 lessons with no audio row yet.
**Total cost:** ~$64.72. **REQUIRES EXPLICIT APPROVAL before enqueuing.**

### Step 5.0 — Cost approval gate
```bash
# Run audit and review cost before proceeding:
npx tsx scripts/audit-curriculum-year-readiness.ts 2>&1 | node -e "
const c=[]; process.stdin.on('data',d=>c.push(d));
process.stdin.on('end',()=>{
  const {rows}=JSON.parse(Buffer.concat(c).toString());
  const total=rows.reduce((s,r)=>s+(r.missingAudio||0),0);
  console.log('Lessons needing audio row:', total);
  console.log('Estimated cost: \$'+(total*0.017).toFixed(2));
  console.log('APPROVAL REQUIRED before proceeding.');
});"
```

### Step 5.1 — Enqueue by priority group

**Group A — Remaining STRONG combos (G3 SCIENCE, G10 MATH):**
```bash
curl -X POST http://localhost:3000/api/admin/audio-generation/enqueue \
  -H "Content-Type: application/json" -H "Cookie: <admin-session>" \
  -d '{"grade": 3, "subject": "SCIENCE", "limit": 200}'
curl -X POST http://localhost:3000/api/admin/audio-generation/enqueue \
  -H "Content-Type: application/json" -H "Cookie: <admin-session>" \
  -d '{"grade": 10, "subject": "MATH", "limit": 200}'
```

**Group B — Core subjects G1-12 (CIVICS, LITERACY, MATH, PE, SCIENCE, SOCIAL_STUDIES):**
Enqueue one grade/subject at a time. Process and verify before next.

**Group C — Senior secondary (BIOLOGY, CHEMISTRY, GEOGRAPHY, HISTORY, PHYSICS, ECONOMICS):**
Enqueue after Group B is underway.

**Group D — Special (COMPUTER_SCIENCE, ENGLISH non-G5):**
Last — lowest volume.

### Step 5.2 — Enable Vercel Cron
Add `CRON_SECRET` to Vercel environment variables, then add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-audio-generation",
      "schedule": "*/5 * * * *"
    }
  ]
}
```
Each invocation: 3 jobs. At 5-min intervals: 864 jobs/day.
Total time for 3,807 jobs: ~4.4 days.

### Step 5.3 — Daily monitoring during cron run
```bash
# Check overall progress (no grade filter = all combos)
curl "http://localhost:3000/api/admin/audio-generation/status" -H "Cookie: <admin-session>"

# Retry any accumulated failures
curl -X POST http://localhost:3000/api/admin/audio-generation/retry \
  -H "Content-Type: application/json" -H "Cookie: <admin-session>" -d '{}'
```

---

## Phase 6 — Curriculum Generation Fill

**Goal:** Generate content for missing weeks in PARTIAL combos.
**Safety:** All generated content enters as DRAFT. Human review required before approval.
**Cost:** Variable — AI generation via OpenAI/Groq (not TTS). Budget separately.

### Step 6.1 — Identify gaps
```bash
npx tsx scripts/audit-curriculum-year-readiness.ts --summary 2>&1
# Shows top 10 lowest-readiness combos
```

### Step 6.2 — Generate missing content (one combo at a time)
```bash
# Dry-run first:
npx tsx scripts/generate-missing-curriculum-content.ts \
  --grade 5 --subject MATH --dry-run

# Review which weeks will be generated, then approve:
npx tsx scripts/generate-missing-curriculum-content.ts \
  --grade 5 --subject MATH --approved --limit 10
```

### Step 6.3 — Review and approve in admin UI
Navigate to `/admin/curriculum` → filter G5 MATH → bulk-approve reviewed content.
**Never approve without reading lesson bodies.**

### Step 6.4 — Enqueue audio for newly approved lessons
```bash
curl -X POST http://localhost:3000/api/admin/audio-generation/enqueue \
  -H "Content-Type: application/json" -H "Cookie: <admin-session>" \
  -d '{"grade": 5, "subject": "MATH"}'
```

---

## Phase 7 — Compile All Textbooks

**Gate per combo:** `readinessPct >= 80` AND `audio.pending === 0`.

```bash
# Check which combos meet the gate:
npx tsx scripts/audit-curriculum-year-readiness.ts 2>&1 | node -e "
const c=[]; process.stdin.on('data',d=>c.push(d));
process.stdin.on('end',()=>{
  const {rows}=JSON.parse(Buffer.concat(c).toString());
  rows.filter(r=>r.readinessPct>=80).forEach(r=>{
    console.log('READY:', r.grade, r.subject, r.readinessPct+'%');
  });
});"

# Compile for each ready combo:
curl -H "Cookie: <admin-session>" \
  "http://localhost:3000/api/admin/curriculum/textbook?gradeLevel=5&subject=ENGLISH&format=student" \
  -o "grade5-english-2026-student.pdf"
```

---

## Running the Gates

After every phase, before marking complete:

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. Curriculum tests
npx vitest run __tests__/curriculum/

# 3. Build
npm run build

# 4. Readiness audit
npx tsx scripts/audit-curriculum-year-readiness.ts --summary 2>&1
```

---

## Cost Summary by Phase

| Phase | Description | Lessons | Est. Cost | Approval |
|---|---|---|---|---|
| 1 | G5 ENGLISH Audio (remaining) | 174 | $2.96 | No |
| 3 | G5 Cluster Audio | 243 | $4.13 | No |
| 4 | G7 Cluster Audio | 316 | $5.38 | No |
| 3+4 subtotal | STRONG combos (excl. G5 ENG) | 559 | $9.50 | No |
| 5 | All remaining audio | 3,807 | $64.72 | **YES** |
| **Total audio** | All 4,093 approved lessons | **4,281** | **$72.77** | |

---

## Stop Rules

Halt the pipeline immediately if any of the following occur:

| Condition | Action |
|---|---|
| `failed / processed > 10%` in any batch | Stop, investigate, fix before resuming |
| Any `storageUrl` starts with `/generated-audio` | Supabase is down — stop, fix config |
| `tsc --noEmit` fails after a code change | Fix TypeScript errors before next run |
| Supabase returns 5xx for 3+ consecutive uploads | Check status.supabase.com, wait |
| OpenAI returns `insufficient_quota` | Top up billing, resume after quota restores |
| `estimatedCostUsd` in a single batch exceeds $1.00 | Verify lesson text length — may indicate corrupt payload |
