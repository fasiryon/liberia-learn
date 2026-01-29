# -----------------------------
# Governance Loop Script (AUTHORITATIVE)
# Handles Agent-1 → Agent-5 → Repair/Reject workflow
# -----------------------------

param(
    [Parameter(Mandatory)]
    [string]$EwoId,

    [Parameter(Mandatory)]
    [string]$Agent1OutputPath,

    [Parameter(Mandatory)]
    [string]$SchemaPath,

    [Parameter(Mandatory)]
    [string]$Agent5PromptPath,

    [string]$OpenAIModel = "gpt-4",

    [int]$Agent5MaxOutputTokens = 800,

    # NEW: if true, ingest ACCEPTed artifacts into DB
    [switch]$IngestOnAccept
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "🛡️ Governance loop started for $EwoId" -ForegroundColor Cyan

# --- STEP 1: SCHEMA VALIDATION ---
. "$PSScriptRoot\schema-validation.ps1"

$schemaResult = Test-CurriculumSchema `
    -JsonPath $Agent1OutputPath `
    -SchemaPath $SchemaPath `
    -FailOnError

if (-not $schemaResult) {
    throw "Schema validation failed for $EwoId"
}

# --- STEP 2: RUN AGENT-5 (GOVERNANCE) ---
$resultsDir         = Join-Path "." "FactoryArtifacts\Results"
$agent5ResponsePath = Join-Path $resultsDir "$EwoId-Agent-5.json"
$decisionLogPath    = Join-Path $resultsDir "$EwoId-GovernanceDecision.json"

if (-not (Test-Path $resultsDir)) { New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null }

& "$PSScriptRoot\run-agent.ps1" `
    -PromptPath $Agent5PromptPath `
    -InputJsonPath $Agent1OutputPath `
    -OutputPath $agent5ResponsePath `
    -Model $OpenAIModel `
    -MaxOutputTokens $Agent5MaxOutputTokens `
    -Temperature 0

if (-not (Test-Path $agent5ResponsePath)) {
    throw "Agent-5 execution failed - no output file created"
}

$governanceRaw = Get-Content $agent5ResponsePath -Raw

try {
    $governance = $governanceRaw | ConvertFrom-Json
}
catch {
    @{
        ewo_id = $EwoId
        decision = "INVALID_JSON"
        reason = "Agent-5 output was not valid JSON"
        agent5_output_path = $agent5ResponsePath
        timestamp = (Get-Date).ToString("o")
    } | ConvertTo-Json -Depth 10 | Set-Content $decisionLogPath

    throw "Agent-5 returned invalid JSON for $EwoId. See $agent5ResponsePath"
}

# ALWAYS write the decision log (dashboard/CI depends on it)
@{
    ewo_id = $EwoId
    decision = $governance.decision
    reason = $governance.reason
    has_patch = [bool]$governance.patch
    agent5_output_path = $agent5ResponsePath
    timestamp = (Get-Date).ToString("o")
} | ConvertTo-Json -Depth 10 | Set-Content $decisionLogPath

switch ($governance.decision) {
    "ACCEPT" {
        Write-Host "✅ Governance ACCEPTED curriculum for $EwoId" -ForegroundColor Green

        if ($IngestOnAccept) {
            Write-Host "💾 Ingesting ACCEPTED artifact into DB..." -ForegroundColor Cyan
            node "$PSScriptRoot\ingest-governed-artifact.mjs" $EwoId $Agent1OutputPath $decisionLogPath
        }

        return
    }

    "REPAIR" {
        Write-Host "🛠️ Governance requested REPAIR for $EwoId" -ForegroundColor Yellow

        if (-not $governance.patch) {
            throw "REPAIR decision issued but no JSON Patch provided."
        }

        & "$PSScriptRoot\apply-json-patch.ps1" `
            -TargetJsonPath $Agent1OutputPath `
            -Patch $governance.patch

        Write-Host "🔁 Re-running governance after repair..." -ForegroundColor Cyan
        & "$PSScriptRoot\governance-loop.ps1" `
            -EwoId $EwoId `
            -Agent1OutputPath $Agent1OutputPath `
            -SchemaPath $SchemaPath `
            -Agent5PromptPath $Agent5PromptPath `
            -OpenAIModel $OpenAIModel `
            -Agent5MaxOutputTokens $Agent5MaxOutputTokens `
            -IngestOnAccept:$IngestOnAccept

        return
    }

    "REJECT" {
        Write-Host "❌ Governance REJECTED curriculum for $EwoId" -ForegroundColor Red
        if ($governance.reason) { Write-Host "Reason: $($governance.reason)" -ForegroundColor Red }
        throw "EWO $EwoId rejected by governance"
    }

    default {
        throw "Invalid governance decision: $($governance.decision)"
    }
}
