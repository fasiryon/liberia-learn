[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$EnvFile = ".env.local",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CommandArgs
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
  Write-Error "Environment file not found: $EnvFile"
}

if (-not $CommandArgs -or $CommandArgs.Count -eq 0) {
  Write-Error "Usage: .\scripts\load-env-and-run.ps1 [-EnvFile .env.local] <command> [args...]"
}

$env:DOTENV_CONFIG_PATH = $EnvFile

$command = $CommandArgs[0]
$args = @()
if ($CommandArgs.Count -gt 1) {
  $args = $CommandArgs[1..($CommandArgs.Count - 1)]
}

& node -r dotenv/config $command @args
$exitCode = $LASTEXITCODE

if ($null -ne $exitCode) {
  exit $exitCode
}
