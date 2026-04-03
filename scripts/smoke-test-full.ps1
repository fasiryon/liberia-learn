# scripts/smoke-test-full.ps1
# Comprehensive smoke test using the canonical CHA/MOE demo accounts.

param(
    [string]$BaseUrl = "https://liberia-learn.vercel.app"
)

$ErrorActionPreference = "Continue"

function Get-AuthSession {
    param([string]$Email, [string]$Password)
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    try { Invoke-WebRequest -Uri "$BaseUrl/api/auth/csrf" -WebSession $session -UseBasicParsing -TimeoutSec 10 | Out-Null } catch {}
    try {
        Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method POST `
            -Body (@{ email = $Email; password = $Password } | ConvertTo-Json -Depth 3) `
            -ContentType "application/json" -WebSession $session -UseBasicParsing -TimeoutSec 15 | Out-Null
    } catch {}
    return $session
}

function Test-Endpoint {
    param([string]$Name, [string]$Url, [Microsoft.PowerShell.Commands.WebRequestSession]$Session = $null)
    try {
        $params = @{ Uri = $Url; Method = "GET"; UseBasicParsing = $true; TimeoutSec = 15 }
        if ($Session) { $params.WebSession = $Session }
        $response = Invoke-WebRequest @params
        [PSCustomObject]@{ Test = $Name; Status = $response.StatusCode; Result = "PASS" }
    } catch {
        [PSCustomObject]@{ Test = $Name; Status = "ERR"; Result = "FAIL" }
    }
}

$studentSession = Get-AuthSession -Email "student1@cha.edu.lr" -Password "DemoSeed2026!"
$teacherSession = Get-AuthSession -Email "teacher1@cha.edu.lr" -Password "DemoSeed2026!"
$adminSession = Get-AuthSession -Email "admin@cha.edu.lr" -Password "DemoSeed2026!"
$moeSession = Get-AuthSession -Email "official1@moe.gov.lr" -Password "MOESeed2026!"

$results = @()
$results += Test-Endpoint -Name "GET /api/healthz" -Url "$BaseUrl/api/healthz"
$results += Test-Endpoint -Name "Student /student/today" -Url "$BaseUrl/student/today" -Session $studentSession
$results += Test-Endpoint -Name "Teacher /teacher/students" -Url "$BaseUrl/teacher/students" -Session $teacherSession
$results += Test-Endpoint -Name "Admin /admin" -Url "$BaseUrl/admin" -Session $adminSession
$results += Test-Endpoint -Name "MOE /platform/reports" -Url "$BaseUrl/platform/reports" -Session $moeSession

Write-Host "`n--- Results ---" -ForegroundColor Yellow
$results | Format-Table -AutoSize
