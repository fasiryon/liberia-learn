$schemaPath = ".\prisma\schema.prisma"
if (-not (Test-Path $schemaPath)) { throw "Missing $schemaPath" }

$text = Get-Content $schemaPath -Raw

# Fix invalid # comments to Prisma // comments
$text = $text -replace '(?m)^\s*#\s*', '// '

# Fix multi-line @relation(...) blocks into one line for CurriculumContent/GovernedArtifact
# (This targets the specific broken block shape from your earlier paste.)
$text = $text -replace '(?s)curriculumContent\s+CurriculumContent\?\s+@relation\(\s*"GovernedToContent",\s*fields:\s*\[curriculumContentId\],\s*references:\s*\[id\]\s*\)',
  'curriculumContent   CurriculumContent? @relation("GovernedToContent", fields: [curriculumContentId], references: [id])'

# Backup + write
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $schemaPath "$schemaPath.bak.fix.$ts" -Force
Set-Content -Path $schemaPath -Value $text -Encoding UTF8

Write-Host "✅ Patched relation syntax + comments. Backup: $schemaPath.bak.fix.$ts"
