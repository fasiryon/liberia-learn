param(
  [Parameter(Mandatory=$true)]
  [string]$SchemaPath
)

if (-not (Test-Path $SchemaPath)) {
  throw "Schema file not found: $SchemaPath"
}

$newCurriculumContent = @"
model CurriculumContent {
  id          String   @id @default(cuid())
  contentId   String   @unique // e.g., LESSON-G05-MATH-001 or SUBJECT-MATH-G05
  contentType String   // LESSON, UNIT, TERM, FULL_SUBJECT
  grade       Int
  subject     String
  jsonData    Json
  status      String   // draft, review, approved, published
  version     String   // semantic version like 1.0.0

  # Link back to governance
  governedArtifact   GovernedArtifact? @relation("GovernedToContent")

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  assets      CurriculumAsset[]

  @@index([grade, subject, contentType])
  @@index([status])
}
"@

$newGovernedArtifact = @"
model GovernedArtifact {
  id                  String   @id @default(cuid())
  ewoId               String   @unique
  schemaId            String   // ID inside metadata.id (or derived)
  decision            String   // ACCEPT, REPAIR, REJECT
  reason              String?
  appliedPatch        Boolean  @default(false)
  patchJson           Json?

  governanceModel     String?
  governanceTimestamp DateTime @default(now())

  agent1Path          String?
  agent5Path          String?
  governancePath      String?

  curriculumContentId String?  @unique
  curriculumContent   CurriculumContent? @relation(
    "GovernedToContent",
    fields: [curriculumContentId],
    references: [id]
  )

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([decision])
  @@index([governanceTimestamp])
}
"@

$content = Get-Content -Path $SchemaPath -Raw

$patternCurriculum = '(?s)model\s+CurriculumContent\s*\{.*?\}\s*'
$patternGoverned   = '(?s)model\s+GovernedArtifact\s*\{.*?\}\s*'

if (-not ([regex]::IsMatch($content, $patternCurriculum))) {
  throw "CurriculumContent model not found"
}
if (-not ([regex]::IsMatch($content, $patternGoverned))) {
  throw "GovernedArtifact model not found"
}

$timestamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$SchemaPath.bak.$timestamp"
Copy-Item $SchemaPath $backupPath -Force
Write-Host "Backup created: $backupPath"

$content = [regex]::Replace($content, $patternCurriculum, ($newCurriculumContent + "`r`n"), 1)
$content = [regex]::Replace($content, $patternGoverned,   ($newGovernedArtifact + "`r`n"), 1)

Set-Content -Path $SchemaPath -Value $content -Encoding UTF8
Write-Host "Schema updated successfully."
