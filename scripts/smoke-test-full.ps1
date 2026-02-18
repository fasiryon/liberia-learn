# scripts/smoke-test-full.ps1
# Comprehensive MOE Pilot smoke test
# Usage: powershell -ExecutionPolicy Bypass -File scripts/smoke-test-full.ps1 [-BaseUrl https://your-domain.vercel.app]

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
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session = $null,
        [int]$ExpectStatus = 0
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
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
        $sw.Stop()
        $status = $response.StatusCode
        $ok = $status -ge 200 -and $status -lt 400
        if ($ExpectStatus -gt 0 -and $status -ne $ExpectStatus) { $ok = $false }

        return [PSCustomObject]@{
            Test   = $Name
            Status = $status
            Result = if ($ok) { "PASS" } else { "FAIL" }
            Time   = "$($sw.ElapsedMilliseconds)ms"
        }
    }
    catch {
        $sw.Stop()
        $errStatus = 0
        if ($_.Exception.Response) {
            $errStatus = [int]$_.Exception.Response.StatusCode
        }
        $ok = $false
        if ($ExpectStatus -gt 0 -and $errStatus -eq $ExpectStatus) { $ok = $true }

        return [PSCustomObject]@{
            Test   = $Name
            Status = if ($errStatus) { $errStatus } else { "ERR" }
            Result = if ($ok) { "PASS" } else { "FAIL" }
            Time   = "$($sw.ElapsedMilliseconds)ms"
        }
    }
}

function Get-AuthSession {
    param([string]$Email, [string]$Password)
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    try { Invoke-WebRequest -Uri "$BaseUrl/api/auth/csrf" -WebSession $session -UseBasicParsing -TimeoutSec 10 | Out-Null } catch {}
    $body = @{ email = $Email; password = $Password }
    try {
        Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method POST `
            -Body ($body | ConvertTo-Json -Depth 3) -ContentType "application/json" `
            -WebSession $session -UseBasicParsing -TimeoutSec 15 | Out-Null
    } catch {}
    return $session
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  LiberiaLearn Full Smoke Test" -ForegroundColor Cyan
Write-Host "  Base: $BaseUrl" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$results = @()

# --- HEALTH ---
$results += Test-Endpoint -Name "GET /api/healthz" -Url "$BaseUrl/api/healthz"
$results += Test-Endpoint -Name "GET /api/health/db" -Url "$BaseUrl/api/health/db"
$results += Test-Endpoint -Name "GET /login" -Url "$BaseUrl/login"

# --- AUTH ---
$studentSession = Get-AuthSession -Email "fatu.flomo@mca.edu.lr" -Password "Password123"
$teacherSession = Get-AuthSession -Email "mpewee@mca.edu.lr" -Password "Password123"
$adminSession = Get-AuthSession -Email "jkollie@mca.edu.lr" -Password "Password123"
$platformSession = Get-AuthSession -Email "jkollie@mca.edu.lr" -Password "Password123"

$results += Test-Endpoint -Name "Student login" -Url "$BaseUrl/api/auth/login" -Method "POST" `
    -Body @{ email = "fatu.flomo@mca.edu.lr"; password = "Password123" } -Session $studentSession
$results += Test-Endpoint -Name "Teacher login" -Url "$BaseUrl/api/auth/login" -Method "POST" `
    -Body @{ email = "mpewee@mca.edu.lr"; password = "Password123" } -Session $teacherSession
$results += Test-Endpoint -Name "Admin login" -Url "$BaseUrl/api/auth/login" -Method "POST" `
    -Body @{ email = "jkollie@mca.edu.lr"; password = "Password123" } -Session $adminSession

# --- STUDENT ---
$results += Test-Endpoint -Name "GET /api/student/today" -Url "$BaseUrl/api/student/today" -Session $studentSession
$results += Test-Endpoint -Name "GET /api/student/progress" -Url "$BaseUrl/api/student/progress" -Session $studentSession
$results += Test-Endpoint -Name "Student /student/today" -Url "$BaseUrl/student/today" -Session $studentSession
$results += Test-Endpoint -Name "Student /student/progress" -Url "$BaseUrl/student/progress" -Session $studentSession

# --- TEACHER ---
$results += Test-Endpoint -Name "GET /api/teacher/students" -Url "$BaseUrl/api/teacher/students" -Session $teacherSession
$results += Test-Endpoint -Name "GET /api/teacher/schedule" -Url "$BaseUrl/api/teacher/schedule" -Session $teacherSession
$results += Test-Endpoint -Name "GET /api/teacher/dashboard" -Url "$BaseUrl/api/teacher/dashboard" -Session $teacherSession
$results += Test-Endpoint -Name "Teacher /teacher/students" -Url "$BaseUrl/teacher/students" -Session $teacherSession
$results += Test-Endpoint -Name "Teacher /teacher/schedule" -Url "$BaseUrl/teacher/schedule" -Session $teacherSession
$results += Test-Endpoint -Name "Teacher /teacher/curriculum" -Url "$BaseUrl/teacher/curriculum" -Session $teacherSession

# --- ADMIN ---
$results += Test-Endpoint -Name "GET /api/admin/school-branding" -Url "$BaseUrl/api/admin/school-branding" -Session $adminSession
$results += Test-Endpoint -Name "GET /api/admin/school-settings" -Url "$BaseUrl/api/admin/school-settings" -Session $adminSession
$results += Test-Endpoint -Name "GET /api/admin/onboarding" -Url "$BaseUrl/api/admin/onboarding" -Session $adminSession
$results += Test-Endpoint -Name "GET /api/admin/pilot-score" -Url "$BaseUrl/api/admin/pilot-score" -Session $adminSession
$results += Test-Endpoint -Name "Admin /admin" -Url "$BaseUrl/admin" -Session $adminSession
$results += Test-Endpoint -Name "Admin /admin/curriculum" -Url "$BaseUrl/admin/curriculum" -Session $adminSession
$results += Test-Endpoint -Name "Admin /admin/school-branding" -Url "$BaseUrl/admin/school-branding" -Session $adminSession
$results += Test-Endpoint -Name "Admin /admin/school-settings" -Url "$BaseUrl/admin/school-settings" -Session $adminSession
$results += Test-Endpoint -Name "Admin /admin/onboarding" -Url "$BaseUrl/admin/onboarding" -Session $adminSession
$results += Test-Endpoint -Name "Admin /admin/pilot-score" -Url "$BaseUrl/admin/pilot-score" -Session $adminSession
$results += Test-Endpoint -Name "Admin /admin/notifications" -Url "$BaseUrl/admin/notifications" -Session $adminSession

# --- PLATFORM ---
$results += Test-Endpoint -Name "Platform /platform/security" -Url "$BaseUrl/platform/security" -Session $platformSession
$results += Test-Endpoint -Name "Platform /platform/reports" -Url "$BaseUrl/platform/reports" -Session $platformSession
$results += Test-Endpoint -Name "GET /api/platform/reports" -Url "$BaseUrl/api/platform/reports" -Session $platformSession

# --- Results ---
Write-Host "`n--- Results ---" -ForegroundColor Yellow
$results | Format-Table -AutoSize

$passed = ($results | Where-Object { $_.Result -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.Result -eq "FAIL" }).Count
$total  = $results.Count

if ($failed -eq 0) {
    Write-Host "`nAll $total tests PASSED" -ForegroundColor Green
} else {
    Write-Host "`n$passed/$total passed, $failed FAILED" -ForegroundColor Red
}
