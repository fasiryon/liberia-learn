import { spawn } from 'child_process'
import { config as loadEnv } from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load production env first (dotenv never overwrites existing vars,
// so the env that launched this process always wins)
loadEnv({ path: path.join(process.cwd(), '.env.production') })
loadEnv({ path: path.join(process.cwd(), '.env.local') })
loadEnv()

// ─── Gap data from production DB query (2026-05-05, post-normalization) ───
// All statuses unified: published+pending_approval → APPROVED+NEEDS_REVIEW
// SELECT grade, subject, COUNT(*) WHERE status='APPROVED' GROUP BY grade,subject
// TARGET = 180 lessons per grade/subject
// G5 ENGLISH closed (180/180) — excluded from this list
interface GapGroup {
  grade: number
  subject: string
  current: number
  needed: number
}

const ALL_GAPS: GapGroup[] = [
  // Grade 7 (highest priority — active curriculum roll-out)
  { grade: 7, subject: 'ENGLISH',        current: 173, needed: 7   },
  { grade: 7, subject: 'LITERACY',       current: 47,  needed: 133 },
  { grade: 7, subject: 'MATH',           current: 88,  needed: 92  },
  { grade: 7, subject: 'SCIENCE',        current: 85,  needed: 95  },
  { grade: 7, subject: 'CIVICS',         current: 77,  needed: 103 },
  { grade: 7, subject: 'SOCIAL_STUDIES', current: 76,  needed: 104 },
  { grade: 7, subject: 'PE',             current: 50,  needed: 130 },
  // Grade 8
  { grade: 8, subject: 'SOCIAL_STUDIES', current: 40,  needed: 140 },
  { grade: 8, subject: 'PE',             current: 40,  needed: 140 },
  { grade: 8, subject: 'CIVICS',         current: 45,  needed: 135 },
  { grade: 8, subject: 'SCIENCE',        current: 46,  needed: 134 },
  { grade: 8, subject: 'LITERACY',       current: 48,  needed: 132 },
  { grade: 8, subject: 'MATH',           current: 49,  needed: 131 },
  // Grade 9
  { grade: 9, subject: 'CIVICS',         current: 40,  needed: 140 },
  { grade: 9, subject: 'PE',             current: 40,  needed: 140 },
  { grade: 9, subject: 'SCIENCE',        current: 40,  needed: 140 },
  { grade: 9, subject: 'SOCIAL_STUDIES', current: 40,  needed: 140 },
  { grade: 9, subject: 'LITERACY',       current: 41,  needed: 139 },
  { grade: 9, subject: 'MATH',           current: 42,  needed: 138 },
  // Grade 10
  { grade: 10, subject: 'BIOLOGY',        current: 40,  needed: 140 },
  { grade: 10, subject: 'CHEMISTRY',      current: 40,  needed: 140 },
  { grade: 10, subject: 'CIVICS',         current: 40,  needed: 140 },
  { grade: 10, subject: 'GEOGRAPHY',      current: 40,  needed: 140 },
  { grade: 10, subject: 'HISTORY',        current: 40,  needed: 140 },
  { grade: 10, subject: 'LITERACY',       current: 40,  needed: 140 },
  { grade: 10, subject: 'PHYSICS',        current: 40,  needed: 140 },
  { grade: 10, subject: 'SCIENCE',        current: 40,  needed: 140 },
  { grade: 10, subject: 'SOCIAL_STUDIES', current: 40,  needed: 140 },
  { grade: 10, subject: 'MATH',           current: 77,  needed: 103 },
  // Grade 11
  { grade: 11, subject: 'BIOLOGY',        current: 40,  needed: 140 },
  { grade: 11, subject: 'CHEMISTRY',      current: 40,  needed: 140 },
  { grade: 11, subject: 'CIVICS',         current: 40,  needed: 140 },
  { grade: 11, subject: 'ECONOMICS',      current: 40,  needed: 140 },
  { grade: 11, subject: 'GEOGRAPHY',      current: 40,  needed: 140 },
  { grade: 11, subject: 'HISTORY',        current: 40,  needed: 140 },
  { grade: 11, subject: 'LITERACY',       current: 40,  needed: 140 },
  { grade: 11, subject: 'MATH',           current: 40,  needed: 140 },
  { grade: 11, subject: 'PHYSICS',        current: 40,  needed: 140 },
  { grade: 11, subject: 'SCIENCE',        current: 40,  needed: 140 },
  { grade: 11, subject: 'SOCIAL_STUDIES', current: 40,  needed: 140 },
  // Grade 12
  { grade: 12, subject: 'BIOLOGY',        current: 40,  needed: 140 },
  { grade: 12, subject: 'CHEMISTRY',      current: 40,  needed: 140 },
  { grade: 12, subject: 'CIVICS',         current: 40,  needed: 140 },
  { grade: 12, subject: 'ECONOMICS',      current: 40,  needed: 140 },
  { grade: 12, subject: 'GEOGRAPHY',      current: 40,  needed: 140 },
  { grade: 12, subject: 'HISTORY',        current: 40,  needed: 140 },
  { grade: 12, subject: 'LITERACY',       current: 40,  needed: 140 },
  { grade: 12, subject: 'MATH',           current: 44,  needed: 136 },
  { grade: 12, subject: 'PHYSICS',        current: 40,  needed: 140 },
  { grade: 12, subject: 'SCIENCE',        current: 40,  needed: 140 },
  { grade: 12, subject: 'SOCIAL_STUDIES', current: 40,  needed: 140 },
  // Grade 1
  { grade: 1, subject: 'CIVICS',          current: 40,  needed: 140 },
  { grade: 1, subject: 'LITERACY',        current: 40,  needed: 140 },
  { grade: 1, subject: 'MATH',            current: 40,  needed: 140 },
  { grade: 1, subject: 'PE',              current: 40,  needed: 140 },
  { grade: 1, subject: 'SCIENCE',         current: 40,  needed: 140 },
  { grade: 1, subject: 'SOCIAL_STUDIES',  current: 40,  needed: 140 },
  // Grade 2
  { grade: 2, subject: 'PE',              current: 40,  needed: 140 },
  { grade: 2, subject: 'SOCIAL_STUDIES',  current: 40,  needed: 140 },
  { grade: 2, subject: 'LITERACY',        current: 41,  needed: 139 },
  { grade: 2, subject: 'MATH',            current: 41,  needed: 139 },
  { grade: 2, subject: 'SCIENCE',         current: 41,  needed: 139 },
  // Grade 3
  { grade: 3, subject: 'CIVICS',          current: 40,  needed: 140 },
  { grade: 3, subject: 'MATH',            current: 40,  needed: 140 },
  { grade: 3, subject: 'PE',              current: 40,  needed: 140 },
  { grade: 3, subject: 'SOCIAL_STUDIES',  current: 40,  needed: 140 },
  { grade: 3, subject: 'LITERACY',        current: 45,  needed: 135 },
  { grade: 3, subject: 'SCIENCE',         current: 76,  needed: 104 },
  // Grade 4
  { grade: 4, subject: 'CIVICS',          current: 40,  needed: 140 },
  { grade: 4, subject: 'LITERACY',        current: 40,  needed: 140 },
  { grade: 4, subject: 'MATH',            current: 40,  needed: 140 },
  { grade: 4, subject: 'PE',              current: 40,  needed: 140 },
  { grade: 4, subject: 'SCIENCE',         current: 40,  needed: 140 },
  { grade: 4, subject: 'SOCIAL_STUDIES',  current: 40,  needed: 140 },
  // Grade 5
  { grade: 5, subject: 'PE',              current: 40,  needed: 140 },
  { grade: 5, subject: 'SOCIAL_STUDIES',  current: 40,  needed: 140 },
  { grade: 5, subject: 'CIVICS',          current: 41,  needed: 139 },
  { grade: 5, subject: 'COMPUTER_SCIENCE',current: 41,  needed: 139 },
  { grade: 5, subject: 'MATH',            current: 81,  needed: 99  },
  { grade: 5, subject: 'LITERACY',        current: 82,  needed: 98  },
  { grade: 5, subject: 'SCIENCE',         current: 82,  needed: 98  },
  // Grade 6
  { grade: 6, subject: 'PE',              current: 40,  needed: 140 },
  { grade: 6, subject: 'SOCIAL_STUDIES',  current: 40,  needed: 140 },
  { grade: 6, subject: 'CIVICS',          current: 45,  needed: 135 },
  { grade: 6, subject: 'SCIENCE',         current: 46,  needed: 134 },
  { grade: 6, subject: 'MATH',            current: 48,  needed: 132 },
  { grade: 6, subject: 'LITERACY',        current: 52,  needed: 128 },
]

// ─── Constants ─────────────────────────────────────────────────────────────
const DEFAULT_PARALLEL_WORKERS = 3
const BATCH_SIZE = 50                  // lessons per worker per run
const MAX_GROUPS_PER_RUN = 4           // 4 × 50 = 200 lesson cap per run

// ─── CLI helpers ───────────────────────────────────────────────────────────
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function readNumberArg(flag: string): number | undefined {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return undefined
  const val = parseInt(process.argv[idx + 1] ?? '', 10)
  return Number.isFinite(val) ? val : undefined
}

// ─── Priority sort ─────────────────────────────────────────────────────────
// Grade 7 first (active roll-out), then 8–12, then 1–6
// Within each tier: most-needed first
function gradePriority(grade: number): number {
  if (grade === 7) return 0
  if (grade >= 8)  return 1
  return 2
}

function sortByPriority(gaps: GapGroup[]): GapGroup[] {
  return [...gaps].sort((a, b) => {
    const pa = gradePriority(a.grade)
    const pb = gradePriority(b.grade)
    if (pa !== pb) return pa - pb
    if (b.needed !== a.needed) return b.needed - a.needed
    if (a.grade !== b.grade) return a.grade - b.grade
    return a.subject.localeCompare(b.subject)
  })
}

// ─── Worker ────────────────────────────────────────────────────────────────
function runWorker(
  grade: number,
  subject: string,
  limit: number,
  label: string,
  logDir: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      'tsx',
      'scripts/generate-missing-curriculum-content.ts',
      '--grade',   String(grade),
      '--subject', subject,
      '--limit',   String(limit),
      '--approved',
    ]

    const logFile = path.join(logDir, `${label}.log`)
    const out = fs.openSync(logFile, 'a')

    console.log(`  [${label}] → npx ${args.join(' ')}  (log: ${logFile})`)

    const proc = spawn('npx', args, {
      stdio: ['ignore', out, out],
      env: { ...process.env },
      shell: true,
    })

    proc.on('close', (code) => {
      fs.closeSync(out)
      if (code === 0) {
        console.log(`  [${label}] Done ✓`)
        resolve()
      } else {
        console.error(`  [${label}] Failed (exit ${code}) — see ${logFile}`)
        reject(new Error(`Worker failed: Grade ${grade} ${subject} (exit ${code})`))
      }
    })

    proc.on('error', (err) => {
      fs.closeSync(out)
      console.error(`  [${label}] Process error: ${err.message}`)
      reject(err)
    })
  })
}

// ─── Batch runner ──────────────────────────────────────────────────────────
async function runBatch(
  groups: GapGroup[],
  parallelWorkers: number,
  batchLimitOverride?: number,
  logDir: string = 'logs/curriculum-gen',
): Promise<void> {
  fs.mkdirSync(logDir, { recursive: true })

  for (let i = 0; i < groups.length; i += parallelWorkers) {
    const batch = groups.slice(i, i + parallelWorkers)
    const batchNum = Math.floor(i / parallelWorkers) + 1
    const totalBatches = Math.ceil(groups.length / parallelWorkers)

    console.log(`\n─── Batch ${batchNum}/${totalBatches} ───`)
    batch.forEach((g) => {
      const limit = batchLimitOverride ?? Math.min(g.needed, BATCH_SIZE)
      console.log(`  Grade ${g.grade} ${g.subject} — ${g.current} approved, ${g.needed} needed, generating ${limit}`)
    })

    const results = await Promise.allSettled(
      batch.map((g, idx) => {
        const limit = batchLimitOverride ?? Math.min(g.needed, BATCH_SIZE)
        const label = `g${g.grade}-${g.subject.toLowerCase()}-b${batchNum}-w${idx + 1}`
        return runWorker(g.grade, g.subject, limit, label, logDir)
      })
    )

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      failed.forEach((r) => {
        if (r.status === 'rejected') console.error(`  ERROR: ${r.reason}`)
      })
      console.warn(`  ${failed.length}/${batch.length} workers failed — continuing to next batch`)
    }

    if (i + parallelWorkers < groups.length) {
      console.log(`\nBatch ${batchNum} complete. Waiting 20s before next batch...`)
      await new Promise((r) => setTimeout(r, 20_000))
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const testMode       = hasFlag('--test-mode')
  const allGroups      = hasFlag('--all-groups')
  const parallelWorkers = readNumberArg('--workers')   ?? DEFAULT_PARALLEL_WORKERS
  const groupsOverride  = readNumberArg('--groups')
  const logDir          = 'logs/curriculum-gen'

  const sorted = sortByPriority(ALL_GAPS)
  const totalNeeded = ALL_GAPS.reduce((s, g) => s + g.needed, 0)

  let selectedGroups: GapGroup[]
  let limitPerWorker: number | undefined

  if (testMode) {
    selectedGroups = sorted.slice(0, 2)
    limitPerWorker = 10
    console.log('TEST MODE — first 2 priority groups, 10 lessons each')
  } else if (allGroups) {
    selectedGroups = sorted
    console.log(`ALL-GROUPS MODE — all ${sorted.length} gap groups`)
  } else {
    const maxGroups = groupsOverride ?? MAX_GROUPS_PER_RUN
    selectedGroups = sorted.slice(0, maxGroups)
    console.log(
      `Processing top ${selectedGroups.length} priority groups ` +
      `(--all-groups to process all ${sorted.length} | --groups N to change)`
    )
  }

  console.log(`
Gap summary (production DB, 2026-05-05):
  Total gap groups : ${ALL_GAPS.length}
  Total lessons    : ${totalNeeded.toLocaleString()} needed
  This run         : ${selectedGroups.length} groups
  Parallel workers : ${parallelWorkers}
  Batch size       : ${limitPerWorker ?? BATCH_SIZE} lessons/worker
  Log dir          : ${logDir}/
`)

  console.log('Groups selected:')
  selectedGroups.forEach((g, i) => {
    const limit = limitPerWorker ?? Math.min(g.needed, BATCH_SIZE)
    console.log(`  ${String(i + 1).padStart(2)}. G${g.grade} ${g.subject.padEnd(16)} ${g.current} → +${limit} (${g.needed} needed total)`)
  })

  const startTime = Date.now()
  await runBatch(selectedGroups, parallelWorkers, limitPerWorker, logDir)
  const elapsed = (Date.now() - startTime) / 1000 / 60

  console.log(`\n═══ All batches complete in ${elapsed.toFixed(1)} minutes ═══`)

  // Rough estimate: generate script runs lessons sequentially with ~2s delay + AI call
  // Observed: ~15–25s per lesson at Groq smart tier
  const secsPerLesson = 20
  const runsNeeded = Math.ceil(ALL_GAPS.length / (groupsOverride ?? MAX_GROUPS_PER_RUN))
  const lessonsPerRun = (groupsOverride ?? MAX_GROUPS_PER_RUN) * (limitPerWorker ?? BATCH_SIZE)
  const minsPerRun = (lessonsPerRun / parallelWorkers) * (secsPerLesson / 60)

  if (!testMode) {
    console.log(`
Estimates for full gap closure (${totalNeeded.toLocaleString()} lessons):
  Lessons per orchestrator run : ~${lessonsPerRun} (${groupsOverride ?? MAX_GROUPS_PER_RUN} groups × ${limitPerWorker ?? BATCH_SIZE})
  Minutes per run              : ~${minsPerRun.toFixed(0)} min at ${parallelWorkers} parallel workers
  Runs at ${(limitPerWorker ?? BATCH_SIZE)} lessons/group   : ~${Math.ceil(totalNeeded / (lessonsPerRun))} total runs
  Orchestrator invocations     : ~${runsNeeded} (cycling through all ${ALL_GAPS.length} groups)
`)
  }
}

main().catch((err) => {
  console.error('\nOrchestrator failed:', err)
  process.exitCode = 1
})
