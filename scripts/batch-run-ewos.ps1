param(
  [Parameter(Mandatory=$false)]
  [string]$BatchFile = ".\FactoryArtifacts\Batch\grade5_subjects.json",

  [Parameter(Mandatory=$false)]
  [string]$EwoPrefix = "EWO-G5",

  [Parameter(Mandatory=$false)]
  [int]$StartIndex = 1
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BatchFile)) { throw "Batch file not found: $BatchFile" }

$batch = Get-Content $BatchFile -Raw | ConvertFrom-Json
$grade = [int]$batch.grade
$model = [string]$batch.model

$subjects = @()
$batch.subjects | ForEach-Object { $subjects += [string]$_ }

Write-Host "📦 Batch run starting: Grade $grade | Subjects=$($subjects.Count) | Model=$model" -ForegroundColor Cyan
Write-Host "   Batch file: $BatchFile" -ForegroundColor Gray

for ($i=0; $i -lt $subjects.Count; $i++) {
  $idx = $StartIndex + $i
  $ewo = "{0}-{1:D2}-{2}" -f $EwoPrefix, $idx, $subjects[$i]
  Write-Host "`n==============================" -ForegroundColor DarkGray
  Write-Host "▶ Running $ewo" -ForegroundColor Yellow
  & powershell -ExecutionPolicy Bypass -File ".\scripts\run-ewo.ps1" -EwoId $ewo -Grade $grade -Subject $subjects[$i] -Model $model
}

Write-Host "`n✅ Batch complete." -ForegroundColor Green
