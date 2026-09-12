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

pnpm --filter @dw/app pack:win
if ($LASTEXITCODE -ne 0) {
    throw "pack:win failed: $LASTEXITCODE"
}

$dist = Join-Path $PSScriptRoot '..\apps\dist'
$dist = [System.IO.Path]::GetFullPath($dist)
$setup = Get-ChildItem -Path $dist -Filter 'DataWorkbench-Setup-*.exe' |
    Where-Object { $_.Name -notlike '*.__uninstaller.exe' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $setup) {
    throw "NSIS installer not found under $dist"
}
$runtime = Join-Path $dist 'win-unpacked\resources\python-runtime\python.exe'
if (-not (Test-Path $runtime)) {
    throw "Bundled Python runtime missing at $runtime"
}

Write-Host "Installer: $($setup.FullName)"
Write-Host "Portable directory: $(Join-Path $dist 'win-unpacked')"
Write-Host "Give users the Setup .exe. They do not need to install Python."

& (Join-Path $PSScriptRoot 'smoke-pack-win.ps1')
if ($LASTEXITCODE -ne 0) {
    throw "smoke-pack-win failed: $LASTEXITCODE"
}
