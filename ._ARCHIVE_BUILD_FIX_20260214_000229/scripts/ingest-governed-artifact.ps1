param(
  [Parameter(Mandatory=$true)][string]$EwoId,
  [Parameter(Mandatory=$true)][string]$Agent1Path,
  [Parameter(Mandatory=$true)][string]$GovernancePath,
  [string]$SchemaId = "SUBJECT-UNKNOWN",
  [string]$Agent5Path = ""
)

$ErrorActionPreference = "Stop"

# Prefer ts-node route
$ts = ".\scripts\ingest-governed-artifact.ts"
if (-not (Test-Path $ts)) { throw "Missing: $ts" }

$args = @(
  $ts,
  "--ewoId", $EwoId,
  "--schemaId", $SchemaId,
  "--agent1", $Agent1Path,
  "--governance", $GovernancePath
)

if ($Agent5Path -and (Test-Path $Agent5Path)) {
  $args += @("--agent5", $Agent5Path)
}

npx ts-node @args
