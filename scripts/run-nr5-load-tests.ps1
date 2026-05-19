# NR-5 load test runner — run outside Liberian school hours only.
# Requires: k6 installed, token fixture generated, NR-4 PASS recorded.

param(
  [ValidateSet("peak", "ai-burst", "both")]
  [string]$Scenario = "both",
  [string]$BaseUrl = "https://liberia-learn.vercel.app",
  [string]$LessonId = "math-g10-5-geometry-and-spatial-thinking-independent-practice"
)

$ErrorActionPreference = "Stop"
$date = Get-Date -Format "yyyyMMdd"
$resultsDir = Join-Path $PSScriptRoot "..\load-tests\results"
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

$tokenFixture = Join-Path $PSScriptRoot "..\load-tests\fixtures\student-tokens.json"
if (-not (Test-Path $tokenFixture)) {
  Write-Error "Missing $tokenFixture — run generate-load-test-tokens.ts first."
}

$env:BASE_URL = $BaseUrl
$env:LOAD_TEST_LESSON_ID = $LessonId
$env:LOAD_TEST_USE_TOKEN_POOL = "true"

Push-Location (Join-Path $PSScriptRoot "..")

try {
  if ($Scenario -eq "peak" -or $Scenario -eq "both") {
    Write-Host "=== NR-5 Peak (5000 VU) ===" -ForegroundColor Cyan
    k6 run load-tests/peak.js --out "json=load-tests/results/peak-$date.json"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  if ($Scenario -eq "ai-burst" -or $Scenario -eq "both") {
    Write-Host "=== NR-5 AI Burst (200 VU) ===" -ForegroundColor Cyan
    k6 run load-tests/ai-burst.js --out "json=load-tests/results/ai-burst-$date.json"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  Write-Host "Done. Summarize results in docs/LOAD_TEST_RESULTS.md" -ForegroundColor Green
} finally {
  Pop-Location
}
