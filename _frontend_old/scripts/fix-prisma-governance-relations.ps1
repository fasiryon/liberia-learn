$ErrorActionPreference = "Stop"

$SchemaPath = Resolve-Path ".\prisma\schema.prisma"

# Backup
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$SchemaPath.bak-$timestamp"
Copy-Item $SchemaPath $backupPath -Force
Write-Host "✅ Backup created: $backupPath"

$content = Get-Content -Path $SchemaPath -Raw

# -----------------------------
# 1) DEDUPE contentId lines
# -----------------------------
$curriculumRegex = '(?ms)^\s*model\s+CurriculumContent\s*\{.*?^\s*\}\s*'
$currMatch = [regex]::Match($content, $curriculumRegex)
if (-not $currMatch.Success) { throw "Could not find model CurriculumContent { ... }" }

$currBlock = $currMatch.Value

# Remove ALL contentId lines, then add ONE canonical line back
$currBlock = [regex]::Replace($currBlock, '(?m)^\s*contentId\s+String.*\r?\n?', '')

# Insert one canonical contentId after id line (fallback: after opening brace)
$currBlock2 = [regex]::Replace(
  $currBlock,
  '(?m)^\s*id\s+String\s+@id\s+@default\(cuid\(\)\)\s*$',
  '$0' + "`r`n" + '  contentId String   @unique // metadata.id',
  1
)
if ($currBlock2 -eq $currBlock) {
  $currBlock2 = [regex]::Replace(
    $currBlock,
    '(?m)^\s*model\s+CurriculumContent\s*\{\s*$',
    '$0' + "`r`n" + '  contentId String   @unique // metadata.id',
    1
  )
}
$currBlock = $currBlock2

Write-Host "✅ De-duplicated contentId (kept single canonical line)"

# Optional cleanup: remove governanceRecords if present (you already have governedArtifacts)
$currBlock = [regex]::Replace($currBlock, '(?m)^\s*governanceRecords\s+GovernedArtifact\[\]\s*$', '')

# Ensure governedArtifacts exists with correct relation name (ONLY if you intend to use it)
if ($currBlock -match '(?m)^\s*governedArtifacts\s+GovernedArtifact\[\].*$') {
  $currBlock = [regex]::Replace(
    $currBlock,
    '(?m)^\s*governedArtifacts\s+GovernedArtifact\[\].*$',
    '  governedArtifacts GovernedArtifact[] @relation("GovernedToContent")'
  )
  Write-Host "✅ Normalized governedArtifacts relation"
} else {
  # Add before closing brace
  $currBlock = [regex]::Replace(
    $currBlock,
    '(?m)^\s*\}\s*$',
    '  governedArtifacts GovernedArtifact[] @relation("GovernedToContent")' + "`r`n" + '}',
    1
  )
  Write-Host "✅ Added governedArtifacts relation"
}

# Put updated CurriculumContent block back
$content = $content -replace [regex]::Escape($currMatch.Value), $currBlock

# -----------------------------
# 2) Replace GovernedArtifact model with canonical relation name
# -----------------------------
$governedArtifactRegex = '(?ms)^\s*model\s+GovernedArtifact\s*\{.*?^\s*\}\s*'
$replacementGovernedArtifact = @"
model GovernedArtifact {
  id                  String   @id @default(cuid())
  ewoId               String   @unique
  schemaId            String

  decision            String   // ACCEPT | REPAIR | REJECT
  reason              String?
  appliedPatch        Boolean  @default(false)
  patchJson           Json?
  governanceModel     String?
  governanceTimestamp DateTime @default(now())

  agent1Path          String?
  agent5Path          String?
  governancePath      String?

  curriculumContentId String?
  curriculumContent   CurriculumContent? @relation("GovernedToContent", fields: [curriculumContentId], references: [id])

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([decision])
  @@index([ewoId])
  @@index([governanceTimestamp])
}
"@

if ($content -notmatch $governedArtifactRegex) {
  throw "Could not find 'model GovernedArtifact { ... }' block."
}
$content = [regex]::Replace($content, $governedArtifactRegex, $replacementGovernedArtifact)
Write-Host "✅ Replaced GovernedArtifact model block"

# Write back UTF-8 no BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($SchemaPath, $content, $utf8NoBom)

Write-Host "✅ Updated schema.prisma: $SchemaPath"
Write-Host "NEXT:"
Write-Host "  npx prisma format"
Write-Host "  npx prisma validate"
Write-Host "  npx prisma generate"
