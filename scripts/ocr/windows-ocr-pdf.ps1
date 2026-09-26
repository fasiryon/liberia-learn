# OCR selected pages of a scanned PDF with the built-in Windows OCR engine.
#
# Uses only Windows Runtime APIs that ship with Windows 10/11
# (Windows.Data.Pdf to render, Windows.Media.Ocr to recognise); nothing is
# installed. Output is one JSON object: { engine, language, scale, pages: [{ page, text, lines }] }.
#
# Usage (Windows PowerShell 5.1):
#   powershell -NoProfile -File scripts/ocr/windows-ocr-pdf.ps1 -PdfPath <file.pdf> -OutPath <out.json> [-Scale 3]
param(
  [Parameter(Mandatory = $true)][string]$PdfPath,
  [Parameter(Mandatory = $true)][string]$OutPath,
  [double]$Scale = 3.0
)
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1"
  })[0]
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncAction"
  })[0]
function Await($op, [Type]$resultType) {
  $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($op))
  $task.Wait() | Out-Null
  return $task.Result
}
function AwaitAction($op) {
  $task = $asTaskAction.Invoke($null, @($op))
  $task.Wait() | Out-Null
}

$full = (Resolve-Path $PdfPath).Path
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$lang = New-Object Windows.Globalization.Language("en-US")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if ($null -eq $engine) { throw "Windows OCR engine for en-US is not available" }

$pages = @()
for ($i = 0; $i -lt $doc.PageCount; $i++) {
  $page = $doc.GetPage([uint32]$i)
  $opts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $opts.DestinationWidth = [uint32]([math]::Round($page.Size.Width * $Scale))
  $opts.DestinationHeight = [uint32]([math]::Round($page.Size.Height * $Scale))
  $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  AwaitAction ($page.RenderToStreamAsync($stream, $opts))
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  if ($bitmap.PixelWidth -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension -or $bitmap.PixelHeight -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension) {
    throw "Rendered page $($i + 1) exceeds OcrEngine.MaxImageDimension; lower -Scale"
  }
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  # Keep line geometry so table columns can be reconstructed from x positions.
  $lines = @($result.Lines | ForEach-Object {
      $words = @($_.Words)
      $x = ($words | ForEach-Object { $_.BoundingRect.X } | Measure-Object -Minimum).Minimum
      $y = ($words | ForEach-Object { $_.BoundingRect.Y } | Measure-Object -Minimum).Minimum
      [ordered]@{ text = $_.Text; x = [math]::Round($x); y = [math]::Round($y) }
    })
  $pages += [ordered]@{ page = $i + 1; width = $bitmap.PixelWidth; height = $bitmap.PixelHeight; text = $result.Text; lines = $lines }
  $page.Dispose()
  $stream.Dispose()
}

$out = [ordered]@{ engine = "Windows.Media.Ocr"; language = "en-US"; scale = $Scale; pageCount = $doc.PageCount; pages = $pages }
$json = $out | ConvertTo-Json -Depth 6
$outFull = if ([System.IO.Path]::IsPathRooted($OutPath)) { $OutPath } else { Join-Path (Get-Location) $OutPath }
[System.IO.File]::WriteAllText($outFull, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "ocr pages=$($doc.PageCount) out=$OutPath"
