# scripts/smoke-test.ps1
# Full platform smoke test for LiberiaLearn using the canonical CHA/MOE demo accounts.

param(
    [string]$BaseUrl = "https://liberia-learn.vercel.app"
)

$ErrorActionPreference = "Continue"

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session = $null
    )

    try {
        $params = @{
            Uri             = $Url
            Method          = $Method
            UseBasicParsing = $true
            TimeoutSec      = 15
        }
        if ($Session) { $params.WebSession = $Session }
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 5)
            $params.ContentType = "application/json"
        }

        $response = Invoke-WebRequest @params
        return [PSCustomObject]@{
            Test   = $Name
            Status = $response.StatusCode
            Result = if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { "PASS" } else { "FAIL" }
        }
    }
    catch {
        $errStatus = 0
        if ($_.Exception.Response) {
            $errStatus = [int]$_.Exception.Response.StatusCode
        }
        return [PSCustomObject]@{
            Test   = $Name
            Status = if ($errStatus) { $errStatus } else { "ERR" }
            Result = "FAIL"
        }
    }
}

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

$studentEmail = "student1@cha.edu.lr"
$teacherEmail = "teacher1@cha.edu.lr"
$adminEmail = "admin@cha.edu.lr"
$moeEmail = "official1@moe.gov.lr"
$demoPassword = $env:DEMO_SEED_PASSWORD
if ([string]::IsNullOrWhiteSpace($demoPassword)) {
    if ($env:NODE_ENV -eq "production" -or $env:DEMO_MODE -eq "true") {
        throw "DEMO_SEED_PASSWORD is required for production/demo smoke tests."
    }
    $demoPassword = "local-demo-password-change-me"
}
$moePassword = "MOESeed2026!"

$results = @()
$results += Test-Endpoint -Name "GET /api/healthz" -Url "$BaseUrl/api/healthz"
$results += Test-Endpoint -Name "GET /api/health/db" -Url "$BaseUrl/api/health/db"
$results += Test-Endpoint -Name "GET /login" -Url "$BaseUrl/login"
$results += Test-Endpoint -Name "Student login" -Url "$BaseUrl/api/auth/login" -Method "POST" -Body @{ email = $studentEmail; password = $demoPassword }
$results += Test-Endpoint -Name "Teacher login" -Url "$BaseUrl/api/auth/login" -Method "POST" -Body @{ email = $teacherEmail; password = $demoPassword }
$results += Test-Endpoint -Name "Admin login" -Url "$BaseUrl/api/auth/login" -Method "POST" -Body @{ email = $adminEmail; password = $demoPassword }
$results += Test-Endpoint -Name "MOE login" -Url "$BaseUrl/api/auth/login" -Method "POST" -Body @{ email = $moeEmail; password = $moePassword }

$studentSession = Get-AuthSession -Email $studentEmail -Password $demoPassword
$teacherSession = Get-AuthSession -Email $teacherEmail -Password $demoPassword
$adminSession = Get-AuthSession -Email $adminEmail -Password $demoPassword
$moeSession = Get-AuthSession -Email $moeEmail -Password $moePassword

$results += Test-Endpoint -Name "Student /student/today" -Url "$BaseUrl/student/today" -Session $studentSession
$results += Test-Endpoint -Name "Teacher /teacher/curriculum" -Url "$BaseUrl/teacher/curriculum" -Session $teacherSession
$results += Test-Endpoint -Name "Admin /admin" -Url "$BaseUrl/admin" -Session $adminSession
$results += Test-Endpoint -Name "MOE /platform/reports" -Url "$BaseUrl/platform/reports" -Session $moeSession

Write-Host "`n--- Results ---" -ForegroundColor Yellow
$results | Format-Table -AutoSize
