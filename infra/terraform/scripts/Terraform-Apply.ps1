[CmdletBinding()]
param(
    [string]$PlanFile = "tfplan"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$terraformDir = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    throw "Required command not found: terraform"
}

Push-Location $terraformDir
try {
    if (-not (Test-Path $PlanFile)) {
        throw "Plan file not found: $PlanFile. Create it first with Terraform-Plan.ps1 -OutFile $PlanFile."
    }

    & terraform apply $PlanFile
    if ($LASTEXITCODE -ne 0) {
        throw "terraform apply failed."
    }
}
finally {
    Pop-Location
}
