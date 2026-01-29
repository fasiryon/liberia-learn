# scripts/update-prisma-curriculumcontent.ps1
param(
  [string]$SchemaPath = "prisma/schema.prisma"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $SchemaPath)) {
  throw "Schema file not found: $SchemaPath"
}

# --- Desired model block (exact content you provided) ---
$DesiredModel = @'
model CurriculumContent {
  id           String   @id @default(cuid())
  contentId    String   @unique   // metadata.id
  grade        Int
  subject      String
  contentType  String
  status       String
  version      String
  payload      Json
  hash         String?  @unique
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([grade, subject])
  @@index([contentType, status])
}
'@

# --- Backup ---
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$SchemaPath.bak-$timestamp"
Copy-Item -Path $SchemaPath -Destination $backupPath -Force
Write-Host "Backup created: $backupPath"

# --- Read file ---
$content = Get-Content -Path $SchemaPath -Raw

# --- Regex to find model CurriculumContent block (multi-line, non-greedy) ---
$pattern = '(?ms)^\s*model\s+CurriculumContent\s*\{.*?^\s*\}\s*'

if ($content -match $pattern) {
  # Replace existing block
  $updated = [regex]::Replace($content, $pattern, $DesiredModel.TrimEnd() + "`r`n")
  Write-Host "Replaced existing CurriculumContent model."
} else {
  # Append if missing
  $sep = if ($content.EndsWith("`r`n")) { "" } else { "`r`n" }
  $updated = $content + $sep + "`r`n" + $DesiredModel.TrimEnd() + "`r`n"
  Write-Host "Appended CurriculumContent model (it was missing)."
}

# --- Write back ---
Set-Content -Path $SchemaPath -Value $updated -NoNewline -Encoding UTF8
Write-Host "Updated: $SchemaPath"
