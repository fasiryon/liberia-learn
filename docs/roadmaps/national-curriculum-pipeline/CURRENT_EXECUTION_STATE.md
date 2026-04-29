# LiberiaLearn — Current Execution State

**As of: 2026-04-29**
Branch: `feat/school-operations-completion`

---

## Snapshot Summary

| Metric | Value |
|---|---|
| Total grade/subject combinations | 88 |
| Total approved lessons | 4,093 |
| Average curriculum readiness | 25.7% |
| STRONG combos (ready) | 10 |
| PARTIAL combos (incomplete) | 78 |
| Lessons with GENERATED audio | 6 |
| Lessons with PENDING audio rows | 174 (G5 ENGLISH only) |
| Lessons with no audio row at all | 3,807 |
| Total missing audio (all) | 3,981 |
| Est. cost to complete all audio | ~$67.68 |

---

## Per-Phase Status

| Phase | Description | Status |
|---|---|---|
| 0 | Prerequisites — storage, queue, cron | **COMPLETE** |
| 1 | G5 ENGLISH audio (174 remaining) | **IN PROGRESS** |
| 2 | G5 ENGLISH textbooks (4 formats) | BLOCKED on Phase 1 |
| 3 | G5 cluster audio (LITERACY/MATH/SCIENCE) | READY to start |
| 4 | G7 cluster audio (CIVICS/MATH/SCIENCE/SS) | READY to start |
| 5 | All remaining audio (~3,807 lessons) | PLANNED |
| 6 | Curriculum fill (missing weeks) | PLANNED |
| 7 | All textbooks | PLANNED |
| 8 | MOE national package | PLANNED |

---

## Grade 5 ENGLISH — Full Detail

**The only STRONG combo with 100% curriculum readiness.**

```
Approved lessons:   180 / 180  (100%)
Weeks covered:      36 / 36
Units covered:      10 / 10
Missing assessments: 0
Missing worksheets:  0
Missing audio rows:  0 (all rows created via enqueueLessonAudio)

Audio queue:
  GENERATED:   6
  PENDING:     174
  PROCESSING:  0
  FAILED:      0

Storage validation:
  Supabase bucket:   lesson-audio (public)
  Sample URL:        https://bnphuinpvgpmebcsvmsp.supabase.co/storage/v1/object/public/
                     lesson-audio/grade-5/english/draft-phase6-g5-english-w05-d1-core/alloy.mp3
  Listen mode:       getCurrentLessonAudio() returns GENERATED + correct storageUrl ✓
  Local fallback:    Not used (all uploads succeed) ✓

Next action:  Process remaining 174 PENDING rows
Next command: npx tsx scripts/process-lesson-audio.ts \
               --grade 5 --subject ENGLISH --limit 10 --approved --voice alloy
Est. cost:    $2.96 remaining
Est. time:    ~17 batch runs of 10 (or 58 cron invocations of 3)
```

---

## All STRONG Combos

These combos have the most approved lessons and are next in the audio queue.

| Combo              | readinessPct | approvedLessons | missingAudioRows | Est. cost |
|---|---|---|---|---|
| G5 ENGLISH         | 100%         | 180             | 0 (174 PENDING)  | $2.96     |
| G5 LITERACY        | 46%          | 83              | 82               | $1.39     |
| G5 MATH            | 45%          | 81              | 81               | $1.38     |
| G5 SCIENCE         | 46%          | 83              | 80               | $1.36     |
| G7 CIVICS          | 43%          | 77              | 77               | $1.31     |
| G7 MATH            | 49%          | 88              | 88               | $1.50     |
| G7 SCIENCE         | 42%          | 75              | 75               | $1.28     |
| G7 SOCIAL_STUDIES  | 42%          | 76              | 76               | $1.29     |
| G3 SCIENCE         | 42%          | 75              | 75               | $1.28     |
| G10 MATH           | 43%          | 76              | 76               | $1.29     |

All 9 non-G5-ENGLISH STRONG combos: **~$12.08 combined audio cost**

---

## Subjects — Current Audio Gap

| Subject       | Grades present | approvedLessons | missingAudioRows | Est. cost |
|---|---|---|---|---|
| MATH          | 12             | 630             | 618              | $10.51    |
| SCIENCE       | 12             | 606             | 584              | $9.93     |
| SOCIAL_STUDIES| 12             | 516             | 466              | $7.92     |
| LITERACY      | 12             | 556             | 540              | $9.18     |
| CIVICS        | 11             | 488             | 482              | $8.19     |
| PE            | 9              | 360             | 360              | $6.12     |
| BIOLOGY       | 3              | 120             | 120              | $2.04     |
| CHEMISTRY     | 3              | 120             | 120              | $2.04     |
| GEOGRAPHY     | 3              | 120             | 120              | $2.04     |
| HISTORY       | 3              | 120             | 120              | $2.04     |
| PHYSICS       | 3              | 120             | 120              | $2.04     |
| ECONOMICS     | 2              | 80              | 80               | $1.36     |
| ENGLISH       | 2              | 216             | 36               | $0.61     |
| COMPUTER_SCIENCE| 1            | 41              | 41               | $0.70     |

**Note:** ENGLISH `missingAudioRows = 36` because G5 ENGLISH has 174 PENDING rows (not zero rows),
and another ENGLISH grade has rows without audio. Audit `missingAudio` counts lessons with *no row at all*.

---

## Infrastructure Status

| Component | Status | Notes |
|---|---|---|
| Supabase `lesson-audio` bucket | ✓ Live (public) | Writes succeed, URLs public |
| `lib/audio/audioGenerationQueue.ts` | ✓ Live | 5 functions, all tested |
| `/api/admin/audio-generation/*` | ✓ Live (4 routes) | Build verified |
| `/api/cron/process-audio-generation` | ✓ Built | Needs `CRON_SECRET` in Vercel env |
| `/admin/audio-generation` UI | ✓ Built | Shows G5 ENGLISH counts |
| `textbookCompiler` + `renderPdfStream` | ✓ Live | Student edition only |
| Teacher/workbook/assessment PDF formats | ✗ Not built | Needs `format` param |
| Supabase `lesson-pdf/` bucket | ✗ Not created | Needed for Phase 2 archive |
| PDF archive route | ✗ Not built | Manual upload for now |
| Stuck-job cleanup cron | ✗ Not built | PROCESSING rows > 10 min |
| National readiness dashboard | ✗ Not built | `/admin/curriculum/national` |
| MOE export package builder | ✗ Not built | Phase 8 |

---

## Queue Health Check Commands

```bash
# Live queue summary (G5 ENGLISH)
curl "http://localhost:3000/api/admin/audio-generation/status?grade=5&subject=ENGLISH" \
  -H "Cookie: <admin-session>"

# Year readiness audit (all combos)
npx tsx scripts/audit-curriculum-year-readiness.ts --summary 2>&1

# Full readiness with missing detail
npx tsx scripts/audit-curriculum-year-readiness.ts 2>&1 | node -e "
const c=[]; process.stdin.on('data',d=>c.push(d));
process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c).toString());
  const byClass=d.rows.reduce((a,r)=>{a[r.classification]=(a[r.classification]||0)+1;return a},{});
  console.log('Status:', byClass);
  console.log('Avg readiness:', (d.rows.reduce((s,r)=>s+r.readinessPct,0)/d.rows.length).toFixed(1)+'%');
  console.log('Total missing audio rows:', d.rows.reduce((s,r)=>s+(r.missingAudio||0),0));
});"
```

---

## Blockers

| Blocker | Impact | Owner |
|---|---|---|
| 174 G5 ENGLISH PENDING rows not yet processed | Phase 1 incomplete | Run next batch |
| Teacher/workbook/assessment PDF format not built | Phase 2 partial only | Next sprint |
| `CRON_SECRET` not yet set in Vercel env | Cron worker inactive in production | Add via Vercel Dashboard |
| `lesson-pdf/` Supabase bucket not created | Phase 2 archive blocked | Create in Supabase Dashboard |
| Phase 5 cost approval ($64.72) pending | All remaining audio blocked | Review + approve |

---

## Recommended Next Actions (Priority Order)

1. **Finish G5 ENGLISH audio** — run `--limit 10 --approved` batches until pending=0
2. **Create `lesson-pdf/` Supabase bucket** — needed for Phase 2 PDF archive
3. **Compile G5 ENGLISH student textbook** — validate PDF pipeline
4. **Set `CRON_SECRET` in Vercel** — enable production cron worker
5. **Enqueue G5 LITERACY/MATH/SCIENCE** — Phase 3 start
6. **Sprint: teacher/workbook/assessment PDF formats** — complete textbook pipeline
7. **Cost approval: $64.72** — approve Phase 5 all-audio run
8. **Enable Vercel cron** — `*/5 * * * *` to `/api/cron/process-audio-generation`
