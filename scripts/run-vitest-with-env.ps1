param(
  [string]$EnvFile = ".env.local",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$VitestArgs
)

$ErrorActionPreference = "Stop"

$args = @(".\node_modules\vitest\vitest.mjs", "run")
if ($VitestArgs -and $VitestArgs.Count -gt 0) {
  $args += $VitestArgs
}

& "$PSScriptRoot/load-env-and-run.ps1" -EnvFile $EnvFile @args
exit $LASTEXITCODE

