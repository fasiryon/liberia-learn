param(
  [string]$SchemaPath = ".\prisma\schema.prisma"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (!(Test-Path $SchemaPath)) { throw "Schema file not found: $SchemaPath" }

# Backup
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$bak = "$SchemaPath.bak-$ts"
Copy-Item $SchemaPath $bak -Force
Write-Host "✅ Backup created: $bak"

$schema = Get-Content -Path $SchemaPath -Raw -Encoding UTF8

# 1) Remove the duplicate field line (capital C field name)
#    Example line:
#    CurriculumContent   CurriculumContent? @relation(fields: [curriculumContentId], references: [id])
$schema2 = [regex]::Replace(
  $schema,
  '(?m)^\s*CurriculumContent\s+CurriculumContent\?\s+@relation\(\s*fields:\s*\[\s*curriculumContentId\s*\]\s*,\s*references:\s*\[\s*id\s*\]\s*\)\s*\r?\n',
  ''
)

# 2) Ensure the remaining relation is named and matches CurriculumContent.governedArtifacts @relation("GovernedToContent")
#    Replace:
#    curriculumContent   CurriculumContent? @relation(fields: [curriculumContentId], references: [id])
#    With:
#    curriculumContent   CurriculumContent? @relation("GovernedToContent", fields: [curriculumContentId], references: [id])
$schema3 = [regex]::Replace(
  $schema2,
  '(?m)^(\s*curriculumContent\s+CurriculumContent\?\s+)@relation\(\s*fields:\s*\[\s*curriculumContentId\s*\]\s*,\s*references:\s*\[\s*id\s*\]\s*\)\s*$',
  '${1}@relation("GovernedToContent", fields: [curriculumContentId], references: [id])'
)

if ($schema3 -eq $schema) {
  Write-Host "⚠️ No changes were applied. The expected patterns weren’t found exactly."
  Write-Host "   Open prisma\schema.prisma around GovernedArtifact and CurriculumContent and confirm the lines match the error."
} else {
  Set-Content -Path $SchemaPath -Value $schema3 -Encoding UTF8
  Write-Host "✅ Fixed duplicate relation + aligned relation name (GovernedToContent)."
}

Write-Host ""
Write-Host "NEXT:"
Write-Host "  npx prisma format"
Write-Host "  npx prisma validate"
Write-Host "  npx prisma generate"
