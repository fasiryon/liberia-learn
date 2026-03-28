param(
  [string]$EnvFile = ".env.local"
)

$ErrorActionPreference = "Stop"

& "$PSScriptRoot/load-env-and-run.ps1" -EnvFile $EnvFile ".\node_modules\tsx\dist\cli.mjs" "scripts/run-evals.ts"
exit $LASTEXITCODE

