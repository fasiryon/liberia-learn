param(
  [Parameter(Mandatory=$true)]
  [string]$EwoId,

  [Parameter(Mandatory=$false)]
  [int]$Grade = 5,

  [Parameter(Mandatory=$false)]
  [ValidateSet("MATH","ENGLISH","SCIENCE","ICT","COMPUTER_SCIENCE","HISTORY","CIVICS","GEOGRAPHY","ECONOMICS","BUSINESS_STUDIES","ARTS","CREATIVITY","PE","LITERACY","PHYSICS","CHEMISTRY","BIOLOGY")]
  [string]$Subject = "MATH",

  [Parameter(Mandatory=$false)]
  [string]$Model = "gpt-4"
)

$ErrorActionPreference = "Stop"

$resultsDir = ".\FactoryArtifacts\Results"
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

$agent1Out = Join-Path $resultsDir "$EwoId-Agent-1.json"
$agent5Out = Join-Path $resultsDir "$EwoId-Agent-5.json"

# --- Choose Agent-1 prompt file
$agent1Prompt = ".\docs\internal\agents\agent-1-fullsubject-grade5-math.md"
if ($Subject -ne "MATH") {
  # If you later create more prompts, drop them in docs/internal/agents and map here.
  $agent1Prompt = ".\docs\internal\agents\agent-1-fullsubject-grade5-math.md"
}

if (!(Test-Path $agent1Prompt)) { throw "Agent-1 prompt missing: $agent1Prompt" }

# --- Load schema validator
. ".\scripts\schema-validation.ps1"

Write-Host "🚀 Running EWO: $EwoId (Grade $Grade $Subject) model=$Model" -ForegroundColor Cyan

# --- Agent runner (uses your existing governance-loop agent runner script if present)
# We expect governance-loop.ps1 exists because your test-governance-loop.ps1 calls it.
$agentRunner = ".\scripts\run-agent.ps1"
if (!(Test-Path $agentRunner)) {
  # Fallback: use governance-loop.ps1's internal agent execution by calling governance-loop directly with Agent1 already created.
  # But we still need Agent-1 output. If you don't have run-agent.ps1, create a minimal one now.
  $agentRunner = ".\scripts\_internal_run_agent_fallback.ps1"
  @"
param(
  [Parameter(Mandatory=`$true)][string]`$PromptPath,
  [Parameter(Mandatory=`$true)][string]`$InputPath,
  [Parameter(Mandatory=`$true)][string]`$OutputPath,
  [Parameter(Mandatory=`$false)][string]`$Model = "gpt-4",
  [Parameter(Mandatory=`$false)][int]`$MaxTokens = 2500
)

# This expects you already have a Node or PS tool in your repo that calls OpenAI.
# If you already have one, replace this fallback with your real runner.
throw "No run-agent.ps1 found. Create your real agent runner at .\scripts\run-agent.ps1 OR tell me what file currently calls OpenAI (you already have one inside governance-loop)."
"@ | Set-Content -Encoding UTF8 $agentRunner
  throw "Missing .\scripts\run-agent.ps1. You already have an OpenAI caller (governance-loop uses it). Tell me the filename that does the OpenAI call, and I’ll wire Agent-1 to it in one paste."
}

# --- Create Agent-1 input (just a tiny JSON envelope for the prompt)
$agent1Input = @{
  grade = $Grade
  subject = $Subject
  term = 1
  week = 1
  request = "Generate FULL_SUBJECT curriculum using nested_content (UNIT->LESSON) per schema."
} | ConvertTo-Json -Depth 10

$tmpIn = Join-Path $env:TEMP "$EwoId-agent1-input.json"
$agent1Input | Set-Content -Encoding UTF8 $tmpIn

Write-Host "🤖 Generating Agent-1 FULL_SUBJECT..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File $agentRunner `
  -PromptPath $agent1Prompt `
  -InputJsonPath $tmpIn `
  -OutputPath $agent1Out `
  -Model $Model `
  -MaxOutputTokens 6000

if (!(Test-Path $agent1Out)) { throw "Agent-1 output not created: $agent1Out" }
Write-Host "✅ Agent-1 output: $agent1Out" -ForegroundColor Green

Write-Host "🔍 Validating Agent-1 output against schema..." -ForegroundColor Yellow
Test-CurriculumSchema -JsonPath $agent1Out | Out-Null

# --- Run governance loop (Agent-5)
$govLoop = ".\scripts\governance-loop.ps1"
if (!(Test-Path $govLoop)) { throw "Missing governance loop script: $govLoop" }

$schemaPath = ".\docs\internal\schemas\unified-curriculum-schema.json"
$agent5Prompt = ".\docs\internal\agents\qa-governance-agent.md"

Write-Host "🛡️ Running governance loop..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File $govLoop `
  -EwoId $EwoId `
  -Agent1OutputPath $agent1Out `
  -SchemaPath $schemaPath `
  -Agent5PromptPath $agent5Prompt `
  -OpenAIModel $Model

if (!(Test-Path $agent5Out)) { throw "Agent-5 output not created: $agent5Out" }
Write-Host "✅ Agent-5 output: $agent5Out" -ForegroundColor Green

# --- Ingest if ACCEPT
$decision = (Get-Content $agent5Out -Raw | ConvertFrom-Json).decision
Write-Host "📌 Governance decision: $decision" -ForegroundColor Cyan

if ($decision -eq "ACCEPT") {
  $ingest = ".\scripts\ingest-wrapper.ps1"
  if (Test-Path $ingest) {
    Write-Host "📥 Ingesting ACCEPT artifact..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File $ingest -EwoId $EwoId -Agent1OutputPath $agent1Out -GovernanceDecisionPath (Join-Path $resultsDir "$EwoId-GovernanceDecision.json")
    Write-Host "✅ Ingest complete." -ForegroundColor Green
  } else {
    Write-Host "⚠️ ingest-wrapper.ps1 not found. Skipping DB ingest." -ForegroundColor Yellow
    Write-Host "   If you want, paste the file path that currently does ingest (your logs show ingest exists), and I’ll wire it." -ForegroundColor Gray
  }
} else {
  Write-Host "⚠️ Not ingesting because decision != ACCEPT" -ForegroundColor Yellow
}

Write-Host "🎉 EWO complete: $EwoId" -ForegroundColor Green


