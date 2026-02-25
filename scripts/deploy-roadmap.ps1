# deploy-roadmap.ps1
# Copies updated roadmap docs + Block 10-13 prompts into the repo,
# commits them, and pushes. Run this after Block 9 merges.
#
# Usage:
#   .\scripts\deploy-roadmap.ps1
#
# Prerequisites:
#   - You are on main branch
#   - Block 9 PR is already merged
#   - Working directory is clean

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\fasir\liberia-learn"
Set-Location $repoRoot

# ── Safety checks ────────────────────────────────────────────────────────────

Write-Host "Checking branch..." -ForegroundColor Cyan
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
    Write-Error "Must be on main branch. Currently on: $branch"
    exit 1
}

Write-Host "Pulling latest..." -ForegroundColor Cyan
git pull origin main

Write-Host "Checking for uncommitted changes..." -ForegroundColor Cyan
$status = git status --porcelain
if ($status) {
    Write-Error "Working directory is not clean. Commit or stash changes first."
    exit 1
}

# ── Create docs/roadmap directory if needed ───────────────────────────────────

$docsPath = Join-Path $repoRoot "docs"
if (-not (Test-Path $docsPath)) {
    New-Item -ItemType Directory -Path $docsPath | Out-Null
}

# ── Write ROADMAP_BLOCKS.md ───────────────────────────────────────────────────

Write-Host "Writing ROADMAP_BLOCKS.md..." -ForegroundColor Cyan

$roadmapContent = @'
# 🇱🇷 LiberiaLearn — Master Block Roadmap

> National infrastructure for Liberia's K-12 education system.
> This is not an MVP. This is built for nationwide deployment over a 10-year horizon.

**Current Block:** 9 — National Performance Dashboard (in progress)
**Platform Completion:** ~82%  (Phase 1–2 complete, Phase 3 in progress)
**Last Updated:** 2026-02-25

---

## Audit Gates

Three mandatory audit gates are built into the roadmap.

| Gate   | After Block | Focus                                                      |
|--------|-------------|----------------------------------------------------------- |
| Gate 1 | Block 13    | Architecture, RBAC, data flows, tenant isolation           |
| Gate 2 | Block 27    | Security, PII exposure, compliance, penetration testing    |
| Gate 3 | Block 38    | Full pre-launch certification, MOE sign-off                |

Continuous automated auditing (CI) delivered in Block 26.

---

## Phase 1 — Governance & Platform Foundation ✅

| Block | Name                                  | Status  |
|-------|---------------------------------------|---------|
| 1     | Auth + Multi-Tenant Isolation Core    | ✅ Done |
| 2     | Training Reporting Infrastructure     | ✅ Done |
| 3     | Accessibility + Progressive Disclosure| ✅ Done |
| 4     | Micro Training & Adoption Engine      | ✅ Done |
| 5     | Ops Intelligence + Metrics            | ✅ Done |
| 6     | MOE Governance Layer                  | ✅ Done |

---

## Phase 2 — Performance Intelligence Engine ✅

| Block | Name                                          | Status  |
|-------|-----------------------------------------------|---------|
| 7A    | Mastery Engine Core                           | ✅ Done |
| 7B    | Adaptive Baseline C                           | ✅ Done |
| 7C    | Evidence Pipeline Integration                 | ✅ Done |
| 7D    | ~~Offline Evidence Baseline Stabilization~~   | Deprecated — absorbed into 8A |
| 8     | Hybrid Monthly Reporting                      | ✅ Done |
| 8A    | Offline Evidence + AttemptLog Infrastructure  | ✅ Done |

---

## Phase 3 — Leadership & National Intelligence 🔄

| Block    | Name                                      | Status         |
|----------|-------------------------------------------|----------------|
| 9        | National Performance Dashboard            | 🔄 In Progress |
| 10       | AI Stabilization Layer                    | ⏳ Todo        |
| 11       | Trend & Historical Intelligence Engine    | ⏳ Todo        |
| 12       | AI Intervention & Recommendation Layer    | ⏳ Todo        |
| 13       | District Intelligence Layer               | ⏳ Todo        |
| AUDIT-1  | **Gate 1 — Architecture & RBAC Audit**    | ⏳ Todo        |

---

## Phase 4 — Predictive & Optimization Systems

| Block | Name                                          | Status  |
|-------|-----------------------------------------------|---------|
| 14    | Longitudinal Growth Tracking                  | ⏳ Todo |
| 15    | Predictive Dropout Risk Modeling              | ⏳ Todo |
| 16    | Intervention Impact Measurement Engine        | ⏳ Todo |
| 17    | AI Curriculum Optimization Loop               | ⏳ Todo |
| 18    | Performance Heatmaps + Geo Intelligence       | ⏳ Todo |
| 19    | School Benchmarking (Private / Non-Public)    | ⏳ Todo |

---

## Phase 5 — National Infrastructure Hardening

| Block    | Name                                          | Status  |
|----------|-----------------------------------------------|---------|
| 20       | National Data Lake Export Layer               | ⏳ Todo |
| 21       | Ministry Bulk Operations API                  | ⏳ Todo |
| 22       | SIS / Government Integration Layer            | ⏳ Todo |
| 23       | Offline Sync Hardening v2                     | ⏳ Todo |
| 24       | Disaster Recovery + Backup Strategy           | ⏳ Todo |
| 25       | Scale Load Testing + Performance Benchmarks   | ⏳ Todo |
| 26       | Audit Deep Compliance Pack + CI Automation    | ⏳ Todo |
| 27       | National Reporting Automation                 | ⏳ Todo |
| AUDIT-2  | **Gate 2 — Security & Compliance Audit**      | ⏳ Todo |

---

## Phase 6 — AI-Native National System

| Block | Name                                  | Status  |
|-------|---------------------------------------|---------|
| 28    | National AI Tutor Aggregation         | ⏳ Todo |
| 29    | Adaptive National Standards Mapping   | ⏳ Todo |
| 30    | AI Policy Compliance Monitoring       | ⏳ Todo |
| 31    | Teacher Effectiveness Analytics       | ⏳ Todo |
| 32    | Guardian Engagement Intelligence      | ⏳ Todo |
| 33    | AI Governance Review Layer            | ⏳ Todo |
| 34    | Federated Learning Architecture       | ⏳ Todo |
| 35    | Model Drift Monitoring                | ⏳ Todo |

---

## Phase 7 — National Rollout Hardening

| Block    | Name                                          | Status  |
|----------|-----------------------------------------------|---------|
| 36       | MOE Pilot Hardening                           | ⏳ Todo |
| 37       | Multi-Region Hosting Strategy                 | ⏳ Todo |
| 38       | National Observability Dashboard              | ⏳ Todo |
| 39       | Production Certification + National Launch    | ⏳ Todo |
| AUDIT-3  | **Gate 3 — Full Pre-Launch Certification**    | ⏳ Todo |

---

## Definition of Done (All Blocks)

A block is not done until:

- [ ] All tests pass (zero failures)
- [ ] No cross-tenant leakage
- [ ] Audit logging present on all critical paths
- [ ] Feature flags respected
- [ ] Offline-first not regressed
- [ ] TypeScript strict mode clean
- [ ] No Prisma schema regressions
- [ ] ADR created if architectural decision made
- [ ] Docs updated
- [ ] PR merged to main

---

## Governance Constraints (Always Apply)

- No public school ranking at any phase
- No PII in telemetry or national aggregates
- All AI output is advisory-only — never mutates data autonomously
- Teacher insights are private and supportive — never punitive
- Offline-first must not regress at any block
- All features are feature-flagged and tenant-safe
'@

Set-Content -Path (Join-Path $docsPath "ROADMAP_BLOCKS.md") -Value $roadmapContent -Encoding UTF8
Write-Host "  ✅ ROADMAP_BLOCKS.md written" -ForegroundColor Green

# ── Update queue.json ─────────────────────────────────────────────────────────

Write-Host "Updating sprints/queue.json..." -ForegroundColor Cyan

$queuePath = Join-Path $repoRoot "sprints\queue.json"
if (-not (Test-Path (Split-Path $queuePath))) {
    New-Item -ItemType Directory -Path (Split-Path $queuePath) | Out-Null
}

$queueContent = @'
{
  "version": "2.0.0",
  "lastUpdated": "2026-02-25",
  "currentBlock": "9",
  "blocks": [
    { "id": "1",       "name": "Auth + Multi-Tenant Isolation Core",              "status": "done",        "phase": 1 },
    { "id": "2",       "name": "Training Reporting Infrastructure",               "status": "done",        "phase": 1 },
    { "id": "3",       "name": "Accessibility + Progressive Disclosure",          "status": "done",        "phase": 1 },
    { "id": "4",       "name": "Micro Training & Adoption Engine",                "status": "done",        "phase": 1 },
    { "id": "5",       "name": "Ops Intelligence + Metrics",                      "status": "done",        "phase": 1 },
    { "id": "6",       "name": "MOE Governance Layer",                            "status": "done",        "phase": 1 },
    { "id": "7a",      "name": "Mastery Engine Core",                             "status": "done",        "phase": 2 },
    { "id": "7b",      "name": "Adaptive Baseline C",                             "status": "done",        "phase": 2 },
    { "id": "7c",      "name": "Evidence Pipeline Integration",                   "status": "done",        "phase": 2 },
    { "id": "8",       "name": "Hybrid Monthly Reporting",                        "status": "done",        "phase": 2 },
    { "id": "8a",      "name": "Offline Evidence + AttemptLog Infrastructure",    "status": "done",        "phase": 2 },
    { "id": "9",       "name": "National Performance Dashboard",                  "status": "in_progress", "phase": 3 },
    { "id": "10",      "name": "AI Stabilization Layer",                          "status": "todo",        "phase": 3 },
    { "id": "11",      "name": "Trend & Historical Intelligence Engine",          "status": "todo",        "phase": 3 },
    { "id": "12",      "name": "AI Intervention & Recommendation Layer",          "status": "todo",        "phase": 3 },
    { "id": "13",      "name": "District Intelligence Layer",                     "status": "todo",        "phase": 3 },
    { "id": "AUDIT-1", "name": "Gate 1 - Architecture & RBAC Audit",             "status": "todo",        "phase": 3, "type": "audit" },
    { "id": "14",      "name": "Longitudinal Growth Tracking",                    "status": "todo",        "phase": 4 },
    { "id": "15",      "name": "Predictive Dropout Risk Modeling",                "status": "todo",        "phase": 4 },
    { "id": "16",      "name": "Intervention Impact Measurement Engine",          "status": "todo",        "phase": 4 },
    { "id": "17",      "name": "AI Curriculum Optimization Loop",                 "status": "todo",        "phase": 4 },
    { "id": "18",      "name": "Performance Heatmaps + Geo Intelligence",         "status": "todo",        "phase": 4 },
    { "id": "19",      "name": "School Benchmarking (Private / Non-Public)",      "status": "todo",        "phase": 4 },
    { "id": "20",      "name": "National Data Lake Export Layer",                 "status": "todo",        "phase": 5 },
    { "id": "21",      "name": "Ministry Bulk Operations API",                    "status": "todo",        "phase": 5 },
    { "id": "22",      "name": "SIS / Government Integration Layer",              "status": "todo",        "phase": 5 },
    { "id": "23",      "name": "Offline Sync Hardening v2",                       "status": "todo",        "phase": 5 },
    { "id": "24",      "name": "Disaster Recovery + Backup Strategy",             "status": "todo",        "phase": 5 },
    { "id": "25",      "name": "Scale Load Testing + Performance Benchmarks",     "status": "todo",        "phase": 5 },
    { "id": "26",      "name": "Audit Deep Compliance Pack + CI Automation",      "status": "todo",        "phase": 5 },
    { "id": "27",      "name": "National Reporting Automation",                   "status": "todo",        "phase": 5 },
    { "id": "AUDIT-2", "name": "Gate 2 - Security & Compliance Audit",           "status": "todo",        "phase": 5, "type": "audit" },
    { "id": "28",      "name": "National AI Tutor Aggregation",                   "status": "todo",        "phase": 6 },
    { "id": "29",      "name": "Adaptive National Standards Mapping",             "status": "todo",        "phase": 6 },
    { "id": "30",      "name": "AI Policy Compliance Monitoring",                 "status": "todo",        "phase": 6 },
    { "id": "31",      "name": "Teacher Effectiveness Analytics",                 "status": "todo",        "phase": 6 },
    { "id": "32",      "name": "Guardian Engagement Intelligence",                "status": "todo",        "phase": 6 },
    { "id": "33",      "name": "AI Governance Review Layer",                      "status": "todo",        "phase": 6 },
    { "id": "34",      "name": "Federated Learning Architecture",                 "status": "todo",        "phase": 6 },
    { "id": "35",      "name": "Model Drift Monitoring",                          "status": "todo",        "phase": 6 },
    { "id": "36",      "name": "MOE Pilot Hardening",                             "status": "todo",        "phase": 7 },
    { "id": "37",      "name": "Multi-Region Hosting Strategy",                   "status": "todo",        "phase": 7 },
    { "id": "38",      "name": "National Observability Dashboard",                "status": "todo",        "phase": 7 },
    { "id": "39",      "name": "Production Certification + National Launch",      "status": "todo",        "phase": 7 },
    { "id": "AUDIT-3", "name": "Gate 3 - Full Pre-Launch Certification Audit",   "status": "todo",        "phase": 7, "type": "audit" }
  ],
  "auditGates": {
    "gate1": { "after": "13", "focus": ["architecture", "rbac", "data-flows", "tenant-isolation"] },
    "gate2": { "after": "27", "focus": ["security", "penetration-testing", "pii-exposure", "offline-integrity"] },
    "gate3": { "after": "38", "focus": ["performance-benchmarks", "disaster-recovery", "load-testing", "moe-sign-off"] }
  }
}
'@

Set-Content -Path $queuePath -Value $queueContent -Encoding UTF8
Write-Host "  ✅ queue.json updated" -ForegroundColor Green

# ── Copy prompt files ─────────────────────────────────────────────────────────

Write-Host "Copying prompt files..." -ForegroundColor Cyan

$promptsPath = Join-Path $repoRoot "prompts"
if (-not (Test-Path $promptsPath)) {
    New-Item -ItemType Directory -Path $promptsPath | Out-Null
}

# NOTE: These files should already be in your local prompts folder
# from previous sessions. If not, paste them from the handover doc.
$promptFiles = @(
    "block-10-ai-stabilization.txt",
    "block-11-trend-intelligence.txt",
    "block-12-ai-interventions.txt",
    "block-13-district-intelligence.txt"
)

foreach ($file in $promptFiles) {
    $src = Join-Path $PSScriptRoot "..\prompts\$file"
    $dst = Join-Path $promptsPath $file
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $file not found at $src — paste manually into prompts\" -ForegroundColor Yellow
    }
}

# ── Commit & push ─────────────────────────────────────────────────────────────

Write-Host "`nCommitting roadmap update..." -ForegroundColor Cyan

git add docs/ROADMAP_BLOCKS.md
git add sprints/queue.json
git add prompts/

$commitMsg = "docs: master block roadmap v2 (Blocks 1-39, 3 audit gates, Phases 1-7)"
git commit -m $commitMsg

Write-Host "Pushing to origin main..." -ForegroundColor Cyan
git push origin main

Write-Host "`n✅ Roadmap deployed successfully." -ForegroundColor Green
Write-Host "   ROADMAP_BLOCKS.md → docs/" -ForegroundColor White
Write-Host "   queue.json → sprints/" -ForegroundColor White
Write-Host "   Prompts 10-13 → prompts/" -ForegroundColor White
Write-Host "`nNext: Wait for Block 9 to finish, then run Block 10." -ForegroundColor Cyan
