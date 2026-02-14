param(
  [Parameter(Mandatory=$true)]
  [string]$JsonPath
)

if (!(Test-Path $JsonPath)) {
  throw "File not found: $JsonPath"
}

# Read raw JSON text
$raw = Get-Content -Path $JsonPath -Raw

# Replace the three known IDs (safe, surgical)
$raw = $raw -replace '"id"\s*:\s*"SUBJECT-MATH-G05"', '"id":"SUBJECT-MATHG05"'
$raw = $raw -replace '"id"\s*:\s*"UNIT-G05-MATH-01"', '"id":"UNIT-G05MATH01"'
$raw = $raw -replace '"id"\s*:\s*"LESSON-G05-MATH-01-01"', '"id":"LESSON-G05MATH0101"'

# Write back
Set-Content -Path $JsonPath -Value $raw -NoNewline -Encoding UTF8

Write-Host "Patched IDs in $JsonPath"
