$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$outDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\docs\assets\wiki'))
$csv = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\docs\wiki\samples\wiki-demo.csv'))
$done = Join-Path $env:TEMP 'dw-wiki-capture.done'
if (-not (Test-Path $csv)) {
    throw "wiki demo csv missing: $csv"
}

$env:DW_WIKI_CAPTURE = $outDir
$env:DW_WIKI_CSV = $csv
$env:DW_WIKI_DONE = $done
Remove-Item $done -ErrorAction SilentlyContinue

Write-Host "Capturing wiki shots into $outDir"
Write-Host "Close any running DataWorkbench window first."

Write-Host "Using cmd /c pnpm"
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','pnpm --filter @dw/app dev' -PassThru -NoNewWindow
$deadline = (Get-Date).AddMinutes(4)
while (-not (Test-Path $done)) {
    if ($proc.HasExited) {
        throw "electron-vite exited before wiki capture finished (code $($proc.ExitCode))"
    }
    if ((Get-Date) -gt $deadline) {
        try { Stop-Process -Id $proc.Id -Force } catch {}
        throw "wiki capture timed out waiting for $done"
    }
    Start-Sleep -Seconds 1
}

$report = Get-Content $done -Raw
Write-Host $report
if ($proc.HasExited -eq $false) {
    try { Stop-Process -Id $proc.Id -Force } catch {}
}
if ($report -notmatch '^ok') {
    throw "wiki capture failed: $report"
}

$required = @(
    'interface-raw.png',
    'interface-overview.png',
    '01-ready.png',
    '03-data-tab.png',
    '03-table.png',
    '04-operate-tab.png',
    '04-dropna-dialog.png',
    '04-query-dialog.png',
    '05-nodes.png',
    '05-workflow.png',
    '06-chart-tab.png',
    '06-bind-dialog.png',
    '06-chart.png',
    '07-file-menu.png'
)
foreach ($name in $required) {
    $path = Join-Path $outDir $name
    if (-not (Test-Path $path)) {
        throw "missing screenshot $path"
    }
    $info = Get-Item $path
    if ($info.Length -lt 8000) {
        throw "screenshot too small: $path ($($info.Length) bytes)"
    }
}

$ping = Join-Path $outDir '01-ping.png'
if (Test-Path $ping) {
    Remove-Item $ping -Force
}

Write-Host "Wiki screenshots updated."
