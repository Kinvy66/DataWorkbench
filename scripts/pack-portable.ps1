$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

pnpm --filter @dw/app pack:portable
if ($LASTEXITCODE -ne 0) {
  throw "pack:portable failed: $LASTEXITCODE"
}

$unpacked = Join-Path $PSScriptRoot '..\apps\dist\win-unpacked'
$unpacked = [System.IO.Path]::GetFullPath($unpacked)
if (-not (Test-Path (Join-Path $unpacked 'DataWorkbench.exe'))) {
  throw "Expected DataWorkbench.exe under $unpacked"
}
$marker = Join-Path $unpacked 'resources\python\dw_host\__main__.py'
if (-not (Test-Path $marker)) {
  throw "Python sidecar scripts missing at $marker"
}

Write-Host "Portable directory: $unpacked"
Write-Host "Install Python 3.11+ packages: py -3.12 -m pip install -r resources\python\requirements.txt"
Write-Host "Then run DataWorkbench.exe. NSIS installer is not part of this slice."
