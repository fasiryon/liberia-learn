Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

npx prisma format
npx prisma validate
npx prisma generate
Write-Host "✅ Prisma rebuild complete."
