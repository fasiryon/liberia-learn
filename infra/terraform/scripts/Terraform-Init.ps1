[CmdletBinding()]
param(
    [switch]$Upgrade
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$terraformDir = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    throw "Required command not found: terraform"
}

Push-Location $terraformDir
try {
    $arguments = @("init", "-input=false")

    if ($Upgrade) {
        $arguments += "-upgrade"
    }

    & terraform @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "terraform init failed."
    }
}
finally {
    Pop-Location
}
