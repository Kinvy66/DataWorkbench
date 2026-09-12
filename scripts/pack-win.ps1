$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not $env:ELECTRON_MIRROR) {
    $env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
}
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
    $env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
}
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

function Test-FileLocked([string]$Path) {
    if (-not (Test-Path $Path)) {
        return $false
    }
    try {
        $stream = [System.IO.File]::Open($Path, 'Open', 'ReadWrite', 'None')
        $stream.Close()
        return $false
    } catch {
        return $true
    }
}

function Stop-PackedDistProcesses {
    $unpacked = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) 'apps\dist\win-unpacked'))
    Get-CimInstance Win32_Process | ForEach-Object {
        $exe = $_.ExecutablePath
        if (-not $exe) {
            return
        }
        if ($exe.StartsWith($unpacked, [StringComparison]::OrdinalIgnoreCase)) {
            Write-Host "Stopping $($_.Name) pid=$($_.ProcessId) (running from win-unpacked)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    Get-Process -Name 'DataWorkbench' -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "Stopping DataWorkbench pid=$($_.Id)"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}

& (Join-Path $PSScriptRoot 'prepare-python-runtime.ps1')

Stop-PackedDistProcesses
Start-Sleep -Milliseconds 400

$outputRel = 'dist'
$asar = Join-Path (Get-Location) 'apps\dist\win-unpacked\resources\app.asar'
if (Test-FileLocked $asar) {
    Write-Host 'apps/dist/win-unpacked/resources/app.asar is locked (running app or editor index). Packaging to apps/dist-build instead.'
    $outputRel = 'dist-build'
}

pnpm --filter @dw/app exec electron-vite build
if ($LASTEXITCODE -ne 0) {
    throw "electron-vite build failed: $LASTEXITCODE"
}
pnpm --filter @dw/app exec electron-builder --win --config electron-builder.yml --config.directories.output=$outputRel
if ($LASTEXITCODE -ne 0) {
    throw "pack:win failed: $LASTEXITCODE"
}

$dist = Join-Path (Get-Location) "apps\$outputRel"
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

& (Join-Path $PSScriptRoot 'smoke-pack-win.ps1') -UnpackedDir (Join-Path $dist 'win-unpacked')
if ($LASTEXITCODE -ne 0) {
    throw "smoke-pack-win failed: $LASTEXITCODE"
}
