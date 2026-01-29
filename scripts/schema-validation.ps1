function Resolve-LockedSchemaPath {
  param(
    [string]$SchemaPath
  )

  $lockPath = ".\docs\internal\schemas\unified-curriculum-schema.v1.lock.json"
  if ($SchemaPath -and (Test-Path $SchemaPath)) { return $SchemaPath }

  if (Test-Path $lockPath) {
    $lock = Get-Content $lockPath -Raw | ConvertFrom-Json
    if ($lock.path -and (Test-Path $lock.path)) { return $lock.path }
  }

  $fallback = ".\docs\internal\schemas\unified-curriculum-schema.json"
  if (Test-Path $fallback) { return $fallback }

  throw "No schema file found. Expected lock at $lockPath or schema at $fallback."
}

function Test-CurriculumSchema {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)]
    [string]$JsonPath,

    [Parameter(Mandatory=$false)]
    [string]$SchemaPath,

    [Parameter(Mandatory=$false)]
    [switch]$FailOnError = $true
  )

  if (!(Test-Path $JsonPath)) { throw "JSON file not found: $JsonPath" }

  $SchemaPath = Resolve-LockedSchemaPath -SchemaPath $SchemaPath
  if (!(Test-Path $SchemaPath)) { throw "Schema file not found: $SchemaPath" }

  Write-Host "🔎 AJV validate"
  Write-Host "   Schema: $SchemaPath"
  Write-Host "   JSON:   $JsonPath"

  # Stable flags for your AJV CLI (no --formats / no --plugin)
  & npx ajv validate `
    --strict=false `
    --all-errors `
    -s $SchemaPath `
    -d $JsonPath

  if ($LASTEXITCODE -ne 0) {
    if ($FailOnError) { throw "❌ Schema validation failed for $JsonPath" }
    return $false
  }

  Write-Host "✅ Schema validation passed" -ForegroundColor Green
  return $true
}
