# scripts/audit-gate-1.ps1
# LiberiaLearn Audit Gate 1 - Architecture and RBAC Review
# Usage: .\scripts\audit-gate-1.ps1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ensure-Dir([string]$p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}
function ReadText([string]$p) { [System.IO.File]::ReadAllText($p) }
function WriteText([string]$p, [string]$t) { [System.IO.File]::WriteAllText($p, $t) }
function BackupFile([string]$p) {
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$p.bak_$stamp"
  Copy-Item -Force $p $bak
  return $bak
}
function StripAnsi([string]$s) {
  if (-not $s) { return "" }
  return [regex]::Replace($s, "\x1b\[[0-9;]*m", "")
}

function Write-Section([string]$t) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host ("  " + $t) -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkGray
}

$script:passed = 0
$script:warned = 0
$script:failed = 0
$script:findings = @()

function Pass([string]$msg) { Write-Host ("  [PASS] " + $msg) -ForegroundColor Green;  $script:passed++; $script:findings += "| PASS | $msg |" }
function Warn([string]$msg) { Write-Host ("  [WARN] " + $msg) -ForegroundColor Yellow; $script:warned++; $script:findings += "| WARN | $msg |" }
function Fail([string]$msg) { Write-Host ("  [FAIL] " + $msg) -ForegroundColor Red;    $script:failed++; $script:findings += "| FAIL | $msg |" }
function Info([string]$msg) { Write-Host ("     " + $msg) -ForegroundColor DarkGray }

function GetGitBranch { try { (git branch --show-current).Trim() } catch { "" } }
function GetOwnerName {
  try { $n = (git config user.name).Trim(); if ($n) { return $n } } catch {}
  if ($env:USERNAME) { return $env:USERNAME }
  return "Unknown"
}

function EnsureChecklist([string]$path) {
  Ensure-Dir (Split-Path $path -Parent)
  if (-not (Test-Path $path)) {
@"
# LiberiaLearn - AUDIT GATE 1

## Status
Current Sprint:
Date:
Owner:
Result:
Counts:
Report:
"@ | Set-Content -Path $path -Encoding UTF8
  } else {
    $raw = ReadText $path
    if ($raw -notmatch "(?ms)^\s*##\s*Status\s*$") {
      Add-Content -Path $path -Value "`r`n`r`n## Status`r`nCurrent Sprint:`r`nDate:`r`nOwner:`r`nResult:`r`nCounts:`r`nReport:`r`n" -Encoding UTF8
    }
  }
}

function UpdateChecklistStatus([string]$path, [string]$resultLine, [string]$reportRel, [int]$p, [int]$w, [int]$f) {
  EnsureChecklist $path
  $bak = BackupFile $path
  Info ("Checklist backup: " + (Split-Path $bak -Leaf))

  $branch = GetGitBranch
  $owner  = GetOwnerName
  $date   = Get-Date -Format "yyyy-MM-dd"
  $sprint = if ($branch) { $branch } else { "unknown" }

  $newBlock = @"
## Status
Current Sprint: $sprint
Date: $date
Owner: $owner
Result: $resultLine
Counts: PASS $p  WARN $w  FAIL $f
Report: $reportRel
"@

  $raw = ReadText $path
  if ($raw -match "(?ms)^\s*##\s*Status\s*$") {
    $raw = [regex]::Replace($raw, "(?ms)^\s*##\s*Status\s*$.*?(?=^\s*##\s+|\z)", $newBlock.TrimEnd() + "`r`n")
  } else {
    $raw = $raw.TrimEnd() + "`r`n`r`n" + $newBlock.TrimEnd() + "`r`n"
  }

  Set-Content -Path $path -Value $raw -Encoding UTF8
}

# Preconditions
if (-not (Test-Path ".git")) { throw "Run from repo root (where .git exists)." }

Ensure-Dir "docs\audits"
EnsureChecklist "docs\audits\AUDIT_GATE_1.md"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$reportDateCompact = Get-Date -Format "yyyyMMdd"
$reportPath = "docs\audits\AUDIT_GATE_1_REPORT_$reportDateCompact.md"

Write-Host ""
Write-Host "LiberiaLearn - Audit Gate 1" -ForegroundColor White
Write-Host "Architecture and RBAC Review" -ForegroundColor DarkGray
Write-Host $timestamp -ForegroundColor DarkGray
Write-Host ("Report: " + $reportPath) -ForegroundColor DarkGray
Write-Host "Checklist: docs/audits/AUDIT_GATE_1.md (auto-update)" -ForegroundColor DarkGray


# PREFLIGHT_PIPE_SPAWN_CHECK
Write-Section "Preflight - Node child_process pipes"

# This checks whether Node is allowed to spawn a child process with piped stdio.
# If blocked (EPERM/AppLocker/EDR/Controlled Folder Access), Vite/Vitest can fail
# because esbuild's Node API requires pipes for its service protocol.
$nodeProbe = @"
const cp = require('child_process');
const p = cp.spawn('cmd.exe', ['/c', 'echo hi'], { stdio: ['pipe','pipe','inherit'] });
p.on('error', (e) => { console.error('PIPE_SPAWN_ERROR:' + (e && e.code ? e.code : 'UNKNOWN') + ':' + (e && e.message ? e.message : '')); process.exit(10); });
p.on('exit', (code) => { process.exit(code === 0 ? 0 : 11); });
"@

$probeOut = ""
$probeExit = 999
try {
  $probeOut = & node -e $nodeProbe 2>&1 | Out-String
  $probeExit = $LASTEXITCODE
} catch {
  $probeOut = ($probeOut + "`n" + # scripts/audit-gate-1.ps1
# LiberiaLearn Audit Gate 1 - Architecture and RBAC Review
# Usage: .\scripts\audit-gate-1.ps1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ensure-Dir([string]$p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}
function ReadText([string]$p) { [System.IO.File]::ReadAllText($p) }
function WriteText([string]$p, [string]$t) { [System.IO.File]::WriteAllText($p, $t) }
function BackupFile([string]$p) {
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$p.bak_$stamp"
  Copy-Item -Force $p $bak
  return $bak
}
function StripAnsi([string]$s) {
  if (-not $s) { return "" }
  return [regex]::Replace($s, "\x1b\[[0-9;]*m", "")
}

function Write-Section([string]$t) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host ("  " + $t) -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkGray
}

$script:passed = 0
$script:warned = 0
$script:failed = 0
$script:findings = @()

function Pass([string]$msg) { Write-Host ("  [PASS] " + $msg) -ForegroundColor Green;  $script:passed++; $script:findings += "| PASS | $msg |" }
function Warn([string]$msg) { Write-Host ("  [WARN] " + $msg) -ForegroundColor Yellow; $script:warned++; $script:findings += "| WARN | $msg |" }
function Fail([string]$msg) { Write-Host ("  [FAIL] " + $msg) -ForegroundColor Red;    $script:failed++; $script:findings += "| FAIL | $msg |" }
function Info([string]$msg) { Write-Host ("     " + $msg) -ForegroundColor DarkGray }

function GetGitBranch { try { (git branch --show-current).Trim() } catch { "" } }
function GetOwnerName {
  try { $n = (git config user.name).Trim(); if ($n) { return $n } } catch {}
  if ($env:USERNAME) { return $env:USERNAME }
  return "Unknown"
}

function EnsureChecklist([string]$path) {
  Ensure-Dir (Split-Path $path -Parent)
  if (-not (Test-Path $path)) {
@"
# LiberiaLearn - AUDIT GATE 1

## Status
Current Sprint:
Date:
Owner:
Result:
Counts:
Report:
"@ | Set-Content -Path $path -Encoding UTF8
  } else {
    $raw = ReadText $path
    if ($raw -notmatch "(?ms)^\s*##\s*Status\s*$") {
      Add-Content -Path $path -Value "`r`n`r`n## Status`r`nCurrent Sprint:`r`nDate:`r`nOwner:`r`nResult:`r`nCounts:`r`nReport:`r`n" -Encoding UTF8
    }
  }
}

function UpdateChecklistStatus([string]$path, [string]$resultLine, [string]$reportRel, [int]$p, [int]$w, [int]$f) {
  EnsureChecklist $path
  $bak = BackupFile $path
  Info ("Checklist backup: " + (Split-Path $bak -Leaf))

  $branch = GetGitBranch
  $owner  = GetOwnerName
  $date   = Get-Date -Format "yyyy-MM-dd"
  $sprint = if ($branch) { $branch } else { "unknown" }

  $newBlock = @"
## Status
Current Sprint: $sprint
Date: $date
Owner: $owner
Result: $resultLine
Counts: PASS $p  WARN $w  FAIL $f
Report: $reportRel
"@

  $raw = ReadText $path
  if ($raw -match "(?ms)^\s*##\s*Status\s*$") {
    $raw = [regex]::Replace($raw, "(?ms)^\s*##\s*Status\s*$.*?(?=^\s*##\s+|\z)", $newBlock.TrimEnd() + "`r`n")
  } else {
    $raw = $raw.TrimEnd() + "`r`n`r`n" + $newBlock.TrimEnd() + "`r`n"
  }

  Set-Content -Path $path -Value $raw -Encoding UTF8
}

# Preconditions
if (-not (Test-Path ".git")) { throw "Run from repo root (where .git exists)." }

Ensure-Dir "docs\audits"
EnsureChecklist "docs\audits\AUDIT_GATE_1.md"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$reportDateCompact = Get-Date -Format "yyyyMMdd"
$reportPath = "docs\audits\AUDIT_GATE_1_REPORT_$reportDateCompact.md"

Write-Host ""
Write-Host "LiberiaLearn - Audit Gate 1" -ForegroundColor White
Write-Host "Architecture and RBAC Review" -ForegroundColor DarkGray
Write-Host $timestamp -ForegroundColor DarkGray
Write-Host ("Report: " + $reportPath) -ForegroundColor DarkGray
Write-Host "Checklist: docs/audits/AUDIT_GATE_1.md (auto-update)" -ForegroundColor DarkGray

# SECTION 1 - Tests (Windows-safe)
Write-Section "SECTION 1 - Tests"

$testOutput = ""
$ec = 999
try {
  $testOutput = & cmd /c "set NO_COLOR=1 && npx vitest run --run --maxConcurrency=1" 2>&1 | Out-String
  $ec = $LASTEXITCODE
} catch {
  $testOutput = ($testOutput + "`n" + $_.Exception.Message)
  $ec = 999
}

$clean = StripAnsi $testOutput

if ($ec -ne 0) {
  $lines = @($clean -split "`r?`n" | Where-Object { $_ -and $_.Trim() -ne "" })
  $hint = ""
  if ($lines.Count -gt 0) {
    $hint = ($lines | Select-Object -First 3) -join " | "
  }
  Fail ("Tests failed (exit code " + $ec + "). Hint: " + $hint)
} else {
  Pass "All tests pass (exit code 0)"
}

if ($clean -match "(\d+)\s+skipped") {
  Warn ("Skipped tests detected: " + $Matches[1])
}

# SECTION 2 - RBAC
Write-Section "SECTION 2 - RBAC Permission Strings"

if (Test-Path "lib\permissions.ts") {
  Pass "lib/permissions.ts exists"
  $perm = ReadText "lib\permissions.ts"
  foreach ($p in @("view:school:dashboard","view:national:dashboard","view:district:dashboard")) {
    if ($perm -match [regex]::Escape($p)) { Pass ("Permission defined: " + $p) }
    else { Fail ("Missing permission: " + $p) }
  }
} else {
  Fail "lib/permissions.ts not found"
}

$routes = Get-ChildItem -Path "app\api\admin\dashboard" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue
if ($routes) {
  $missing = @()
  foreach ($r in $routes) {
    $c = ReadText $r.FullName
    if ($c -notmatch "assertPermission|hasPermission|getServerSession") { $missing += $r.FullName }
  }
  if ($missing.Count -gt 0) { Fail ("Dashboard routes missing auth markers: " + ($missing -join ", ")) }
  else { Pass ("All " + $routes.Count + " dashboard routes have auth markers") }
} else {
  Warn "No dashboard routes found under app/api/admin/dashboard"
}

# SECTION 3 - Tenant Isolation (WARN only)
Write-Section "SECTION 3 - Tenant Isolation"

$libFiles = Get-ChildItem -Path "lib" -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "node_modules|\.bak_" }

$suspicious = @()
foreach ($f in $libFiles) {
  $c = ReadText $f.FullName
  $matches = [regex]::Matches($c, 'prisma\.\w+\.(findMany|findFirst|count|aggregate)\s*\(\s*\{(?![\s\S]*?tenantId)[\s\S]*?\}\s*\)')
  foreach ($m in $matches) {
    $snippet = $m.Value
    if ($snippet.Length -gt 90) { $snippet = $snippet.Substring(0,90) + "..." }
    $suspicious += ("$($f.Name): " + $snippet)
  }
}

if ($suspicious.Count -gt 0) {
  Warn ("Possible missing tenantId in Prisma queries: " + $suspicious.Count + " hit(s) (showing first 10)")
  $suspicious | Select-Object -First 10 | ForEach-Object { Info $_ }
} else {
  Pass "No obvious tenantId gaps detected in lib/"
}

# REPORT
Write-Section "GENERATING REPORT"

$gateStatus = if ($failed -eq 0) { "PASSED" } else { "FAILED" }
$resultLine = if ($failed -eq 0) { "PASS" } else { "FAIL" }

$report = @"
# LiberiaLearn - Audit Gate 1 Report
Date: $timestamp
Gate: $gateStatus
Results: PASS $passed  WARN $warned  FAIL $failed

## Findings
| Status | Finding |
|--------|---------|
$($findings -join "`n")
"@

Set-Content -Path $reportPath -Value (StripAnsi $report) -Encoding UTF8
Write-Host ("Report written: " + $reportPath) -ForegroundColor Cyan

try {
  UpdateChecklistStatus "docs\audits\AUDIT_GATE_1.md" $resultLine $reportPath $passed $warned $failed
  Write-Host "Checklist updated: docs/audits/AUDIT_GATE_1.md" -ForegroundColor Cyan
} catch {
  Warn ("Checklist update failed: " + $_.Exception.Message)
}

Write-Host ""
$finalColor = if ($failed -eq 0) { "Green" } else { "Red" }
Write-Host ("AUDIT GATE 1 COMPLETE - " + $gateStatus) -ForegroundColor $finalColor

if ($failed -eq 0) { exit 0 } else { exit 1 }
.Exception.Message)
  $probeExit = 999
}

$probeClean = StripAnsi $probeOut

if ($probeExit -ne 0 -and $probeClean -match "PIPE_SPAWN_ERROR:(?<code>[^:]+):") {
  $code = $Matches["code"]
  Fail ("Preflight failed: Node cannot spawn child process with piped stdio (code=" + $code + "). Vite/Vitest may not run on this machine.")
  Warn "Likely cause: Windows Defender Controlled Folder Access, corporate EDR/AppLocker, or exploit protection policy blocking CreatePipe for node.exe."
  Warn "Fix options (try in order):"
  Warn "1) Run PowerShell as Administrator and retry this audit."
  Warn "2) Add Defender/EDR exclusions for:"
  Warn "   - C:\Program Files\nodejs\node.exe"
  Warn "   - repo folder: C:\Users\fasir\liberia-learn"
  Warn "   - esbuild: C:\Users\fasir\liberia-learn\node_modules\@esbuild\win32-x64\esbuild.exe"
  Warn "3) Temporarily disable Controlled Folder Access and retry."
  Warn "4) If corporate device: ask IT to allow Node child processes with pipes."
  Warn ("Preflight details: " + ($probeClean.Trim() -replace "\r?\n"," | "))
  Write-Section "STOPPED"
  Write-Host "Audit stopped before running tests due to pipe restriction." -ForegroundColor Red
  exit 1
} else {
  Pass "Preflight OK: Node child_process with pipes allowed"
}

# SECTION 1 - Tests (Windows-safe)
Write-Section "SECTION 1 - Tests"

$testOutput = ""
$ec = 999
try {
  $testOutput = & cmd /c "set NO_COLOR=1 && npx vitest run --run --maxConcurrency=1" 2>&1 | Out-String
  $ec = $LASTEXITCODE
} catch {
  $testOutput = ($testOutput + "`n" + $_.Exception.Message)
  $ec = 999
}

$clean = StripAnsi $testOutput

if ($ec -ne 0) {
  $lines = @($clean -split "`r?`n" | Where-Object { $_ -and $_.Trim() -ne "" })
  $hint = ""
  if ($lines.Count -gt 0) {
    $hint = ($lines | Select-Object -First 3) -join " | "
  }
  Fail ("Tests failed (exit code " + $ec + "). Hint: " + $hint)
} else {
  Pass "All tests pass (exit code 0)"
}

if ($clean -match "(\d+)\s+skipped") {
  Warn ("Skipped tests detected: " + $Matches[1])
}

# SECTION 2 - RBAC
Write-Section "SECTION 2 - RBAC Permission Strings"

if (Test-Path "lib\permissions.ts") {
  Pass "lib/permissions.ts exists"
  $perm = ReadText "lib\permissions.ts"
  foreach ($p in @("view:school:dashboard","view:national:dashboard","view:district:dashboard")) {
    if ($perm -match [regex]::Escape($p)) { Pass ("Permission defined: " + $p) }
    else { Fail ("Missing permission: " + $p) }
  }
} else {
  Fail "lib/permissions.ts not found"
}

$routes = Get-ChildItem -Path "app\api\admin\dashboard" -Recurse -Filter "route.ts" -ErrorAction SilentlyContinue
if ($routes) {
  $missing = @()
  foreach ($r in $routes) {
    $c = ReadText $r.FullName
    if ($c -notmatch "assertPermission|hasPermission|getServerSession") { $missing += $r.FullName }
  }
  if ($missing.Count -gt 0) { Fail ("Dashboard routes missing auth markers: " + ($missing -join ", ")) }
  else { Pass ("All " + $routes.Count + " dashboard routes have auth markers") }
} else {
  Warn "No dashboard routes found under app/api/admin/dashboard"
}

# SECTION 3 - Tenant Isolation (WARN only)
Write-Section "SECTION 3 - Tenant Isolation"

$libFiles = Get-ChildItem -Path "lib" -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "node_modules|\.bak_" }

$suspicious = @()
foreach ($f in $libFiles) {
  $c = ReadText $f.FullName
  $matches = [regex]::Matches($c, 'prisma\.\w+\.(findMany|findFirst|count|aggregate)\s*\(\s*\{(?![\s\S]*?tenantId)[\s\S]*?\}\s*\)')
  foreach ($m in $matches) {
    $snippet = $m.Value
    if ($snippet.Length -gt 90) { $snippet = $snippet.Substring(0,90) + "..." }
    $suspicious += ("$($f.Name): " + $snippet)
  }
}

if ($suspicious.Count -gt 0) {
  Warn ("Possible missing tenantId in Prisma queries: " + $suspicious.Count + " hit(s) (showing first 10)")
  $suspicious | Select-Object -First 10 | ForEach-Object { Info $_ }
} else {
  Pass "No obvious tenantId gaps detected in lib/"
}

# REPORT
Write-Section "GENERATING REPORT"

$gateStatus = if ($failed -eq 0) { "PASSED" } else { "FAILED" }
$resultLine = if ($failed -eq 0) { "PASS" } else { "FAIL" }

$report = @"
# LiberiaLearn - Audit Gate 1 Report
Date: $timestamp
Gate: $gateStatus
Results: PASS $passed  WARN $warned  FAIL $failed

## Findings
| Status | Finding |
|--------|---------|
$($findings -join "`n")
"@

Set-Content -Path $reportPath -Value (StripAnsi $report) -Encoding UTF8
Write-Host ("Report written: " + $reportPath) -ForegroundColor Cyan

try {
  UpdateChecklistStatus "docs\audits\AUDIT_GATE_1.md" $resultLine $reportPath $passed $warned $failed
  Write-Host "Checklist updated: docs/audits/AUDIT_GATE_1.md" -ForegroundColor Cyan
} catch {
  Warn ("Checklist update failed: " + $_.Exception.Message)
}

Write-Host ""
$finalColor = if ($failed -eq 0) { "Green" } else { "Red" }
Write-Host ("AUDIT GATE 1 COMPLETE - " + $gateStatus) -ForegroundColor $finalColor

if ($failed -eq 0) { exit 0 } else { exit 1 }
