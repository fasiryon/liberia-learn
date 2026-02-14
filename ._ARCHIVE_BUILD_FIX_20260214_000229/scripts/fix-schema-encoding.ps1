# scripts/fix-schema-encoding.ps1
param(
  [string]$SchemaPath = "prisma/schema.prisma"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $SchemaPath)) { throw "Not found: $SchemaPath" }

$bytes = [System.IO.File]::ReadAllBytes($SchemaPath)

# Detect UTF-16 by presence of many 0x00 bytes
$nullCount = ($bytes | Where-Object { $_ -eq 0 }).Count
$isUtf16Likely = $nullCount -gt 10

if ($isUtf16Likely) {
  $text = [System.Text.Encoding]::Unicode.GetString($bytes)  # UTF-16 LE
} else {
  # Try UTF-8 first
  $text = [System.Text.Encoding]::UTF8.GetString($bytes)
}

# Remove BOM / zero-width chars that break parsers
$text = $text -replace "^\uFEFF", ""          # BOM at file start
$text = $text -replace "\uFEFF", ""           # BOM anywhere
$text = $text -replace "\u200B|\u200C|\u200D", ""  # zero-width

# Normalize line endings to Windows CRLF (optional but nice)
$text = $text -replace "`r?`n", "`r`n"

# Write as UTF-8 NO BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($SchemaPath, $text, $utf8NoBom)

Write-Host "Fixed encoding + hidden chars: $SchemaPath"
