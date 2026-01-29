# -----------------------------
# LiberiaLearn Factory Parallel Test Pipeline - CI/CD Ready
# Governance decision + EWO fail on REJECT + optional DB ingest on ACCEPT
# -----------------------------

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -----------------------------
# Config
# -----------------------------
$NumEWOs = 5
$AgentsPerEWO = 5

# CI/CD artifact folder
$ArtifactFolder = ".\FactoryArtifacts"
$ResultsFolder = Join-Path $ArtifactFolder "Results"
$DashboardFile = Join-Path $ResultsFolder "FactoryDashboard.html"
$JSONFile = Join-Path $ResultsFolder "FactoryResults.json"
$FailedJSONFile = Join-Path $ResultsFolder "FailedEWOs.json"
$DashboardRefreshSeconds = 5

# Ingest behavior:
# - If $EnableDbIngest = $true, pipeline will attempt to ingest ACCEPTED curriculum into DB.
# - If ingest script is missing:
#     - If $RequireDbIngestScript = $true => FAIL the EWO (recommended once your ingester exists)
#     - If $RequireDbIngestScript = $false => mark ingest as SKIPPED but still keep EWO SUCCESS
$EnableDbIngest = $true
$RequireDbIngestScript = $false

# IMPORTANT:
# Your ingest wrapper (ingest-governed-artifact.ps1) currently prints errors but may still exit 0.
# This makes $LASTEXITCODE look "Success" even when ingest actually failed.
# This setting makes the pipeline treat known failure strings in the ingest log as FAILED.
$TreatIngestFailureTextAsFailure = $true

# Ingest script candidates (first found wins)
# ✅ Updated for your governed-artifact ingester
$IngestScriptCandidates = @(
    ".\scripts\ingest-governed-artifact.ps1",
    ".\scripts\ingest-governed-artifact.ts",
    ".\scripts\ingest-curriculum.ps1",
    ".\scripts\ingest-to-db.ps1",
    ".\scripts\ingest-curriculum.js",
    ".\scripts\ingest-to-db.js"
)

# Create folders if missing
if (-not (Test-Path $ResultsFolder)) { New-Item -ItemType Directory -Path $ResultsFolder -Force | Out-Null }

Write-Host "Starting LiberiaLearn Factory Parallel Test Pipeline..." -ForegroundColor Cyan

# -----------------------------
# Helpers
# -----------------------------
function ConvertTo-HtmlSafe {
    param([Parameter(Mandatory)][string]$Text)
    return ($Text -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;')
}

function Get-OutputDisplayText {
    param(
        [Parameter(Mandatory)]
        $ResultObject
    )

    $out = [string]$ResultObject.Output

    # Special: Governance row => show decision nicely from decision log
    if ($ResultObject.Agent -eq "Governance") {
        try {
            if ($out -and (Test-Path $out)) {
                $j = Get-Content $out -Raw | ConvertFrom-Json
                $decision = [string]($j.decision ?? "UNKNOWN")
                $reason   = [string]($j.reason ?? "")
                $ts       = [string]($j.timestamp ?? "")
                $pretty = "Decision: $decision`nReason: $reason`nTimestamp: $ts`nFile: $out"
                return (ConvertTo-HtmlSafe -Text $pretty)
            }
        } catch {
            return (ConvertTo-HtmlSafe -Text ("Governance log read/parse failed: $($_.Exception.Message)`n$out"))
        }
    }

    # Special: Ingest row => show contents if file path
    if ($ResultObject.Agent -eq "Ingest") {
        if ($out -and (Test-Path $out)) {
            try {
                $raw = Get-Content $out -Raw
                return (ConvertTo-HtmlSafe -Text $raw)
            } catch {
                return (ConvertTo-HtmlSafe -Text ("Could not read ingest log: $out :: $($_.Exception.Message)"))
            }
        }
        return (ConvertTo-HtmlSafe -Text ($out ?? ""))
    }

    # Default: if Output is a file path, show file contents
    if ($out -and (Test-Path $out)) {
        try {
            $raw = Get-Content $out -Raw
            return (ConvertTo-HtmlSafe -Text $raw)
        } catch {
            return (ConvertTo-HtmlSafe -Text ("Could not read file: $out :: $($_.Exception.Message)"))
        }
    }

    return (ConvertTo-HtmlSafe -Text ($out ?? ""))
}

function Get-GovernanceDecisionSummary {
    param(
        [Parameter(Mandatory)][string]$EwoId,
        [Parameter(Mandatory)][string]$ResultsFolder
    )

    $path = Join-Path $ResultsFolder "$EwoId-GovernanceDecision.json"

    if (-not (Test-Path $path)) {
        return [PSCustomObject]@{
            Decision = "NO_DECISION"
            Reason   = ""
            Path     = $path
        }
    }

    try {
        $j = Get-Content $path -Raw | ConvertFrom-Json
        return [PSCustomObject]@{
            Decision = [string]($j.decision ?? "UNKNOWN")
            Reason   = [string]($j.reason ?? "")
            Path     = $path
        }
    }
    catch {
        return [PSCustomObject]@{
            Decision = "INVALID_DECISION_LOG"
            Reason   = $_.Exception.Message
            Path     = $path
        }
    }
}

function Find-IngestScript {
    foreach ($p in $IngestScriptCandidates) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Test-IngestLogForFailure {
    param(
        [Parameter(Mandatory)][string]$IngestLogPath
    )

    if (-not (Test-Path $IngestLogPath)) { return $false }

    try {
        $raw = Get-Content $IngestLogPath -Raw

        # Add/remove patterns as you like
        $patterns = @(
            "❌\s*Ingest failed",
            "Ingest failed",
            "Can't reach database server",
            "ECONNREFUSED",
            "ETIMEDOUT",
            "ENOTFOUND",
            "PrismaClientInitializationError"
        )

        foreach ($p in $patterns) {
            if ($raw -match $p) { return $true }
        }
        return $false
    }
    catch {
        # If we can't read log, don't auto-fail
        return $false
    }
}

function Invoke-DbIngest {
    param(
        [Parameter(Mandatory)][string]$EwoId,
        [Parameter(Mandatory)][string]$Agent1JsonPath,
        [Parameter(Mandatory)][string]$GovernanceJsonPath,
        [Parameter(Mandatory)][string]$ResultsFolder
    )

    $ingestLogPath = Join-Path $ResultsFolder "$EwoId-Ingest.log"
    $script = Find-IngestScript

    if (-not $script) {
        $msg = "INGEST_SKIPPED: No ingest script found. Looked for: $($IngestScriptCandidates -join ', ')"
        $msg | Set-Content -Path $ingestLogPath
        return [PSCustomObject]@{
            Status = if ($RequireDbIngestScript) { "Failed" } else { "Success" }
            Output = $ingestLogPath
            Reason = $msg
        }
    }

    try {
        $lower = $script.ToLower()

        if ($lower.EndsWith(".ps1")) {
            # ✅ IMPORTANT: matches your wrapper param block:
            # param([string]$EwoId,[string]$Agent1Path,[string]$GovernancePath)
            & pwsh -ExecutionPolicy Bypass -File $script `
                -EwoId $EwoId `
                -Agent1Path $Agent1JsonPath `
                -GovernancePath $GovernanceJsonPath *>&1 |
                    Out-File -FilePath $ingestLogPath -Encoding utf8
        }
        elseif ($lower.EndsWith(".ts")) {
            # ✅ Run TS directly (matches your TS arg parsing)
            & npx ts-node $script `
                --ewo $EwoId `
                --agent1 $Agent1JsonPath `
                --governance $GovernanceJsonPath *>&1 |
                    Out-File -FilePath $ingestLogPath -Encoding utf8
        }
        else {
            # Node ingester fallback: expects --ewo --agent1 --governance
            & node $script `
                --ewo $EwoId `
                --agent1 $Agent1JsonPath `
                --governance $GovernanceJsonPath *>&1 |
                    Out-File -FilePath $ingestLogPath -Encoding utf8
        }

        # ---------------------------------------------
        # ✅ THIS is the $LASTEXITCODE check block
        # ---------------------------------------------
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            throw "Ingest script exited non-zero (LASTEXITCODE=$exitCode). See $ingestLogPath"
        }

        # Optional safety net: treat known failure text as failure (useful if wrapper exits 0 on error)
        if ($TreatIngestFailureTextAsFailure -and (Test-IngestLogForFailure -IngestLogPath $ingestLogPath)) {
            throw "Ingest log indicates failure (wrapper may have exited 0). See $ingestLogPath"
        }

        return [PSCustomObject]@{
            Status = "Success"
            Output = $ingestLogPath
            Reason = ""
        }
    }
    catch {
        $err = $_.Exception.Message
        "INGEST_FAILED: $err" | Add-Content -Path $ingestLogPath
        return [PSCustomObject]@{
            Status = "Failed"
            Output = $ingestLogPath
            Reason = $err
        }
    }
}

# -----------------------------
# Generate EWOs
# -----------------------------
$EWOs = 1..$NumEWOs | ForEach-Object {
    [PSCustomObject]@{
        Id     = "EWO-{0:D5}" -f $_
        Agents = 1..$AgentsPerEWO | ForEach-Object { "Agent-$_" }
    }
}

$AllResults = @()
$FailedEWOs = @()

# Track EWO-level status (governance REJECT fails the whole EWO)
$EwoStatus = @{}   # EWO ID -> "Success" | "Failed"
$EwoReason = @{}   # EWO ID -> failure reason string

# -----------------------------
# Process EWOs with live streaming
# -----------------------------
foreach ($ewo in $EWOs) {
    Write-Host "`nProcessing $($ewo.Id) ..." -ForegroundColor Yellow

    # default each EWO to success until proven otherwise
    $EwoStatus[$ewo.Id] = "Success"
    $EwoReason[$ewo.Id] = ""

    $jobs = @()

    foreach ($agent in $ewo.Agents) {
        $jobs += Start-Job -ScriptBlock {
            param($agent, $ewoId, $resultsFolder)

            try {
                Start-Sleep -Milliseconds (Get-Random -Minimum 200 -Maximum 800)

                $outputPath = Join-Path $resultsFolder "$ewoId-$agent.json"

                if ($agent -eq "Agent-1") {
                    $status = "Success"
                }
                elseif ((Get-Random) -lt 0.25) {
                    $status = "Failed"
                    $output = "$agent failed during processing."
                }
                else {
                    $status = "Success"
                }

                if ($status -eq "Success") {
                    if ($agent -eq "Agent-1") {
                        # -----------------------------------------
                        # Agent-1 MUST emit schema-valid curriculum
                        # -----------------------------------------
                        $ewoNum   = ($ewoId -replace '[^0-9]', '')
                        $schemaId = "LESSON-$ewoNum" # matches ^(LESSON|UNIT|TERM|SUBJECT)-[A-Z0-9]+$
                        $now      = (Get-Date).ToString("o")

                        @{
                            schema_version = "1.0"
                            metadata = @{
                                id         = $schemaId
                                created_at = $now
                                updated_at = $now
                                version    = "1.0.0"
                                status     = "draft"
                                source     = "AI_FACTORY"
                            }
                            educational_context = @{
                                country        = "Liberia"
                                grade          = 10
                                subject        = "MATH"
                                cognitive_band = "CORE"
                                language       = "en-LR"
                            }
                            title        = "Grade 10 Math - Single Lesson (Placeholder)"
                            content_type = "LESSON"
                            scale        = "SINGLE_LESSON"
                            units        = @()
                        } | ConvertTo-Json -Depth 40 | Set-Content $outputPath
                    }
                    else {
                        # Non-Agent-1 artifacts: lightweight placeholders
                        @{
                            metadata = @{
                                id         = "$ewoId-$agent"
                                created_at = (Get-Date).ToString("o")
                                source     = "AI_FACTORY"
                            }
                            agent  = $agent
                            ewo    = $ewoId
                            status = "Success"
                            note   = "Placeholder agent output (non-curriculum artifact)."
                        } | ConvertTo-Json -Depth 10 | Set-Content $outputPath
                    }

                    $output = $outputPath
                }
                else {
                    $output = "$agent failed during processing."
                }

                [PSCustomObject]@{
                    EWO    = $ewoId
                    Agent  = $agent
                    Status = $status
                    Output = $output
                }
            }
            catch {
                [PSCustomObject]@{
                    EWO    = $ewoId
                    Agent  = $agent
                    Status = "Failed"
                    Output = $_.Exception.Message
                }
            }
        } -ArgumentList $agent, $ewo.Id, $ResultsFolder
    }

    # -----------------------------
    # Live stream results while jobs run
    # -----------------------------
    while (@($jobs).Count -gt 0) {
        $finished = Wait-Job -Job $jobs -Any -Timeout 1
        if ($finished) {
            $jobsToProcess = @()
            foreach ($job in $jobs) {
                if ($job.State -ne 'Running' -and $job.State -ne 'NotStarted') {
                    $jobsToProcess += $job
                }
            }

            foreach ($job in $jobsToProcess) {
                $results = Receive-Job -Job $job -ErrorAction SilentlyContinue
                Remove-Job -Job $job -Force -ErrorAction SilentlyContinue

                if ($results) {
                    if ($results -is [Array]) {
                        foreach ($result in $results) {
                            if ($result) {
                                $AllResults += $result
                                $color = if ($result.Status -eq "Success") { "Green" } else { "Red" }
                                Write-Host "[$($result.EWO)] $($result.Agent): $($result.Status)" -ForegroundColor $color
                            }
                        }
                    }
                    else {
                        $AllResults += $results
                        $color = if ($results.Status -eq "Success") { "Green" } else { "Red" }
                        Write-Host "[$($results.EWO)] $($results.Agent): $($results.Status)" -ForegroundColor $color
                    }
                }
            }

            $jobs = @($jobs | Where-Object { $_.State -eq 'Running' -or $_.State -eq 'NotStarted' })
        }
    }

    # -----------------------------
    # Governance Workflow: Agent-1 → Agent-5
    # Dashboard includes decision + FAIL EWOs on non-ACCEPT
    # -----------------------------
    $agent1Result = $AllResults |
        Where-Object { $_.EWO -eq $ewo.Id -and $_.Agent -eq "Agent-1" -and $_.Status -eq "Success" } |
        Select-Object -First 1

    $schemaPath       = ".\docs\internal\schemas\unified-curriculum-schema.json"
    $agent5PromptPath = ".\docs\internal\agents\qa-governance-agent.md"

    if ($agent1Result -and (Test-Path $agent1Result.Output)) {
        try {
            Write-Host "[$($ewo.Id)] Running governance workflow..." -ForegroundColor Cyan

            & ".\scripts\governance-loop.ps1" `
                -EwoId $ewo.Id `
                -Agent1OutputPath $agent1Result.Output `
                -SchemaPath $schemaPath `
                -Agent5PromptPath $agent5PromptPath `
                -OpenAIModel "gpt-4"

            # Read decision from the AUTHORITATIVE decision log written by governance-loop.ps1
            $gov = Get-GovernanceDecisionSummary -EwoId $ewo.Id -ResultsFolder $ResultsFolder

            # Add governance row (shows decision log content)
            $AllResults += [PSCustomObject]@{
                EWO    = $ewo.Id
                Agent  = "Governance"
                Status = if ($gov.Decision -eq "ACCEPT") { "Success" } else { "Failed" }
                Output = $gov.Path
            }

            # If governance is not ACCEPT, fail the EWO
            if ($gov.Decision -ne "ACCEPT") {
                $EwoStatus[$ewo.Id] = "Failed"
                $EwoReason[$ewo.Id] = "Governance decision was $($gov.Decision). $($gov.Reason)"

                $agent1Result.Status = "Failed"
                $agent1Result.Output = $EwoReason[$ewo.Id]

                throw $EwoReason[$ewo.Id]
            }

            Write-Host "[$($ewo.Id)] Governance workflow completed successfully" -ForegroundColor Green

            # -----------------------------
            # OPTIONAL: DB ingest on ACCEPT
            # ✅ Now passes BOTH Agent-1 + Governance decision log
            # -----------------------------
            if ($EnableDbIngest) {
                $govLogPath = $gov.Path

                $ing = Invoke-DbIngest `
                    -EwoId $ewo.Id `
                    -Agent1JsonPath $agent1Result.Output `
                    -GovernanceJsonPath $govLogPath `
                    -ResultsFolder $ResultsFolder

                $AllResults += [PSCustomObject]@{
                    EWO    = $ewo.Id
                    Agent  = "Ingest"
                    Status = $ing.Status
                    Output = $ing.Output
                }

                if ($ing.Status -eq "Failed") {
                    $EwoStatus[$ewo.Id] = "Failed"
                    $EwoReason[$ewo.Id] = "DB ingest failed: $($ing.Reason)"
                    $agent1Result.Status = "Failed"
                    $agent1Result.Output = $EwoReason[$ewo.Id]
                    throw $EwoReason[$ewo.Id]
                }
            }
        }
        catch {
            $msg = $_.Exception.Message

            $EwoStatus[$ewo.Id] = "Failed"
            $EwoReason[$ewo.Id] = "Governance/ingest rejection/error: $msg"

            # Ensure governance row exists even on exception
            if (-not ($AllResults | Where-Object { $_.EWO -eq $ewo.Id -and $_.Agent -eq "Governance" } | Select-Object -First 1)) {
                $AllResults += [PSCustomObject]@{
                    EWO    = $ewo.Id
                    Agent  = "Governance"
                    Status = "Failed"
                    Output = $EwoReason[$ewo.Id]
                }
            }

            # Mark Agent-1 failed so downstream logic catches it too
            if ($agent1Result) {
                $agent1Result.Status = "Failed"
                $agent1Result.Output = $EwoReason[$ewo.Id]
            }

            Write-Host "[$($ewo.Id)] Governance/ingest workflow failed: $msg" -ForegroundColor Red
        }
    }
    else {
        $EwoStatus[$ewo.Id] = "Failed"
        $EwoReason[$ewo.Id] = "Agent-1 output missing or not found."

        $AllResults += [PSCustomObject]@{
            EWO    = $ewo.Id
            Agent  = "Governance"
            Status = "Failed"
            Output = $EwoReason[$ewo.Id]
        }

        Write-Host "[$($ewo.Id)] Governance workflow failed: $($EwoReason[$ewo.Id])" -ForegroundColor Red
    }

    # If any agent OR governance OR ingest failed => fail the EWO
    $anyFailures = $AllResults | Where-Object { $_.EWO -eq $ewo.Id -and $_.Status -eq "Failed" }
    if ($anyFailures -or $EwoStatus[$ewo.Id] -eq "Failed") {
        if ($EwoStatus[$ewo.Id] -ne "Failed") {
            $EwoStatus[$ewo.Id] = "Failed"
            $EwoReason[$ewo.Id] = "One or more agents failed."
        }
        $FailedEWOs += $ewo.Id
    }
}

# -----------------------------
# Schema validation (Agent-1 ONLY)
# -----------------------------
$schemaPath = ".\docs\internal\schemas\unified-curriculum-schema.json"

if (Test-Path $schemaPath) {
    Write-Host "`nValidating schema for successful Agent-1 outputs..." -ForegroundColor Cyan

    . ".\scripts\schema-validation.ps1"

    foreach ($res in $AllResults | Where-Object { $_.Status -eq "Success" -and $_.Agent -eq "Agent-1" }) {
        if (Test-Path $res.Output) {
            $isValid = Test-CurriculumSchema -JsonPath $res.Output -SchemaPath $schemaPath
            if (-not $isValid) {
                $res.Status = "Failed"
                $res.Output = "Schema validation failed. See logs."
                Write-Host "[$($res.EWO)] $($res.Agent): Marked as Failed due to schema validation" -ForegroundColor Red
            }
        }
    }

    # Recompute failed EWOs (includes governance + ingest rows too)
    $FailedEWOs = @()
    foreach ($ewo in $EWOs) {
        if ($AllResults | Where-Object { $_.EWO -eq $ewo.Id -and $_.Status -eq "Failed" }) {
            $FailedEWOs += $ewo.Id
        }
    }
}
else {
    Write-Host "`n⚠️  Schema file not found at $schemaPath - skipping validation" -ForegroundColor Yellow
}

# -----------------------------
# Save JSON artifacts
# -----------------------------
$AllResults | ConvertTo-Json -Depth 10 | Set-Content $JSONFile
$FailedEWOs | ConvertTo-Json | Set-Content $FailedJSONFile

# -----------------------------
# Generate HTML Dashboard (shows real file content)
# -----------------------------
$TotalEWOs = $EWOs.Count
$FailedCount = $FailedEWOs.Count
$SuccessCount = $TotalEWOs - $FailedCount

$HTML = @"
<!DOCTYPE html>
<html lang='en'>
<head>
<meta charset='UTF-8'>
<title>LiberiaLearn Factory Dashboard</title>
<meta http-equiv='refresh' content='$DashboardRefreshSeconds'>
<style>
body { font-family: Arial, sans-serif; background:#f0f0f0; padding: 20px; }
h1 { color:#2c3e50; }
h2 { color:#34495e; }
table { border-collapse: collapse; width: 100%; margin-bottom:20px; }
th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
th { background-color:#34495e; color:white; }
.success { background-color:#27ae60; color:white; }
.failed { background-color:#c0392b; color:white; }
.collapsible { cursor: pointer; padding: 5px; border: none; text-align: left; outline: none; font-size: 14px; }
.content { padding: 10px; display: none; overflow: auto; background-color: #ecf0f1; max-height: 320px; }
.summary { margin-bottom: 20px; font-weight: bold; }
pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
</style>
</head>
<body>
<h1>LiberiaLearn Factory CI/CD Dashboard</h1>
<div class='summary'>
Total EWOs: $TotalEWOs | Success: $SuccessCount | Failed: $FailedCount
</div>
"@

foreach ($ewo in $EWOs) {
    $HTML += "<h2>$($ewo.Id)</h2><table>"
    $HTML += "<tr><th>Agent</th><th>Status</th><th>Output</th></tr>"

    $ewoResults = $AllResults | Where-Object { $_.EWO -eq $ewo.Id }

    foreach ($res in $ewoResults) {
        $statusClass = if ($res.Status -eq "Failed") { "failed" } else { "success" }
        $display = Get-OutputDisplayText -ResultObject $res

        $HTML += "<tr class='$statusClass'><td>$($res.Agent)</td><td>$($res.Status)</td>"
        $HTML += "<td><button class='collapsible'>Show Output</button><div class='content'><pre>$display</pre></div></td></tr>`n"
    }

    $HTML += "</table>"
}

$HTML += @"
<script>
var coll = document.getElementsByClassName("collapsible");
for (var i = 0; i < coll.length; i++) {
  coll[i].addEventListener("click", function() {
    var content = this.nextElementSibling;
    content.style.display = (content.style.display === "block") ? "none" : "block";
  });
}
</script>
</body>
</html>
"@

$HTML | Set-Content $DashboardFile
Write-Host "`nHTML CI/CD dashboard generated: $DashboardFile" -ForegroundColor Green
Write-Host "Pipeline complete. All agent outputs processed." -ForegroundColor Cyan
