# scripts/demo-login-sheet.ps1
# Print formatted canonical demo credential sheet.

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  LiberiaLearn - Canonical Demo Credentials" -ForegroundColor Cyan
Write-Host "  URL: https://liberia-learn.vercel.app" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

Write-Host "CHA HIGH ACADEMY" -ForegroundColor Green
Write-Host "  Admin:     admin@cha.edu.lr / <DEMO_PASSWORD>"
Write-Host "  Teacher:   teacher1@cha.edu.lr / <DEMO_PASSWORD>"
Write-Host "  Student:   student1@cha.edu.lr / <DEMO_PASSWORD>"
Write-Host "  Guardian:  guardian1@cha.family.lr / <DEMO_PASSWORD>`n"

Write-Host "MINISTRY OF EDUCATION" -ForegroundColor Magenta
Write-Host "  Official:  official1@moe.gov.lr / MOESeed2026!`n"

Write-Host "This is the only supported demo identity set." -ForegroundColor Yellow
