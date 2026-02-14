param(
  [string]$Root = ".\FactoryArtifacts\Subjects",
  [string]$OutPath = ".\FactoryArtifacts\Subjects\manifest.json"
)

$files = Get-ChildItem -Path $Root -Recurse -Filter *.json | Sort-Object FullName

$items = foreach ($f in $files) {
  # path like FactoryArtifacts\Subjects\G05\MATH.json
  $rel = Resolve-Path $f.FullName | ForEach-Object {
    $_.Path.Substring((Resolve-Path ".").Path.Length + 1)
  }

  # Extract grade + subject from folder/file name
  $gradeFolder = Split-Path (Split-Path $f.FullName -Parent) -Leaf   # G05
  $subjectName = [IO.Path]::GetFileNameWithoutExtension($f.Name)     # MATH

  [pscustomobject]@{
    grade_folder = $gradeFolder
    grade = [int]($gradeFolder -replace "[^0-9]", "")
    subject = $subjectName
    path = $rel -replace "\\","/"
  }
}

$manifest = @{
  generated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  root = ($Root -replace "\\","/")
  count = $items.Count
  items = $items
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $OutPath -Encoding UTF8
Write-Host "✅ Wrote manifest: $OutPath"
Write-Host "Count: $($items.Count)"
