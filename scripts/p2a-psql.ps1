param(
  [Parameter(Mandatory = $true, ParameterSetName = "Command")]
  [string]$Command,

  [Parameter(Mandatory = $true, ParameterSetName = "File")]
  [string]$File,

  [ValidateSet("P2A_STAGING_DATABASE_URL", "DATABASE_URL")]
  [string]$UrlVariable = "P2A_STAGING_DATABASE_URL"
)

$ErrorActionPreference = "Stop"
$clientImage = "postgres:16-alpine"
$urlValue = [Environment]::GetEnvironmentVariable($UrlVariable)
if ([string]::IsNullOrWhiteSpace($urlValue)) {
  throw "$UrlVariable is missing"
}

& docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Docker is unavailable"
}

$shell = 'url="$(printenv "$1")"; shift; exec psql "$url" -X -v ON_ERROR_STOP=1 "$@"'
$dockerArgs = @("run", "--rm", "-i", "-e", $UrlVariable)

if ($PSCmdlet.ParameterSetName -eq "File") {
  $resolvedFile = (Resolve-Path -LiteralPath $File).Path
  $repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
  if (-not $resolvedFile.StartsWith($repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "SQL file must be inside the repository"
  }
  $relativePath = $resolvedFile.Substring($repositoryRoot.Length).TrimStart('\', '/') -replace '\\', '/'
  $dockerArgs += @("-v", "${repositoryRoot}:/workspace:ro")
  $psqlArgs = @("-f", "/workspace/$relativePath")
} else {
  $psqlArgs = @("-c", $Command)
}

$dockerArgs += @($clientImage, "sh", "-c", $shell, "p2a-psql", $UrlVariable)
$dockerArgs += $psqlArgs
& docker @dockerArgs
if ($LASTEXITCODE -ne 0) {
  throw "psql failed"
}
