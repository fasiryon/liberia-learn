[CmdletBinding()]
param(
    [string]$VarFile = "terraform.tfvars",
    [string]$OutFile,
    [switch]$RefreshOnly,
    [switch]$DetailedExitCode
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$terraformDir = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    throw "Required command not found: terraform"
}

Push-Location $terraformDir
try {
    $arguments = @("plan", "-input=false", "-var-file=$VarFile")

    if ($RefreshOnly) {
        $arguments += "-refresh-only"
    }

    if ($DetailedExitCode) {
        $arguments += "-detailed-exitcode"
    }

    if ($OutFile) {
        $arguments += "-out=$OutFile"
    }

    & terraform @arguments
    $exitCode = $LASTEXITCODE

    if ($DetailedExitCode) {
        exit $exitCode
    }

    if ($exitCode -ne 0) {
        throw "terraform plan failed."
    }
}
finally {
    Pop-Location
}
