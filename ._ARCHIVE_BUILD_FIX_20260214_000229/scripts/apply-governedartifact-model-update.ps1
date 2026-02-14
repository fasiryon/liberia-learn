# scripts\apply-governedartifact-model-update.ps1
# Updates/creates the Prisma model "GovernedArtifact" in prisma\schema.prisma
# - Makes a timestamped backup
# - If model exists: replaces the whole model block
# - If model does not exist: appends it to the end of the file

param(
  [string]$SchemaPath = ".\prisma\schema.prisma"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (!(Test-Path $SchemaPath)) {
  throw "Schema file not found: $SchemaPath"
}

# --- Backup ---
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$bak = "$SchemaPath.bak-$ts"
Copy-Item -Path $SchemaPath -Destination $bak -Force
Write-Host "✅ Backup created: $bak"

# --- The desired model block (exactly as you provided) ---
$NewModel = @'
model GovernedArtifact {
  id                  String   @id @default(cuid())
  createdAt           DateTime @default(now())
  updatedAt           DateTime? // DB column exists from v2 migration

  ewoId               String   @unique
  schemaId            String

  // NEW v2 fields (DB already has these columns)
  decision            String?
  reason              String?
  appliedPatch        Boolean  @default(false)
  patchJson           Json?
  governanceModel     String?
  governanceTimestamp DateTime @default(now())
  agent1Path          String?
  agent5Path          String?
  governancePath      String?

  // Legacy fields (keep for backward compatibility if they already exist)
  governanceDecision  String?
  governanceReason    String?

  // Required in your current schema.prisma
  artifactJson        Json

  curriculumContentId String?
  curriculumContent   CurriculumContent? @relation(fields: [curriculumContentId], references: [id])

  @@index([schemaId])
  @@index([curriculumContentId])
}
'@

# --- Read schema ---
$schema = Get-Content -Path $SchemaPath -Raw -Encoding UTF8

# --- Regex to match the entire model block (non-greedy) ---
$pattern = '(?ms)^\s*model\s+GovernedArtifact\s*\{\s*.*?\n\}\s*'

if ($schema -match $pattern) {
  # Replace existing block
  $updated = [regex]::Replace($schema, $pattern, "$NewModel`r`n", 1)
  Set-Content -Path $SchemaPath -Value $updated -Encoding UTF8
  Write-Host "✅ Replaced existing model GovernedArtifact in: $SchemaPath"
} else {
  # Append to end (with clean spacing)
  $trimmed = $schema.TrimEnd()
  $updated = $trimmed + "`r`n`r`n" + $NewModel + "`r`n"
  Set-Content -Path $SchemaPath -Value $updated -Encoding UTF8
  Write-Host "✅ Added new model GovernedArtifact to end of: $SchemaPath"
}

Write-Host ""
Write-Host "NEXT (run these):"
Write-Host "  npx prisma format"
Write-Host "  npx prisma validate"
Write-Host "  npx prisma generate"
