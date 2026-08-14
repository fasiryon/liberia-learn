param([string]$UrlVariable = "DATABASE_URL")
$ErrorActionPreference = "Stop"
$productionRef = "bnphuinpvgpmebcsvmsp"
$urlValue = [Environment]::GetEnvironmentVariable($UrlVariable)
if ([string]::IsNullOrWhiteSpace($urlValue)) { throw "$UrlVariable is missing" }
$uri = [Uri]$urlValue
$userinfo = $uri.UserInfo.Split(':', 2)
$user = [Uri]::UnescapeDataString($userinfo[0])
$dbHost = $uri.Host.ToLowerInvariant()
if ($dbHost -notmatch '^aws-[a-z0-9-]+\.pooler\.supabase\.com$' -or $uri.Port -ne 6543 -or $user -ne "postgres.$productionRef") { throw "Not approved production pooler" }
if ($uri.Query -notmatch '(^|[?&])sslmode=require(&|$)') { throw "TLS requirement missing" }
$envMap = @{ PGHOST=$uri.Host; PGPORT=$uri.Port; PGUSER=$user; PGPASSWORD=[Uri]::UnescapeDataString($userinfo[1]); PGDATABASE=$uri.AbsolutePath.TrimStart('/'); PGSSLMODE='require' }
$dockerArgs = @('run','--rm','-i'); foreach($n in $envMap.Keys){ [Environment]::SetEnvironmentVariable($n,$envMap[$n]); $dockerArgs += @('-e',$n) }; $dockerArgs += @('postgres:17-alpine','psql','-X','-q','-v','ON_ERROR_STOP=1','-At','-F','|')
function Q([string]$sql){ $out=$sql | & docker @dockerArgs -c $sql; if($LASTEXITCODE -ne 0){throw 'postflight SQL failed'}; return ($out|Out-String).Trim() }
try {
  $ledger=Q "SELECT concat_ws('|',count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL),count(*) FILTER (WHERE migration_name LIKE '20260810_00000%_p2a_%')) FROM public._prisma_migrations;"
  if($ledger -ne '8|0|5'){throw "Unexpected ledger: $ledger"}
  $tables=Q "SELECT count(*) FROM (VALUES ('ReviewerProfile'),('ReviewerCredential'),('ReviewerCredentialScope'),('ReviewerCredentialStatusEvent'),('ReviewerRestriction'),('CurriculumReviewTask'),('CurriculumReviewAssignment'),('CurriculumReviewAssessment'),('CurriculumReviewDecision'),('ReviewCalibrationSession'),('ReviewCalibrationResult')) v(name) WHERE to_regclass('public.'||chr(34)||name||chr(34)) IS NOT NULL;"
  if($tables -ne '11'){throw "P2-B table count mismatch: $tables"}
  $grants=Q "SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('ReviewerProfile','ReviewerCredential','ReviewerCredentialScope','ReviewerCredentialStatusEvent','ReviewerRestriction','CurriculumReviewTask','CurriculumReviewAssignment','CurriculumReviewAssessment','CurriculumReviewDecision','ReviewCalibrationSession','ReviewCalibrationResult') AND grantee IN ('anon','authenticated');"
  if($grants -ne '0'){throw "Unexpected direct client grants: $grants"}
  $guards=Q "SELECT concat_ws('|',(SELECT count(*) FROM pg_trigger WHERE tgname IN ('ReviewerCredentialStatusEvent_immutable','ReviewCalibrationResult_immutable','CurriculumReviewAssessment_submitted_immutable','CurriculumReviewDecision_final_immutable','ReviewerCredential_verified_core_immutable','ReviewerCredentialScope_verified_immutable','ReviewerCredential_verify_guard','CurriculumReviewDecision_integrity_guard')),(SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='CurriculumReviewAssignment_active_slot_key'),(SELECT count(*) FROM pg_constraint WHERE conname IN ('ReviewerCredentialScope_grade_range_check','ReviewerCredential_verified_fields_check','CurriculumReviewAssessment_submitted_fields_check','CurriculumReviewTask_revisionId_provenanceId_fkey')));"
  if($guards -ne '8|1|4'){throw "DB guard verification mismatch: $guards"}
  $activity=Q "SELECT concat_ws('|',count(*) FILTER (WHERE backend_xid IS NOT NULL AND xact_start < clock_timestamp()-interval '5 minutes'),count(*) FILTER (WHERE wait_event_type='Lock'),(SELECT count(*) FROM pg_locks WHERE NOT granted)) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid();"
  if($activity -ne '0|0|0'){throw "Unexpected DB activity: $activity"}
  Write-Output "Production project: $productionRef"; Write-Output "Migration ledger: $ledger"; Write-Output "P2-B tables: $tables"; Write-Output "P2-B direct client grants: $grants"; Write-Output "DB guards (triggers|active-slot-index|constraints): $guards"; Write-Output "Long transactions|lock waits|ungranted locks: $activity"; Write-Output 'P2-B PRODUCTION POSTFLIGHT: PASS'
} finally { foreach($n in $envMap.Keys){[Environment]::SetEnvironmentVariable($n,$null)} }
