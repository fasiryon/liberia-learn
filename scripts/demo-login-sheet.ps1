# scripts/demo-login-sheet.ps1
# Print formatted canonical demo credential sheet.

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  LiberiaLearn - Canonical Demo Credentials" -ForegroundColor Cyan
Write-Host "  URL: https://liberia-learn.vercel.app" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

Write-Host "CHA HIGH ACADEMY" -ForegroundColor Green
Write-Host "  Admin:     <E2E_DEMO_ADMIN_EMAIL> / <DEMO_PASSWORD>"
Write-Host "  Teacher:   <E2E_DEMO_TEACHER_EMAIL> / <DEMO_PASSWORD>"
Write-Host "  Student:   <E2E_DEMO_STUDENT_EMAIL> / <DEMO_PASSWORD>"
Write-Host "  Guardian:  <E2E_DEMO_GUARDIAN_EMAIL> / <DEMO_PASSWORD>`n"

Write-Host "MINISTRY OF EDUCATION" -ForegroundColor Magenta
Write-Host "  Official:  <E2E_DEMO_MOE_EMAIL> / <DEMO_MOE_PASSWORD>`n"

Write-Host "This is the only supported demo identity set." -ForegroundColor Yellow
