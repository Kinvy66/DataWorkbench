$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not $env:ELECTRON_MIRROR) {
    $env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
}
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
    $env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
}
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

& (Join-Path $PSScriptRoot 'prepare-python-runtime.ps1')

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
$runtime = Join-Path $unpacked 'resources\python-runtime\python.exe'
if (-not (Test-Path $runtime)) {
    throw "Bundled Python runtime missing at $runtime"
}

Write-Host "Portable directory: $unpacked"
Write-Host "Python is bundled. Run DataWorkbench.exe; no system Python is required."
Write-Host "Optional override: set DW_PYTHON to another python.exe."
