$ErrorActionPreference = "Stop"

Write-Host "=== LiberiaLearn: Guardian login + find auth + verify demo users ===" -ForegroundColor Cyan

# 0) Paths
$loginPath = "app/login/page.tsx"
if (!(Test-Path $loginPath)) { throw "Missing $loginPath" }

# 1) Backup
$bak = "$loginPath.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item $loginPath $bak -Force
Write-Host "Backup: $bak" -ForegroundColor DarkGray

# 2) Patch login page (idempotent)
$raw = Get-Content $loginPath -Raw

if ($raw -notmatch '"guardian"') {

  # Expand union to include guardian
  $raw = $raw -replace `
    'const \[role, setRole\] = useState<"student" \| "teacher" \| "admin">\("student"\);', `
    'const [role, setRole] = useState<"student" | "teacher" | "guardian" | "admin">("student");'

  # Insert DEFAULTS right after role state line
  $defaults = @"
const DEFAULTS = {
  student:  { email: "student@school.lr",   password: "Password123" },
  teacher:  { email: "teacher@school.lr",   password: "Password123" },
  guardian: { email: "guardian@mcs.edu.lr", password: "Password123" },
  admin:    { email: "admin@school.lr",     password: "Password123" },
} as const;

"@

  $raw = $raw -replace `
    '(const \[role, setRole\] = useState<"student" \| "teacher" \| "guardian" \| "admin">\("student"\);\s*)', `
    ('$1' + $defaults)

  # Set initial email/pass to DEFAULTS.student
  $raw = $raw -replace 'const \[email, setEmail\] = useState\("student@school\.lr"\);', 'const [email, setEmail] = useState(DEFAULTS.student.email);'
  $raw = $raw -replace 'const \[password, setPassword\] = useState\("password123"\);', 'const [password, setPassword] = useState(DEFAULTS.student.password);'

  # Add useEffect to update fields when role changes (if not present already)
  if ($raw -notmatch 'DEFAULTS\[role\]') {
    $useEff = @"
  useEffect(() => {
    setEmail(DEFAULTS[role].email);
    setPassword(DEFAULTS[role].password);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

"@
    $raw = $raw -replace '(const \[loading, setLoading\] = useState\(false\);\s*)', ('$1' + $useEff)
  }

  # Expand role selector UI
  $raw = $raw -replace 'grid-cols-3', 'grid-cols-4'
  $raw = $raw -replace '\(\["student", "teacher", "admin"\] as const\)', '(["student", "teacher", "guardian", "admin"] as const)'

  # Fix demo hint capitalization
  $raw = $raw -replace 'student@school\.lr / password123', 'student@school.lr / Password123'

  Set-Content $loginPath $raw -Encoding UTF8
  Write-Host "Patched: app/login/page.tsx (Guardian tab + defaults)" -ForegroundColor Green

} else {
  Write-Host "Skip patch: Guardian already present in login page." -ForegroundColor Yellow
}

# 3) Find auth file(s)
Write-Host "`n=== Searching for NextAuth/Credentials auth implementation ===" -ForegroundColor Cyan

$hits = git ls-files |
  Select-String -Pattern "NextAuth|nextauth|CredentialsProvider|credentials" |
  Select-Object Filename, LineNumber, Line |
  Sort-Object Filename |
  Select-Object -First 40

$hits | Format-Table -AutoSize

$authFile = (git ls-files | Where-Object {
  $_ -match "nextauth" -or $_ -match "\[\.{3}nextauth\]" -or $_ -match "auth.*route\.ts$"
} | Select-Object -First 1)

if ($authFile) {
  Write-Host "`nCandidate auth file: $authFile" -ForegroundColor DarkGray
  try { Get-Content -LiteralPath $authFile -TotalCount 120 }
  catch { Write-Host "(Could not read $authFile)" -ForegroundColor Yellow }
} else {
  Write-Host "No obvious auth file auto-selected (see hits table above)." -ForegroundColor Yellow
}

# 4) Verify the 6 demo users exist in CURRENT .env DATABASE_URL
Write-Host "`n=== Verifying demo users in DB (uses .env DATABASE_URL) ===" -ForegroundColor Cyan

node -e "require('dotenv').config(); const {PrismaClient}=require('@prisma/client'); const prisma=new PrismaClient(); const emails=['admin@school.lr','teacher@school.lr','student@school.lr','admin@mcs.edu.lr','teacher@mcs.edu.lr','guardian@mcs.edu.lr']; prisma.user.findMany({where:{email:{in:emails}},select:{email:true,role:true,schoolId:true}}).then(r=>console.log(r)).catch(e=>{console.error(e); process.exit(1);}).finally(()=>prisma['\$disconnect']());"
