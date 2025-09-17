param(
  [string]$Email = $env:ZD_EMAIL,
  [string]$ApiToken = $env:ZD_API_TOKEN,
  [string]$Subdomain = $env:ZD_SUBDOMAIN
)

$ErrorActionPreference = 'Stop'

# Repo root (this script is under tools\ps)
$ROOT = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $ROOT

$Exporter = Join-Path $PSScriptRoot 'Export-ZD-AllBrands-Enrichedv2.ps1'
if (!(Test-Path $Exporter)) {
  Write-Host "ERROR: Exporter not found at $Exporter" -ForegroundColor Red
  Write-Host "Place Mark's script as 'tools\\ps\\Export-ZD-AllBrands-Enrichedv2.ps1' and re-run."
  exit 1
}

# Prompt if not set via env/params
if ([string]::IsNullOrWhiteSpace($Email)) {
  $Email = Read-Host "Zendesk Admin Email"
}
if ([string]::IsNullOrWhiteSpace($ApiToken)) {
  $ApiToken = Read-Host "Zendesk API Token (paste, input hidden)" -AsSecureString | `
              ForEach-Object { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)) }
}
if ([string]::IsNullOrWhiteSpace($Subdomain)) {
  $Subdomain = Read-Host "Primary admin subdomain (e.g., libertytax)"
}

# Output naming
$today = Get-Date -Format 'yyyy-MM-dd'
$imports = Join-Path $ROOT 'imports'
New-Item -ItemType Directory -Force -Path $imports | Out-Null
$csvName = "helpcenter_${today}.all_articles_enriched.csv"
$outCsv = Join-Path $imports $csvName

Write-Host "==> Running Mark's exporter for subdomain '$Subdomain'..." -ForegroundColor Cyan
# Invoke Mark's script. Adjust parameter names if his script differs:
# Expecting it supports: -Email -Token -Subdomain -OutCsv (or similar). If his script uses different names, update here.
# Below, we support a common pattern: -Email -Token -Subdomain and write our own final CSV by moving/renaming the output.
# If Mark's script already writes the final enriched CSV with desired name/path, set $outCsv accordingly and skip Copy-Item.

# Example generalized call; please keep as-is and adjust only if needed:
& $Exporter -Email $Email -Token $ApiToken -PrimarySubdomain $Subdomain | Tee-Object -Variable ExportLog

# Try to locate the enriched CSV produced by exporter in $imports
$produced = Get-ChildItem $imports -Filter "helpcenter_${today}*.all_articles_enriched*.csv" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($null -eq $produced) {
  # Fallback: any enriched CSV today
  $produced = Get-ChildItem $imports -Filter "*all_articles_enriched*.csv" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if ($null -eq $produced) {
  Write-Host "ERROR: Could not find an enriched CSV in $imports. Export log (truncated):" -ForegroundColor Red
  $ExportLog | Select-Object -First 40 | ForEach-Object { Write-Host $_ }
  exit 1
}

# Normalize name to our standard
if ($produced.Name -ne $csvName) {
  Copy-Item $produced.FullName $outCsv -Force
}

Write-Host "==> CSV ready: $outCsv" -ForegroundColor Green

# Ingest → Lint → Index
Write-Host "==> Ingesting CSV..." -ForegroundColor Cyan
npm run ingest:csv

Write-Host "==> Linting KB..." -ForegroundColor Cyan
npm run lint:kb

Write-Host "==> Building RAG index..." -ForegroundColor Cyan
npm run rag:index

# Final report
# Count rows in data/articles.csv
$articlesCsv = Join-Path $ROOT 'data\articles.csv'
$rows = (Test-Path $articlesCsv) ? ((Get-Content $articlesCsv | Measure-Object -Line).Lines - 1) : 0

Write-Host "=== EXPORT & INGEST COMPLETE ===" -ForegroundColor Green
Write-Host ("CSV: {0}" -f $outCsv)
Write-Host ("articles.csv rows: {0}" -f $rows)
