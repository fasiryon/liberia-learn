param(
  [Parameter(Mandatory = $true, ParameterSetName = "Command")]
  [string]$Command,

  [Parameter(Mandatory = $true, ParameterSetName = "File")]
  [string]$File,

  [ValidateSet("P2A_STAGING_DATABASE_URL", "DATABASE_URL")]
  [string]$UrlVariable = "P2A_STAGING_DATABASE_URL"
)

$ErrorActionPreference = "Stop"
$clientImage = "postgres:17-alpine"
$urlValue = [Environment]::GetEnvironmentVariable($UrlVariable)
if ([string]::IsNullOrWhiteSpace($urlValue)) {
  throw "$UrlVariable is missing"
}

& docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Docker is unavailable"
}

$parsedUrl = [Uri]$urlValue
$userInfo = $parsedUrl.UserInfo.Split(':', 2)
if ($parsedUrl.Scheme -notin @("postgres", "postgresql") -or $userInfo.Count -ne 2) {
  throw "$UrlVariable is not a valid PostgreSQL URL"
}
if ($UrlVariable -eq "P2A_STAGING_DATABASE_URL") {
  $approvedStagingRef = "yonpfzjczoffhrgibxkz"
  $productionRef = "bnphuinpvgpmebcsvmsp"
  $declaredRef = [Environment]::GetEnvironmentVariable("P2A_STAGING_PROJECT_REF")
  $databaseHost = $parsedUrl.Host.ToLowerInvariant()
  $databaseUser = [Uri]::UnescapeDataString($userInfo[0])
  $isDirect = $databaseHost -eq "db.$approvedStagingRef.supabase.co" -and
    $parsedUrl.Port -eq 5432 -and $databaseUser -eq "postgres"
  $isSessionPooler = $databaseHost -match '^aws-[a-z0-9-]+\.pooler\.supabase\.com$' -and
    $parsedUrl.Port -eq 5432 -and $databaseUser -eq "postgres.$approvedStagingRef"
  if ($declaredRef -ne $approvedStagingRef -or $declaredRef -eq $productionRef) {
    throw "P2A staging project identity is not approved"
  }
  if (-not $isDirect -and -not $isSessionPooler) {
    throw "P2A migration transport must use approved direct or Supavisor session mode on port 5432"
  }
  if ($parsedUrl.Query -notmatch '(^|[?&])sslmode=require(&|$)') {
    throw "P2A migration transport must include sslmode=require"
  }
  if ($isSessionPooler -and
      [Environment]::GetEnvironmentVariable("P2A_DIRECT_ENDPOINT_UNREACHABLE") -ne "true") {
    throw "P2A session-mode fallback requires P2A_DIRECT_ENDPOINT_UNREACHABLE=true"
  }
  if ($parsedUrl.Port -eq 6543 -or $parsedUrl.Query -match '(^|[?&])pgbouncer=true(&|$)') {
    throw "Supavisor transaction mode is prohibited for migration/native DDL"
  }
}

$clientEnvironment = [ordered]@{
  PGHOST = $parsedUrl.Host
  PGPORT = $parsedUrl.Port.ToString()
  PGUSER = [Uri]::UnescapeDataString($userInfo[0])
  PGPASSWORD = [Uri]::UnescapeDataString($userInfo[1])
  PGDATABASE = [Uri]::UnescapeDataString($parsedUrl.AbsolutePath.TrimStart('/'))
  PGSSLMODE = "require"
}
$previousEnvironment = @{}
$dockerArgs = @("run", "--rm", "-i")
foreach ($name in $clientEnvironment.Keys) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name)
  [Environment]::SetEnvironmentVariable($name, $clientEnvironment[$name])
  $dockerArgs += @("-e", $name)
}

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

$dockerArgs += @($clientImage, "psql", "-X", "-v", "ON_ERROR_STOP=1")
$dockerArgs += $psqlArgs
try {
  & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed"
  }
} finally {
  foreach ($name in $clientEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name])
  }
}
