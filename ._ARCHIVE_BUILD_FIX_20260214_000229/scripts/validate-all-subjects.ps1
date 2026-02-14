param(
  [string]$Root = ".\FactoryArtifacts\Subjects"
)

$SchemaPath = ".\docs\internal\schemas\unified-curriculum-schema.json"

if (!(Test-Path $Root)) { throw "Not found: $Root" }
if (!(Test-Path $SchemaPath)) { throw "Not found: $SchemaPath" }

$files = Get-ChildItem -Path $Root -Recurse -Filter *.json | Sort-Object FullName

$passed = 0
$failed = 0
$failures = @()

foreach ($f in $files) {
  $out = node .\scripts\validate-schema.mjs $SchemaPath $f.FullName 2>&1
  if ($LASTEXITCODE -eq 0) {
    $passed++
  } else {
    $failed++
    $failures += [pscustomobject]@{
      file = $f.FullName
      error = ($out | Select-Object -First 1)
    }
  }
}

Write-Host "=============================="
Write-Host "VALIDATION SUMMARY"
Write-Host "Root: $Root"
Write-Host "Total: $($files.Count)"
Write-Host "Passed: $passed"
Write-Host "Failed: $failed"
Write-Host "=============================="

if ($failed -gt 0) {
  Write-Host "`nFailures (first line):"
  $failures | Format-Table -AutoSize
  exit 1
}

exit 0
