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
        $status = $response.StatusCode
        $ok = $status -ge 200 -and $status -lt 400

        # Try to parse JSON body for role info
        $role = ""
        if ($response.Content -and $Method -eq "POST") {
            try {
                $json = $response.Content | ConvertFrom-Json
                if ($json.user.role) { $role = $json.user.role }
            } catch {}
        }

        return [PSCustomObject]@{
            Test   = $Name
            Status = $status
            Result = if ($ok) { "PASS" } else { "FAIL" }
            Role   = $role
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
        }
    }
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

# 2. Auth tests
$logins = @(
    @{ Name = "Student login"; Email = "student1@mcs.edu.lr"; Password = "Password123" },
    @{ Name = "Teacher login"; Email = "teacher@mcs.edu.lr"; Password = "Password123" },
    @{ Name = "Admin login";   Email = "admin@mcs.edu.lr";   Password = "Password123" }
)

foreach ($login in $logins) {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

    # First get CSRF token by hitting the login page
    try {
        Invoke-WebRequest -Uri "$BaseUrl/api/auth/csrf" -WebSession $session -UseBasicParsing -TimeoutSec 10 | Out-Null
    } catch {}

    # Try NextAuth credentials endpoint
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

# 3. Print results table
Write-Host "`n--- Results ---" -ForegroundColor Yellow
$results | Format-Table -AutoSize

# 4. Summary
$passed = ($results | Where-Object { $_.Result -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.Result -eq "FAIL" }).Count
$total  = $results.Count

if ($failed -eq 0) {
    Write-Host "`nAll $total tests PASSED" -ForegroundColor Green
} else {
    Write-Host "`n$passed/$total passed, $failed FAILED" -ForegroundColor Red
}
