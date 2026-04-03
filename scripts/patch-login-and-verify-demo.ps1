$ErrorActionPreference = "Stop"

Write-Host "=== LiberiaLearn: verify canonical demo identities ===" -ForegroundColor Cyan

$loginPath = "app/login/page.tsx"
if (!(Test-Path $loginPath)) { throw "Missing $loginPath" }

Write-Host "Login page present: $loginPath" -ForegroundColor Green
Write-Host "Canonical demo accounts:" -ForegroundColor Cyan
Write-Host "  admin@cha.edu.lr / DemoSeed2026!" -ForegroundColor Gray
Write-Host "  teacher1@cha.edu.lr / DemoSeed2026!" -ForegroundColor Gray
Write-Host "  student1@cha.edu.lr / DemoSeed2026!" -ForegroundColor Gray
Write-Host "  guardian1@cha.family.lr / DemoSeed2026!" -ForegroundColor Gray
Write-Host "  official1@moe.gov.lr / MOESeed2026!" -ForegroundColor Gray

Write-Host "`n=== Verifying canonical demo users in DB (uses .env DATABASE_URL) ===" -ForegroundColor Cyan

node -e "require('dotenv').config(); const {PrismaClient}=require('@prisma/client'); const prisma=new PrismaClient(); const emails=['admin@cha.edu.lr','teacher1@cha.edu.lr','student1@cha.edu.lr','guardian1@cha.family.lr','official1@moe.gov.lr']; prisma.user.findMany({where:{email:{in:emails}},select:{email:true,role:true,schoolId:true}}).then(r=>console.log(r)).catch(e=>{console.error(e); process.exit(1);}).finally(()=>prisma['$disconnect']());"
