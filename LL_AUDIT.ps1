param(
  [string]$OutFile = ".\LL_AUDIT_REPORT.md"
)

$ErrorActionPreference = "Stop"

function Write-Line([string]$s="") {
  Add-Content -LiteralPath $OutFile -Value $s -Encoding UTF8
}

function Exists([string]$p) {
  return (Test-Path -LiteralPath $p)
}

function ReadAll([string]$p) {
  if (!(Exists $p)) { return "" }
  return Get-Content -LiteralPath $p -Raw
}

function Find-EnvRefsInText([string]$text) {
  # find process.env.X and env["X"] patterns
  $set = New-Object System.Collections.Generic.HashSet[string]

  $m1 = [regex]::Matches($text, 'process\.env\.([A-Z0-9_]+)')
  foreach ($m in $m1) { [void]$set.Add($m.Groups[1].Value) }

  $m2 = [regex]::Matches($text, 'process\.env\[\s*["'']([A-Z0-9_]+)["'']\s*\]')
  foreach ($m in $m2) { [void]$set.Add($m.Groups[1].Value) }

  return $set
}

function Get-FilesText([string[]]$paths) {
  $buf = ""
  foreach ($p in $paths) {
    if (Exists $p) { $buf += "`n`n===== $p =====`n" + (ReadAll $p) }
  }
  return $buf
}

# Reset report
if (Exists $OutFile) { Remove-Item -LiteralPath $OutFile -Force }
New-Item -ItemType File -Path $OutFile -Force | Out-Null

Write-Line "# LiberiaLearn Audit Report"
Write-Line ("Generated: " + (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
Write-Line ""

# --- Basic file presence
Write-Line "## 1) Repo File Presence"
$must = @(
  "package.json",
  "next.config.js",
  "middleware.ts",
  "prisma\schema.prisma",
  "lib\auth.ts",
  "lib\trackEvent.ts",
  "app\api\healthz\route.ts",
  "app\api\ai\chat\route.ts",
  "app\api\curriculum\route.ts",
  "app\api\curriculum\[contentId]\route.ts",
  "app\api\admin\curriculum\generate\route.ts",
  "app\teacher\curriculum\page.tsx",
  ".env.example"
)

foreach ($f in $must) {
  $status = $(if (Exists ".\$f") { "✅ present" } else { "❌ MISSING" })
  Write-Line ("- {0} : {1}" -f $f, $status)
}
Write-Line ""

# --- Package scripts
Write-Line "## 2) package.json scripts (what we can run)"
$pkg = ReadAll ".\package.json"
if ($pkg -eq "") {
  Write-Line "- ❌ package.json missing/unreadable"
} else {
  try {
    $pkgObj = $pkg | ConvertFrom-Json
    $scripts = $pkgObj.scripts
    if ($null -eq $scripts) {
      Write-Line "- ⚠️ No scripts field found"
    } else {
      Write-Line "- Scripts found:"
      $scripts.PSObject.Properties | ForEach-Object {
        Write-Line ("  - {0} = {1}" -f $_.Name, $_.Value)
      }
    }
  } catch {
    Write-Line "- ⚠️ package.json not valid JSON parse (but file exists)"
  }
}
Write-Line ""

# --- Prisma: extract CurriculumContent model block
Write-Line "## 3) Prisma schema: CurriculumContent"
$schema = ReadAll ".\prisma\schema.prisma"
if ($schema -eq "") {
  Write-Line "- ❌ prisma/schema.prisma missing/unreadable"
} else {
  $modelMatch = [regex]::Match($schema, 'model\s+CurriculumContent\s*\{([\s\S]*?)\n\}', 'IgnoreCase')
  if (!$modelMatch.Success) {
    Write-Line "- ❌ CurriculumContent model not found"
  } else {
    Write-Line "### CurriculumContent model (raw fields block)"
    Write-Line "```"
    Write-Line $modelMatch.Value.Trim()
    Write-Line "```"

    # Try to find a unique key hint
    $uniqueHints = @()
    $lines = $modelMatch.Value.Split("`n")
    foreach ($ln in $lines) {
      if ($ln -match '@unique' -or $ln -match '@@unique') { $uniqueHints += $ln.Trim() }
    }
    Write-Line ""
    Write-Line "### Unique constraints (detected)"
    if ($uniqueHints.Count -eq 0) {
      Write-Line "- ⚠️ No @unique/@@unique detected in CurriculumContent block (upsert key may be elsewhere)"
    } else {
      foreach ($u in $uniqueHints) { Write-Line ("- " + $u) }
    }
  }
}
Write-Line ""

# --- AI + env refs scan (targeted high-signal files + lib/ai folder)
Write-Line "## 4) Environment variables referenced in code"
$scanFiles = @(
  ".\next.config.js",
  ".\middleware.ts",
  ".\lib\auth.ts",
  ".\app\api\ai\chat\route.ts",
  ".\app\api\admin\curriculum\generate\route.ts"
)

# add all lib/ai files if folder exists
if (Exists ".\lib\ai") {
  $aiFiles = Get-ChildItem -LiteralPath ".\lib\ai" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
  foreach ($af in $aiFiles) { $scanFiles += $af }
}

$textBlob = ""
foreach ($sf in $scanFiles) {
  if (Exists $sf) {
    $textBlob += "`n`n===== $sf =====`n" + (ReadAll $sf)
  }
}

$envRefs = Find-EnvRefsInText $textBlob
if ($envRefs.Count -eq 0) {
  Write-Line "- ⚠️ No process.env.* references detected in scanned files (may exist elsewhere)"
} else {
  Write-Line "- Env vars referenced (deduped):"
  $envRefsArr = $envRefs.ToArray() | Sort-Object
  foreach ($v in $envRefsArr) {
    $val = [Environment]::GetEnvironmentVariable($v, "Process")
    $present = $(if ([string]::IsNullOrWhiteSpace($val)) { "❌ not set in current PS session" } else { "✅ set" })
    Write-Line ("  - {0} : {1}" -f $v, $present)
  }
}
Write-Line ""

# --- GROQ detection: tell if it appears required/optional
Write-Line "## 5) GROQ usage detection"
$g = ($textBlob -match "GROQ_API_KEY")
if ($g) {
  Write-Line "- GROQ_API_KEY referenced in scanned code: ✅ YES"
  Write-Line "- If you do NOT have a Groq key, this must be handled one of two ways:"
  Write-Line "  - Code already falls back to OpenAI when GROQ_API_KEY missing (✅ ok), OR"
  Write-Line "  - Code assumes Groq exists and will throw at runtime (❌ must change)"
  Write-Line "- This audit cannot prove fallback without reading the provider selection logic — check lib/ai/* selection code."
} else {
  Write-Line "- GROQ_API_KEY referenced in scanned code: ❌ NO"
  Write-Line "- You do NOT need a Groq key unless you later add Groq provider support."
}
Write-Line ""

# --- Vercel readiness checklist (static)
Write-Line "## 6) Vercel deployment checklist"
Write-Line "- Verify `NEXTAUTH_URL` points to your Vercel domain in production"
Write-Line "- Verify `NEXTAUTH_SECRET` set in Vercel env"
Write-Line "- Verify `DATABASE_URL` is a reachable production DB (Neon/Supabase/etc.)"
Write-Line "- Ensure Prisma client generation works during build"
Write-Line "- Ensure any server-only env vars are NOT referenced in client components"
Write-Line "- Confirm `app/api/healthz` exists (used for uptime checks)"
Write-Line ""

Write-Line "## 7) What to do next (based on this report)"
Write-Line "- If GROQ not referenced: ignore Groq."
Write-Line "- If referenced: decide provider strategy (OpenAI-only vs optional Groq)."
Write-Line "- Set missing env vars in Vercel Project Settings → Environment Variables."
Write-Line ""

Write-Output ("Audit complete ✅ -> " + (Resolve-Path $OutFile).Path)
