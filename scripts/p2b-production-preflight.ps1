param(
  [ValidateSet("DATABASE_URL", "DIRECT_URL")]
  [string]$UrlVariable = "DATABASE_URL"
)

$ErrorActionPreference = "Stop"
$productionRef = "bnphuinpvgpmebcsvmsp"
$stagingRef = "yonpfzjczoffhrgibxkz"
$migrationA = "20260813_000001_p2b_qualified_review_operations"
$migrationASha = "655AD60067634CAB8277CA0F2DE327B1909BADDCDB3B5C5299E76537283BA1D0"
$migrationB = "20260814_000001_p2b_review_cycles"
$migrationBSha = "3F2FB655B50B9DF524B758993BE22EF5DE1E9C4950077E84A68D99DA186B89C1"
$urlValue = [Environment]::GetEnvironmentVariable($UrlVariable)
if ([string]::IsNullOrWhiteSpace($urlValue)) { throw "$UrlVariable is missing" }

$uri = [Uri]$urlValue
$userinfo = $uri.UserInfo.Split(':', 2)
if ($userinfo.Count -ne 2) { throw "Database URL is invalid" }
$databaseUser = [Uri]::UnescapeDataString($userinfo[0])
$dbHost = $uri.Host.ToLowerInvariant()
if ($dbHost -like "*$stagingRef*" -or $databaseUser -like "*$stagingRef*") { throw "Production preflight resolved to staging" }
$isProductionPooler = $dbHost -match '^aws-[a-z0-9-]+\.pooler\.supabase\.com$' -and $uri.Port -eq 6543 -and $databaseUser -eq "postgres.$productionRef"
$isProductionDirect = $dbHost -eq "db.$productionRef.supabase.co" -and $uri.Port -eq 5432 -and $databaseUser -eq "postgres"
if (-not $isProductionPooler -and -not $isProductionDirect) { throw "Database target is not the approved production endpoint" }
if ($uri.Query -notmatch '(^|[?&])sslmode=require(&|$)') { throw "Production transport must require TLS" }

$environment = @{
  PGHOST = $uri.Host
  PGPORT = $uri.Port.ToString()
  PGUSER = $databaseUser
  PGPASSWORD = [Uri]::UnescapeDataString($userinfo[1])
  PGDATABASE = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  PGSSLMODE = "require"
}
$dockerArgs = @("run", "--rm", "-i")
foreach ($name in $environment.Keys) {
  [Environment]::SetEnvironmentVariable($name, $environment[$name])
  $dockerArgs += @("-e", $name)
}
$dockerArgs += @("postgres:17-alpine", "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-F", "|")

function Query([string]$Sql) {
  $result = $Sql | & docker @dockerArgs -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "Production preflight SQL failed" }
  return ($result | Out-String).Trim()
}

try {
  $identity = Query "SELECT concat_ws('|', current_database(), current_user, current_setting('server_version'), COALESCE((SELECT ssl::text FROM pg_stat_ssl WHERE pid=pg_backend_pid()), 'false'));"
  $parts = $identity.Split('|')
  if ($parts.Count -ne 4 -or $parts[0] -ne "postgres" -or $parts[1] -ne "postgres" -or $parts[2] -notmatch '^17\.' -or ($parts[3] -ne "true" -and -not $isProductionPooler)) { throw "Production identity, PostgreSQL, or TLS assertion failed" }

  $ledger = Query "SELECT concat_ws('|', count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL), count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL), count(*) FILTER (WHERE migration_name LIKE '20260810_00000%_p2a_%'), count(*)) FROM public._prisma_migrations;"
  $ledgerParts = $ledger.Split('|')
  if ($ledgerParts.Count -ne 4 -or $ledgerParts[0] -ne "6" -or $ledgerParts[1] -ne "0" -or $ledgerParts[2] -ne "5") { throw "Unexpected production migration ledger: $ledger" }

  $p2aTables = Query "SELECT count(*) FROM (VALUES (to_regclass('public.' || chr(34) || 'CurriculumProvenance' || chr(34))), (to_regclass('public.' || chr(34) || 'CurriculumContentRevision' || chr(34))), (to_regclass('public.' || chr(34) || 'CurriculumGovernanceEvent' || chr(34))), (to_regclass('public.' || chr(34) || 'CurriculumEvidence' || chr(34)))) v(r) WHERE r IS NOT NULL;"
  if ($p2aTables -ne "4") { throw "P2-A table baseline is incomplete" }
  $p2bTables = Query "SELECT count(*) FROM (VALUES (to_regclass('public.' || chr(34) || 'ReviewerProfile' || chr(34))), (to_regclass('public.' || chr(34) || 'ReviewerCredential' || chr(34))), (to_regclass('public.' || chr(34) || 'ReviewerCredentialScope' || chr(34))), (to_regclass('public.' || chr(34) || 'ReviewerCredentialStatusEvent' || chr(34))), (to_regclass('public.' || chr(34) || 'ReviewerRestriction' || chr(34))), (to_regclass('public.' || chr(34) || 'CurriculumReviewTask' || chr(34))), (to_regclass('public.' || chr(34) || 'CurriculumReviewAssignment' || chr(34))), (to_regclass('public.' || chr(34) || 'CurriculumReviewAssessment' || chr(34))), (to_regclass('public.' || chr(34) || 'CurriculumReviewDecision' || chr(34))), (to_regclass('public.' || chr(34) || 'ReviewCalibrationSession' || chr(34))), (to_regclass('public.' || chr(34) || 'ReviewCalibrationResult' || chr(34)))) v(r) WHERE r IS NOT NULL;"
  if ($p2bTables -ne "0") { throw "P2-B tables already exist before Migration A" }

  $clientExposure = Query "SELECT concat_ws('|', (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('ReviewerProfile','ReviewerCredential','ReviewerCredentialScope','ReviewerCredentialStatusEvent','ReviewerRestriction','CurriculumReviewTask','CurriculumReviewAssignment','CurriculumReviewAssessment','CurriculumReviewDecision','ReviewCalibrationSession','ReviewCalibrationResult') AND grantee IN ('anon','authenticated')), has_schema_privilege('anon','public','USAGE'), has_schema_privilege('authenticated','public','USAGE'), current_setting('pgrst.db_schemas', true));"
  $activity = Query "SELECT concat_ws('|', count(*) FILTER (WHERE backend_xid IS NOT NULL AND xact_start < clock_timestamp() - interval '5 minutes'), count(*) FILTER (WHERE wait_event_type='Lock'), (SELECT count(*) FROM pg_locks WHERE NOT granted)) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid();"

  $pathA = Join-Path $PSScriptRoot "..\prisma\canonical\migrations\$migrationA\migration.sql"
  $pathB = Join-Path $PSScriptRoot "..\prisma\canonical\migrations\$migrationB\migration.sql"
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $pathA).Hash.ToUpperInvariant() -ne $migrationASha) { throw "Migration A hash mismatch" }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $pathB).Hash.ToUpperInvariant() -ne $migrationBSha) { throw "Migration B hash mismatch" }

  Write-Output "Production project: $productionRef"
  Write-Output "Database identity: $($parts[0])/$($parts[1])"
  Write-Output "PostgreSQL: $($parts[2])"
  Write-Output "TLS: PASS (sslmode=require; pooler backend ssl flag=$($parts[3]))"
  Write-Output "Active migrations: $($ledgerParts[0])"
  Write-Output "Unfinished migrations: $($ledgerParts[1])"
  Write-Output "P2-A migration rows: $($ledgerParts[2])"
  Write-Output "P2-A tables: $p2aTables"
  Write-Output "P2-B tables before migration: $p2bTables"
  Write-Output "P2-B direct client grants before migration: $($clientExposure.Split('|')[0])"
  Write-Output "Long transactions, lock waits, ungranted locks: $activity"
  Write-Output "Migration A hash: PASS"
  Write-Output "Migration B hash: PASS"
  Write-Output "P2-B PRODUCTION PREFLIGHT: PASS"
} finally {
  foreach ($name in $environment.Keys) { [Environment]::SetEnvironmentVariable($name, $null) }
}
