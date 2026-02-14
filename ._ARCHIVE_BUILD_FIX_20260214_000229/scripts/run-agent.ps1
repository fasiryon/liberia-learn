# -----------------------------
# Run Agent Script
# Executes an agent with a prompt file and input JSON
# -----------------------------

param(
    [Parameter(Mandatory)]
    [string]$PromptPath,

    [Parameter(Mandatory)]
    [string]$InputJsonPath,

    [Parameter(Mandatory)]
    [string]$OutputPath,

    [string]$Model = "gpt-4",

    # SAFE default. Governance outputs should be short.
    [int]$MaxOutputTokens = 800,

    # Keep prompts from ballooning
    [int]$MaxPromptChars = 12000,

    # Slightly conservative for governance/QA
    [double]$Temperature = 0.2
)

function New-DirectoryIfMissing {
    param([string]$Path)
    $dir = Split-Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory)] $Obj,
        [Parameter(Mandatory)] [string]$Path
    )
    New-DirectoryIfMissing -Path $Path
    $Obj | ConvertTo-Json -Depth 30 | Set-Content -Path $Path -Encoding UTF8
}

function Get-ApproxTokenCountFromChars {
    param([int]$Chars)
    # rough estimate ~4 chars per token
    return [Math]::Ceiling($Chars / 4.0)
}

if (-not (Test-Path $PromptPath)) { throw "Prompt file not found: $PromptPath" }
if (-not (Test-Path $InputJsonPath)) { throw "Input JSON file not found: $InputJsonPath" }

# Read prompt + raw JSON input (raw is cheaper than pretty re-encoding)
$prompt = Get-Content $PromptPath -Raw
$inputRaw = Get-Content $InputJsonPath -Raw

# Trim prompt if huge
if ($prompt.Length -gt $MaxPromptChars) {
    $prompt = $prompt.Substring(0, $MaxPromptChars) + "`n`n[TRUNCATED_PROMPT]"
}

# Build task prompt (NO triple-backtick json blocks; they waste tokens and invite markdown)
$fullPrompt = @"
$prompt

---
TASK:
You are processing this Education Work Order JSON. Return STRICT JSON only (no markdown, no commentary).

EWO_JSON:
$inputRaw
"@

Write-Host "🤖 Running agent with model: $Model" -ForegroundColor Cyan
Write-Host "   Prompt: $PromptPath" -ForegroundColor Gray
Write-Host "   Input:  $InputJsonPath" -ForegroundColor Gray
Write-Host "   Output: $OutputPath" -ForegroundColor Gray

$apiKey = $env:OPENAI_API_KEY
if (-not $apiKey) { throw "OPENAI_API_KEY environment variable is not set" }

# Context budgeting (gpt-4 here is treated as 8192 ctx)
$contextLimit = 8192
$approxPromptTokens = Get-ApproxTokenCountFromChars -Chars ($fullPrompt.Length + 500)
$maxAllowedOutput = $contextLimit - $approxPromptTokens - 200
if ($maxAllowedOutput -lt 128) { $maxAllowedOutput = 128 }

if ($MaxOutputTokens -gt $maxAllowedOutput) {
    $MaxOutputTokens = $maxAllowedOutput
}

$apiUrl = "https://api.openai.com/v1/chat/completions"
$headers = @{
    "Authorization" = "Bearer $apiKey"
    }

$bodyObj = @{
    model = $Model
    messages = @(
        @{
            role    = "system"
            content = "Return STRICT JSON only. No markdown. No code fences. No extra keys unless asked."
        },
        @{
            role    = "user"
            content = $fullPrompt
        }
    )
    max_tokens  = $MaxOutputTokens
    temperature = $Temperature
}

$body = $bodyObj | ConvertTo-Json -Depth 10

try {
    Write-Host "   Calling OpenAI API... (max_tokens=$MaxOutputTokens)" -ForegroundColor Gray

    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

$apiResponse = Invoke-RestMethod `
  -Uri $apiUrl `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json; charset=utf-8" `
  -Body $bodyBytes `
  -ErrorAction Stop

    $responseText = $apiResponse.choices[0].message.content
    if (-not $responseText) { throw "Empty response from OpenAI." }

    # Validate JSON; if invalid, save a structured REJECT object so the pipeline stays consistent
    try {
        $null = $responseText | ConvertFrom-Json -ErrorAction Stop

        New-DirectoryIfMissing -Path $OutputPath
        $responseText | Set-Content -Path $OutputPath -Encoding UTF8
        Write-Host "✅ Agent execution completed" -ForegroundColor Green
    } catch {
        $fallback = @{
            decision = "REJECT"
            reason   = "Model did not return valid JSON."
            patch    = @()
            raw      = $responseText
        }
        Write-JsonFile -Obj $fallback -Path $OutputPath
        throw "Invalid JSON response from OpenAI. Wrote fallback JSON to $OutputPath"
    }

} catch {
    # Always write a JSON file so governance-loop can read it safely
    $errObj = @{
        decision = "REJECT"
        reason   = "OpenAI API call failed"
        patch    = @()
        error    = "$($_.Exception.Message)"
    }
    Write-JsonFile -Obj $errObj -Path $OutputPath

    Write-Error "OpenAI API call failed: $($_.Exception.Message)"
    throw
}

