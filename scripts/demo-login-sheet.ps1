# scripts/demo-login-sheet.ps1
# Print formatted demo credential sheet for MOE presentation

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  LiberiaLearn - MOE Pilot Demo Credentials" -ForegroundColor Cyan
Write-Host "  All passwords: Password123" -ForegroundColor Cyan
Write-Host "  URL: https://liberia-learn.vercel.app" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

Write-Host "PLATFORM ADMIN" -ForegroundColor Magenta
Write-Host "  Email:    jkollie@mca.edu.lr"
Write-Host "  Role:     Platform Admin + School Admin`n"

Write-Host "--- School 1: Monrovia Central Academy ---" -ForegroundColor Green
Write-Host "  County:   Montserrado"
Write-Host "  Admin:    jkollie@mca.edu.lr"
Write-Host "  Teacher:  mpewee@mca.edu.lr (Mary Pewee - Grade 7 Math)"
Write-Host "  Teacher:  dnimely@mca.edu.lr (David Nimely - Grade 8 English)"
Write-Host "  Teacher:  sflomo@mca.edu.lr (Sarah Flomo - Grade 7 SS)"
Write-Host "  Student:  fatu.wreh@mca.edu.lr (Fatu Wreh - Grade 7A)"
Write-Host "  Student:  david.karnga@mca.edu.lr (David Karnga - Grade 8B)"
Write-Host "  Guardian: +231 077 0000001`n"

Write-Host "--- School 2: Paynesville Community School ---" -ForegroundColor Yellow
Write-Host "  County:   Montserrado"
Write-Host "  Admin:    gtokpah@pcs.edu.lr (Grace Tokpah)"
Write-Host "  Teacher:  esumo@pcs.edu.lr (Emmanuel Sumo - Grade 6)"
Write-Host "  Teacher:  pwreh@pcs.edu.lr (Patience Wreh - Grade 9)"
Write-Host "  Student:  alfred.flomo@pcs.edu.lr (Alfred Flomo)`n"

Write-Host "--- School 3: Kakata Rural School ---" -ForegroundColor Red
Write-Host "  County:   Margibi"
Write-Host "  Admin:    mkarnga@krs.edu.lr (Moses Karnga)"
Write-Host "  Teacher:  fkollie@krs.edu.lr (Fatu Kollie - Grade 5)"
Write-Host "  Teacher:  abestman@krs.edu.lr (Augustine Bestman - Grade 10)"
Write-Host "  Student:  alfred.sumo@krs.edu.lr (Alfred Sumo)`n"

Write-Host "--- Smoke Test Accounts (legacy) ---" -ForegroundColor DarkGray
Write-Host "  Admin:    admin@mcs.edu.lr"
Write-Host "  Teacher:  teacher@mcs.edu.lr"
Write-Host "  Student:  student1@mcs.edu.lr`n"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Story Arc for Demo:" -ForegroundColor Cyan
Write-Host "  School 1 (MCA): HIGH performer - Score ~85" -ForegroundColor Green
Write-Host "  School 2 (PCS): IMPROVING - Score ~60" -ForegroundColor Yellow
Write-Host "  School 3 (KRS): NEEDS HELP - Score ~35" -ForegroundColor Red
Write-Host "========================================================`n" -ForegroundColor Cyan
