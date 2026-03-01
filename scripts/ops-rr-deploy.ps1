$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

param(
  [string]$ExpectedBranch = "main",
  [switch]$Vercel,
  [switch]$Prod
)

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [string[]]$Args = @()
  )

  Write-Host ">> $Command $($Args -join ' ')"
  & $Command @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command $($Args -join ' ')"
  }
}

function Ensure-Line {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Line
  )

  $content = Get-Content -Path $Path -ErrorAction Stop
  if (-not ($content -match ("^" + [regex]::Escape($Line) + "$"))) {
    Add-Content -Path $Path -Value $Line
    return $true
  }
  return $false
}

Write-Host "=== RR Deploy: Preconditions ==="

$status = git status --porcelain
if ($status) {
  throw "Working tree is dirty. Commit or stash before deploying."
}

$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
  throw "Unable to determine current branch."
}
if (-not [string]::IsNullOrWhiteSpace($ExpectedBranch) -and $branch -ne $ExpectedBranch) {
  throw "Expected branch '$ExpectedBranch', but on '$branch'."
}

Write-Host "=== Pull Latest ==="
Invoke-Checked git @("pull")

Write-Host "=== Install + Build + Test ==="
Invoke-Checked npm @("ci")
Invoke-Checked npx @("prisma", "generate")
Invoke-Checked npm @("test")
Invoke-Checked npm @("run", "build")

Write-Host "=== Ensure .env.example Flags ==="
$envPath = ".env.example"
$envChanged = $false
$envChanged = (Ensure-Line -Path $envPath -Line "ENABLE_ENROLLMENT_INVITES=\"false\"") -or $envChanged
$envChanged = (Ensure-Line -Path $envPath -Line "ENABLE_ACCOUNT_RECOVERY=\"false\"") -or $envChanged
$envChanged = (Ensure-Line -Path $envPath -Line "NEXT_PUBLIC_ENABLE_ENROLLMENT_INVITES=\"false\"") -or $envChanged
$envChanged = (Ensure-Line -Path $envPath -Line "NEXT_PUBLIC_ENABLE_ACCOUNT_RECOVERY=\"false\"") -or $envChanged

Write-Host "=== Write Ops Doc ==="
$opsDir = "docs/rollout"
if (-not (Test-Path $opsDir)) {
  New-Item -ItemType Directory -Path $opsDir | Out-Null
}

$opsDoc = @"
# OPS Enable RR-1 + RR-3

## Vercel Environment Variables
Set these for Production (and Preview if needed):
- ENABLE_ENROLLMENT_INVITES=true
- ENABLE_ACCOUNT_RECOVERY=true
- NEXT_PUBLIC_ENABLE_ENROLLMENT_INVITES=true
- NEXT_PUBLIC_ENABLE_ACCOUNT_RECOVERY=true

## Rollout Order
1. Deploy code (this script) with flags OFF (default false).
2. Run DB migration in production.
3. Enable ENABLE_ACCOUNT_RECOVERY, validate forgot/reset flow.
4. Enable ENABLE_ENROLLMENT_INVITES, validate teacher + student invites.
5. Optionally enable NEXT_PUBLIC mirrors for any UI gating.

## Validation Checklist
- Confirm invite acceptance rejects cross-tenant tokens.
- Confirm invite tokens are single-use + expire.
- Confirm reset tokens are single-use + expire.
- Confirm stale sessions are rejected after password reset.
- Confirm audit logs are created for invite + recovery events.
"@

$opsPath = "docs/rollout/OPS_ENABLE_RR1_RR3.md"
$existing = (Test-Path $opsPath) ? (Get-Content $opsPath -Raw) : ""
if ($existing -ne $opsDoc) {
  Set-Content -Path $opsPath -Value $opsDoc
}

Write-Host "=== Commit + Push Ops/Doc Changes ==="
Invoke-Checked git @("add", ".env.example", "docs/rollout/OPS_ENABLE_RR1_RR3.md", "scripts/ops-rr-deploy.ps1")

$pending = git status --porcelain
if ($pending) {
  Invoke-Checked git @("commit", "-m", "ops: rr1/rr3 deploy checklist")
  Invoke-Checked git @("push")
} else {
  Write-Host "No ops/doc changes to commit."
}

if ($Vercel.IsPresent) {
  Write-Host "=== Vercel Deploy ==="
  if ($Prod.IsPresent) {
    Invoke-Checked vercel @("--prod")
  } else {
    Invoke-Checked vercel @()
  }
}

Write-Host "Done."
