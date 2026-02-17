# scripts/smoke-test.ps1
# Full platform smoke test for LiberiaLearn
# Usage: powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1 [-BaseUrl https://your-domain.vercel.app]

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
        [string]$ExpectContains = ""
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
        $status = $response.StatusCode
        $ok = $status -ge 200 -and $status -lt 400

        # Try to parse JSON body for role info
        $role = ""
        $detail = ""
        if ($response.Content -and $Method -eq "POST") {
            try {
                $json = $response.Content | ConvertFrom-Json
                if ($json.user.role) { $role = $json.user.role }
            } catch {}
        }

        # Check ExpectContains
        if ($ok -and $ExpectContains -and $response.Content) {
            if ($response.Content -notmatch [regex]::Escape($ExpectContains)) {
                $ok = $false
                $detail = "missing: $ExpectContains"
            }
        }

        return [PSCustomObject]@{
            Test   = $Name
            Status = $status
            Result = if ($ok) { "PASS" } else { "FAIL" }
            Role   = $role
            Detail = $detail
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
            Role   = ""
            Detail = $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
        }
    }
}

# Helper: get authenticated session for a user
function Get-AuthSession {
    param(
        [string]$Email,
        [string]$Password
    )

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    try {
        Invoke-WebRequest -Uri "$BaseUrl/api/auth/csrf" -WebSession $session -UseBasicParsing -TimeoutSec 10 | Out-Null
    } catch {}

    $body = @{ email = $Email; password = $Password }
    try {
        Invoke-WebRequest `
            -Uri "$BaseUrl/api/auth/login" `
            -Method POST `
            -Body ($body | ConvertTo-Json -Depth 3) `
            -ContentType "application/json" `
            -WebSession $session `
            -UseBasicParsing `
            -TimeoutSec 15 | Out-Null
    } catch {}

    return $session
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  LiberiaLearn Smoke Test" -ForegroundColor Cyan
Write-Host "  Base: $BaseUrl" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$results = @()

# 1. Health checks
$results += Test-Endpoint -Name "GET /api/healthz" -Url "$BaseUrl/api/healthz"
$results += Test-Endpoint -Name "GET /api/health/db" -Url "$BaseUrl/api/health/db"
$results += Test-Endpoint -Name "GET /login" -Url "$BaseUrl/login"

# 2. Auth tests - login API
$logins = @(
    @{ Name = "Student login"; Email = "student1@mcs.edu.lr"; Password = "Password123" },
    @{ Name = "Teacher login"; Email = "teacher@mcs.edu.lr"; Password = "Password123" },
    @{ Name = "Admin login";   Email = "admin@mcs.edu.lr";   Password = "Password123" }
)

foreach ($login in $logins) {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    try {
        Invoke-WebRequest -Uri "$BaseUrl/api/auth/csrf" -WebSession $session -UseBasicParsing -TimeoutSec 10 | Out-Null
    } catch {}

    $body = @{
        email    = $login.Email
        password = $login.Password
    }

    $result = Test-Endpoint `
        -Name $login.Name `
        -Url "$BaseUrl/api/auth/login" `
        -Method "POST" `
        -Body $body `
        -Session $session

    $results += $result
}

# 3. Role-based page access tests (using authenticated sessions)

# Admin: /admin should return 200 and contain "Admin Console" or "No School"
$adminSession = Get-AuthSession -Email "admin@mcs.edu.lr" -Password "Password123"
$results += Test-Endpoint -Name "Admin /admin page" -Url "$BaseUrl/admin" -Session $adminSession
$results += Test-Endpoint -Name "Admin /admin/curriculum" -Url "$BaseUrl/admin/curriculum" -Session $adminSession

# Teacher: /teacher/curriculum should return 200
$teacherSession = Get-AuthSession -Email "teacher@mcs.edu.lr" -Password "Password123"
$results += Test-Endpoint -Name "Teacher /teacher/curriculum" -Url "$BaseUrl/teacher/curriculum" -Session $teacherSession

# Student: /dashboard should return 200 (dark dashboard)
$studentSession = Get-AuthSession -Email "student1@mcs.edu.lr" -Password "Password123"
$results += Test-Endpoint -Name "Student /dashboard" -Url "$BaseUrl/dashboard" -Session $studentSession

# Student: /student/dashboard should redirect to /dashboard (check for 200 after redirect)
$results += Test-Endpoint -Name "Student /student/dashboard redirect" -Url "$BaseUrl/student/dashboard" -Session $studentSession

# 4. Print results table
Write-Host "`n--- Results ---" -ForegroundColor Yellow
$results | Format-Table -AutoSize

# 5. Summary
$passed = ($results | Where-Object { $_.Result -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.Result -eq "FAIL" }).Count
$total  = $results.Count

if ($failed -eq 0) {
    Write-Host "`nAll $total tests PASSED" -ForegroundColor Green
} else {
    Write-Host "`n$passed/$total passed, $failed FAILED" -ForegroundColor Red
}
