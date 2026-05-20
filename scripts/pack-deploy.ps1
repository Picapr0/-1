$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$staging = Join-Path $env:TEMP "text-fix-deploy"
$zip = Join-Path $root "deploy.zip"

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path "$staging\netlify\functions" -Force | Out-Null

$files = @(
  "index.html", "app.js", "styles.css", "netlify.toml",
  "netlify\functions\text-fix.mjs"
)

foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) {
    Write-Host "Missing: $f" -ForegroundColor Red
    exit 1
  }
  $dest = Join-Path $staging $f
  $dir = Split-Path $dest -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item $src $dest -Force
}

if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($zip, "Create")
Get-ChildItem $staging -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($staging.Length + 1).Replace("\", "/")
  [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel)
}
$archive.Dispose()
Remove-Item $staging -Recurse -Force
Write-Host "OK: deploy.zip" -ForegroundColor Green
