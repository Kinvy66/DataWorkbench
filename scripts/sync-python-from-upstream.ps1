# Sync vendored Python from the upstream Qt data-workbench repo.
# Skips files whose first 40 lines contain "# dw:adapted".
# Usage:
#   $env:DAWB_UPSTREAM = "F:\Rep\CAE_Code\data-workbench"
#   .\scripts\sync-python-from-upstream.ps1

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$upstream = $env:DAWB_UPSTREAM
if (-not $upstream) {
    Write-Error "Set DAWB_UPSTREAM to the upstream data-workbench clone."
}
$engineSrc = Join-Path $upstream "src\PyScripts\DAWorkbench\DAWorkFlowPy"
$engineDst = Join-Path $repoRoot "python\dw_workflow"
if (-not (Test-Path $engineSrc)) {
    Write-Error "Engine source not found: $engineSrc"
}

function Test-Adapted([string]$path) {
    if (-not (Test-Path $path)) {
        return $false
    }
    $head = Get-Content -LiteralPath $path -TotalCount 40 -Encoding utf8 -ErrorAction SilentlyContinue
    return ($head -join "`n") -match "# dw:adapted"
}

$skipNames = @("style_demo_nodes.py")
$copied = 0
$skipped = 0
Get-ChildItem -LiteralPath $engineSrc -Recurse -File | ForEach-Object {
    if ($_.Name -in $skipNames) {
        $skipped++
        return
    }
    if ($_.FullName -match "\\__pycache__\\") {
        return
    }
    $rel = $_.FullName.Substring($engineSrc.Length).TrimStart("\")
    $dest = Join-Path $engineDst $rel
    if (Test-Adapted $dest) {
        Write-Host "skip adapted $rel"
        $skipped++
        return
    }
    $parent = Split-Path $dest -Parent
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent | Out-Null
    }
    Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
    Write-Host "copy $rel"
    $copied++
}

$iconSrc = Join-Path $upstream "plugins\DASystemNodes\PyScripts\DASystemNodes\icon"
$iconDst = Join-Path $repoRoot "python\dw_nodes_system\icon"
foreach ($name in @("start.svg", "end.svg", "constant.svg", "delay.svg")) {
    $from = Join-Path $iconSrc $name
    if (Test-Path $from) {
        if (-not (Test-Path $iconDst)) {
            New-Item -ItemType Directory -Path $iconDst | Out-Null
        }
        Copy-Item -LiteralPath $from -Destination (Join-Path $iconDst $name) -Force
        Write-Host "copy icon $name"
        $copied++
    }
}

$hash = git -C $upstream rev-parse HEAD
Write-Host "upstream $hash"
Write-Host "copied=$copied skipped=$skipped"
Write-Host "Re-run: python/.venv/Scripts/python.exe -m pytest python/tests -q"
