param(
  [string]$SchemaPath = ".\prisma\schema.prisma"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Content
  )
  $enc = New-Object System.Text.UTF8Encoding($false) # NO BOM
  [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, $enc)
}

if (!(Test-Path $SchemaPath)) { throw "Schema file not found: $SchemaPath" }

# Backup
$ts  = Get-Date -Format "yyyyMMdd-HHmmss"
$bak = "$SchemaPath.bak-$ts"
Copy-Item $SchemaPath $bak -Force
Write-Host "✅ Backup created: $bak"

$schema = Get-Content -Path $SchemaPath -Raw

# If already present, do nothing
$already = [regex]::IsMatch($schema, '(?m)^\s*model\s+ObjectiveMasterySnapshot\s*\{')
if ($already) {
  Write-Host "ℹ️ Longitudinal grading models already present. No changes applied."
  exit 0
}

# Build the Prisma block WITHOUT here-strings (avoid terminator issues)
$lines = New-Object System.Collections.Generic.List[string]

$lines.Add("")
$lines.Add("//")
$lines.Add("// -------------------------------")
$lines.Add("// Longitudinal Grading Additions")
$lines.Add("// -------------------------------")
$lines.Add("// ObjectiveMasterySnapshot: append-only mastery history")
$lines.Add("// MasteryEvidence: links snapshot to grade evidence")
$lines.Add("// StudentIntervention + InterventionOutcome: what we tried + did it work")
$lines.Add("// CohortBenchmark: nightly aggregates for cohort comparisons")
$lines.Add("//")

$lines.Add("")
$lines.Add("enum MasteryMeasurementType {")
$lines.Add("  FORMATIVE")
$lines.Add("  SUMMATIVE")
$lines.Add("}")

$lines.Add("")
$lines.Add("enum EvidenceSourceType {")
$lines.Add("  ASSESSMENT")
$lines.Add("  ASSIGNMENT")
$lines.Add("  PROJECT")
$lines.Add("  LAB")
$lines.Add("  OBSERVATION")
$lines.Add("  OTHER")
$lines.Add("}")

$lines.Add("")
$lines.Add("enum InterventionType {")
$lines.Add("  TUTORING")
$lines.Add("  RETEACH")
$lines.Add("  PEER_SUPPORT")
$lines.Add("  RESOURCE")
$lines.Add("  COUNSELING")
$lines.Add("  OTHER")
$lines.Add("}")

$lines.Add("")
$lines.Add("enum CohortType {")
$lines.Add("  CLASS")
$lines.Add("  GRADE_LEVEL")
$lines.Add("  SCHOOL")
$lines.Add("  COUNTY")
$lines.Add("  NATIONAL")
$lines.Add("}")

$lines.Add("")
$lines.Add("model ObjectiveMasterySnapshot {")
$lines.Add("  id               String   @id @default(cuid())")
$lines.Add("  createdAt        DateTime @default(now())")
$lines.Add("")
$lines.Add("  studentId        String")
$lines.Add("  skillId          String")
$lines.Add("")
$lines.Add("  masteryLevel     Float")
$lines.Add("  measuredAt       DateTime @default(now())")
$lines.Add("  measurementType  MasteryMeasurementType")
$lines.Add("  contextNote      String?")
$lines.Add("")
$lines.Add("  student          Student  @relation(fields: [studentId], references: [id])")
$lines.Add("  skill            Skill    @relation(fields: [skillId], references: [id])")
$lines.Add("")
$lines.Add("  evidence         MasteryEvidence[]")
$lines.Add("")
$lines.Add("  @@index([studentId, skillId, measuredAt])")
$lines.Add("  @@index([measuredAt])")
$lines.Add("}")

$lines.Add("")
$lines.Add("model MasteryEvidence {")
$lines.Add("  id          String   @id @default(cuid())")
$lines.Add("  createdAt   DateTime @default(now())")
$lines.Add("")
$lines.Add("  snapshotId  String")
$lines.Add("  gradeId     String?")
$lines.Add("")
$lines.Add("  sourceType  EvidenceSourceType")
$lines.Add("  weight      Float?")
$lines.Add("  recordedAt  DateTime  @default(now())")
$lines.Add("  note        String?")
$lines.Add("")
$lines.Add("  snapshot    ObjectiveMasterySnapshot @relation(fields: [snapshotId], references: [id])")
$lines.Add("  grade       Grade?    @relation(fields: [gradeId], references: [id])")
$lines.Add("")
$lines.Add("  @@index([snapshotId])")
$lines.Add("  @@index([gradeId])")
$lines.Add("}")

$lines.Add("")
$lines.Add("model StudentIntervention {")
$lines.Add("  id               String   @id @default(cuid())")
$lines.Add("  createdAt        DateTime @default(now())")
$lines.Add("  updatedAt        DateTime @updatedAt")
$lines.Add("")
$lines.Add("  studentId        String")
$lines.Add("  skillId          String")
$lines.Add("")
$lines.Add("  interventionType InterventionType")
$lines.Add("  startedAt        DateTime @default(now())")
$lines.Add("  endedAt          DateTime?")
$lines.Add("  notes            String?")
$lines.Add("  assignedByUserId String?")
$lines.Add("")
$lines.Add("  student          Student @relation(fields: [studentId], references: [id])")
$lines.Add("  skill            Skill   @relation(fields: [skillId], references: [id])")
$lines.Add("  assignedBy       User?   @relation(fields: [assignedByUserId], references: [id])")
$lines.Add("")
$lines.Add("  outcome          InterventionOutcome?")
$lines.Add("")
$lines.Add("  @@index([studentId, skillId, startedAt])")
$lines.Add("}")

$lines.Add("")
$lines.Add("model InterventionOutcome {")
$lines.Add("  interventionId     String  @id")
$lines.Add("  masteryBefore      Float?")
$lines.Add("  masteryAfter       Float?")
$lines.Add("  measuredAfterDays  Int?")
$lines.Add("  improvement        Float?")
$lines.Add("  success            Boolean?")
$lines.Add("  notes              String?")
$lines.Add("")
$lines.Add("  intervention       StudentIntervention @relation(fields: [interventionId], references: [id])")
$lines.Add("}")

$lines.Add("")
$lines.Add("model CohortBenchmark {")
$lines.Add("  id            String   @id @default(cuid())")
$lines.Add("  createdAt     DateTime @default(now())")
$lines.Add("")
$lines.Add("  cohortType    CohortType")
$lines.Add("  cohortId      String?")
$lines.Add("  skillId       String")
$lines.Add("")
$lines.Add("  measuredAt    DateTime")
$lines.Add("  medianMastery Float?")
$lines.Add("  p25Mastery    Float?")
$lines.Add("  p75Mastery    Float?")
$lines.Add("  sampleSize    Int?")
$lines.Add("")
$lines.Add("  skill         Skill @relation(fields: [skillId], references: [id])")
$lines.Add("")
$lines.Add("  @@index([cohortType, cohortId, skillId, measuredAt])")
$lines.Add("}")

$block = ($lines -join "`r`n")

$updated = $schema.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
Write-Utf8NoBom -Path $SchemaPath -Content $updated

Write-Host "✅ Added longitudinal grading models to schema.prisma (UTF-8 no BOM)."
Write-Host "NEXT:"
Write-Host "  npx prisma format"
Write-Host "  npx prisma validate"
Write-Host "  npx prisma generate"
Write-Host "  npx prisma migrate dev --name add_longitudinal_grading (when ready)"
