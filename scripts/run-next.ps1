$ErrorActionPreference = "Stop"

$queuePath = "sprints\queue.json"
if (-not (Test-Path $queuePath)) { throw "Missing $queuePath. Run .\scripts\init-queue.ps1 first." }

$queue = Get-Content $queuePath -Raw | ConvertFrom-Json

$next = $queue.blocks | Where-Object { $_.status -ne "done" } | Select-Object -First 1
if (-not $next) {
  Write-Host "✅ All blocks are marked done." -ForegroundColor Green
  exit 0
}

Write-Host "Next block: $($next.id) — $($next.title)" -ForegroundColor Cyan

.\scripts\run-block.ps1 `
  -Branch $next.branch `
  -Title $next.title `
  -PromptFile $next.promptFile `
  -BodyFile $next.bodyFile `
  -AdrStubFile $next.adrStubFile

# Mark done after successful completion
$next.status = "done"
$queue | ConvertTo-Json -Depth 10 | Set-Content $queuePath -Encoding UTF8

Write-Host "✅ Marked done: $($next.id)" -ForegroundColor Green
Write-Host "Run again for next block: .\scripts\run-next.ps1" -ForegroundColor Yellow
