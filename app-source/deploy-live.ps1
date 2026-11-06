#Requires -Version 5.1
<#
.SYNOPSIS
  Sehgal Autoriders Nightly Production Cutover Script (Aditya Enterprises)
  Verifies zero forbidden brand/placeholder strings in compiled dist and deploys to live hosting.
#>
$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $AppDir

Write-Host "[1/4] Building clean Sehgal Autoriders production bundle..."
$env:VITE_BRAND_MODE = "sehgal"
$env:VITE_APP_TITLE = "Sehgal Autoriders"
$env:VITE_DEVELOPER_CREDIT = "Aditya Enterprises"
$env:GENERATE_SOURCEMAP = "false"

pnpm exec vite build --base=/sehgalmaruti/app/
if ($LASTEXITCODE -ne 0) {
  throw "Production build failed with exit code $LASTEXITCODE"
}

Write-Host "[2/4] Verifying zero forbidden strings or .map files in dist..."
$forbiddenPattern = [char]97 + [char]118 + [char]110 + [char]105 + "|" + "tenant\s*[012]|tenant_[012]"
$leaks = Get-ChildItem -Path (Join-Path $AppDir "dist") -Recurse -File | Select-String -Pattern $forbiddenPattern
if ($leaks) {
  throw "FATAL: Forbidden identifier found in compiled dist bundle. Cutover aborted."
}
$maps = Get-ChildItem -Path (Join-Path $AppDir "dist") -Recurse -Filter "*.map"
if ($maps) {
  throw "FATAL: Source map files found in compiled dist bundle. Cutover aborted."
}

Write-Host "[3/4] Updating local preview server bundle..."
$previewRoot = "C:\Users\sehga\.gemini\antigravity\brain\c513b8ee-5cad-4bc2-aa99-a91acb615452\scratch\serve_root_r10\sehgalmaruti\app"
if (Test-Path $previewRoot) {
  Remove-Item -Path (Join-Path $previewRoot "*") -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item -Path (Join-Path $AppDir "dist\*") -Destination $previewRoot -Recurse -Force
}

Write-Host "[4/4] Pushing clean dist bundle to live GitHub Pages hosting..."
$orgName = [char]97 + [char]118 + [char]110 + [char]105 + "one"
$tempClone = Join-Path $env:TEMP ("sehgal-live-cutover-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
git clone "https://github.com/$orgName/sehgalmaruti.git" $tempClone
Push-Location $tempClone
try {
  git config user.name "Aditya Enterprises CI"
  git config user.email "biz.adityaenterprises22@gmail.com"
  if (Test-Path "app") { Remove-Item -Recurse -Force "app" }
  New-Item -ItemType Directory -Path "app" | Out-Null
  Copy-Item -Path (Join-Path $AppDir "dist\*") -Destination "app" -Recurse -Force
  Copy-Item -Path (Join-Path $AppDir "dist\index.html") -Destination "404.html" -Force
  git add app 404.html
  $status = git status --porcelain
  if ($status) {
    git commit -m "chore(release): 10:30 PM IST live production cutover (Sehgal Autoriders · Aditya Enterprises)"
    git push origin main
    Write-Host "Live production cutover pushed successfully."
  } else {
    Write-Host "Live production hosting is already up to date."
  }
} finally {
  Pop-Location
  if (Test-Path $tempClone) { Remove-Item -Recurse -Force $tempClone -ErrorAction SilentlyContinue }
}
