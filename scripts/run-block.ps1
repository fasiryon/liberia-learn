param(
  [Parameter(Mandatory=$true)] [string]$Branch,
  [Parameter(Mandatory=$true)] [string]$Title,
  [Parameter(Mandatory=$true)] [string]$PromptFile,
  [Parameter(Mandatory=$true)] [string]$BodyFile,
  [string]$AdrStubFile = ""
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "LiberiaLearn Sprint Runner — $Title" -ForegroundColor Cyan
Write-Host "Branch: $Branch" -ForegroundColor Cyan
Write-Host "Prompt: $PromptFile" -ForegroundColor Cyan
Write-Host "PR Body: $BodyFile" -ForegroundColor Cyan
if ($AdrStubFile) { Write-Host "ADR Stub: $AdrStubFile" -ForegroundColor Cyan }
Write-Host "============================================================" -ForegroundColor Cyan

# 1) Update main
git checkout main | Out-Null
git pull origin main

# 2) Create or switch branch
$exists = git branch --list $Branch
if ($exists) {
  git checkout $Branch | Out-Null
  Write-Host "Switched to existing branch: $Branch" -ForegroundColor Yellow
} else {
  git checkout -b $Branch | Out-Null
  Write-Host "Created and switched to new branch: $Branch" -ForegroundColor Green
}

# 3) Show prompt to user (open in notepad)
if (Test-Path $PromptFile) {
  Write-Host ""
  Write-Host "Opening prompt file in Notepad. Copy/paste into Claude Code." -ForegroundColor Magenta
  Start-Process notepad.exe $PromptFile
} else {
  Write-Host "Prompt file not found: $PromptFile" -ForegroundColor Red
  throw "Missing PromptFile"
}

# 4) Optional ADR stub reminder
if ($AdrStubFile -and (Test-Path $AdrStubFile)) {
  Write-Host ""
  Write-Host "ADR stub reminder (for your reference): $AdrStubFile" -ForegroundColor DarkYellow
}

# 5) Baseline tests (pre)
Write-Host "Running baseline tests..." -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { throw "Baseline tests failed. Aborting." }

# 6) Pause for Claude
Write-Host ""
Write-Host "👉 Run Claude Code now. When done, press Enter to continue." -ForegroundColor Magenta
Read-Host | Out-Null

# 7) Tests (post)
Write-Host "Running tests after Claude changes..." -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { throw "Post-change tests failed. Aborting." }

# 8) Prisma sanity
Write-Host "Running Prisma generate..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "Prisma generate failed. Aborting." }

# 9) Commit
Write-Host "Committing changes..." -ForegroundColor Cyan
git add .
git status

$commitMsg = "feat: $Title"
git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) { throw "Commit failed (maybe nothing changed?). Aborting." }

# 10) Rebase before push
Write-Host "Rebasing on origin/main..." -ForegroundColor Cyan
git fetch origin
git rebase origin/main
if ($LASTEXITCODE -ne 0) { throw "Rebase failed. Resolve conflicts then continue." }

# 11) Push
Write-Host "Pushing branch..." -ForegroundColor Cyan
git push -u origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Push failed." }

# 12) Create or update PR
Write-Host "Creating PR (or updating if it exists)..." -ForegroundColor Cyan
gh pr create --base main --head $Branch --title $Title --body-file $BodyFile 2>$null
if ($LASTEXITCODE -ne 0) {
  $prNumber = (gh pr list --head $Branch --json number --jq ".[0].number")
  if ($prNumber) {
    gh pr edit $prNumber --title $Title --body-file $BodyFile
    Write-Host "Updated existing PR #$prNumber" -ForegroundColor Yellow
  } else {
    throw "PR create failed and PR not found for head branch."
  }
}

Write-Host "✅ Done. Opening PR in browser..." -ForegroundColor Green
gh pr view --web
