param(
  [Parameter(Mandatory)]
  [string]$EwoId,

  # Paths (adjust if your repo differs)
  [string]$SchemaPath = ".\docs\internal\schemas\unified-curriculum-schema.json",
  [string]$Agent1PromptPath = ".\docs\internal\agents\curriculum-architect-agent.md",
  [string]$Agent5PromptPath = ".\docs\internal\agents\qa-governance-agent.md",

  # Outputs
  [string]$OutDir = ".\FactoryArtifacts\Results",

  # Model strings are just metadata for logging / storage
  [string]$GovernanceModel = "gpt-4",

  # Apply patch from governance if REPAIR
  [switch]$ApplyPatch
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $SchemaPath)) { throw "Schema file not found: $SchemaPath" }
if (!(Test-Path $Agent1PromptPath)) { throw "Agent-1 prompt not found: $Agent1PromptPath" }
if (!(Test-Path $Agent5PromptPath)) { throw "Agent-5 prompt not found: $Agent5PromptPath" }

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$agent1Out = Join-Path $OutDir "$EwoId-Agent-1.json"
$agent5Out = Join-Path $OutDir "$EwoId-Agent-5.json"
$govOut    = Join-Path $OutDir "$EwoId-Governance.json"

Write-Host "🏭 LiberiaLearn Factory Pipeline"
Write-Host "================================"
Write-Host "EWO: $EwoId"
Write-Host "Out: $OutDir"
Write-Host ""

# -----------------------------
# STEP 1: Agent-1 generation
# -----------------------------
# NOTE: Replace this block with however you currently call OpenAI/Claude.
# For now, it assumes you already generate Agent-1 output elsewhere.
if (!(Test-Path $agent1Out)) {
  throw "Agent-1 output missing: $agent1Out`nGenerate it first OR wire your LLM call here."
}

# -----------------------------
# STEP 2: Schema validation
# -----------------------------
& .\scripts\schema-validation.ps1 -JsonPath $agent1Out -SchemaPath $SchemaPath

# -----------------------------
# STEP 3: Agent-5 governance
# -----------------------------
# NOTE: Replace this block with your governance LLM call.
# For now, it assumes you already generated a governance decision file.
if (!(Test-Path $govOut)) {
  throw "Governance output missing: $govOut`nGenerate it first OR wire your LLM call here."
}

# -----------------------------
# STEP 4: Ingest
# -----------------------------
# SchemaId should match metadata.id in the curriculum artifact (or you can pass a placeholder)
$schemaId = (Get-Content $agent1Out -Raw | ConvertFrom-Json).metadata.id

& .\scripts\ingest-governed-artifact.ps1 `
  -EwoId $EwoId `
  -SchemaId $schemaId `
  -Agent1Path $agent1Out `
  -Agent5Path $agent5Out `
  -GovernancePath $govOut `
  -GovernanceModel $GovernanceModel `
  $(if ($ApplyPatch.IsPresent) { "-ApplyPatch" } else { "" })

Write-Host ""
Write-Host "✅ Pipeline complete"
