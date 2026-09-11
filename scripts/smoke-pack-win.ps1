# Verify a packed Windows build can run sidecar without the developer's Python.
# Simulates a clean machine: no DW_PYTHON / DW_PYTHON_ROOT, PYTHONNOUSERSITE=1,
# embeddable python.exe + resources/python (._pth), not python/.venv.
param(
    [string]$UnpackedDir = '',
    [switch]$SkipGui
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $UnpackedDir) {
    $UnpackedDir = Join-Path $RepoRoot 'apps\dist\win-unpacked'
}
$UnpackedDir = [System.IO.Path]::GetFullPath($UnpackedDir)
$Resources = Join-Path $UnpackedDir 'resources'
$PythonRoot = Join-Path $Resources 'python'
$RuntimeExe = Join-Path $Resources 'python-runtime\python.exe'
$Exe = Join-Path $UnpackedDir 'DataWorkbench.exe'
$Dist = Split-Path $UnpackedDir
$Setup = Get-ChildItem -Path $Dist -Filter 'DataWorkbench-Setup-*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1

function Assert-Path([string]$Path, [string]$Label) {
    if (-not (Test-Path $Path)) {
        throw "Missing $Label : $Path"
    }
}

function Invoke-BundledHostRpc {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $RuntimeExe
    $psi.Arguments = '-u -m dw_host'
    $psi.WorkingDirectory = $PythonRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables['PYTHONUNBUFFERED'] = '1'
    $psi.EnvironmentVariables['PYTHONIOENCODING'] = 'utf-8'
    $psi.EnvironmentVariables['PYTHONNOUSERSITE'] = '1'
    $psi.EnvironmentVariables.Remove('PYTHONPATH')
    $psi.EnvironmentVariables.Remove('DW_PYTHON')
    $psi.EnvironmentVariables.Remove('DW_PYTHON_ROOT')
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    try {
        $readyLine = $proc.StandardOutput.ReadLine()
        if (-not $readyLine) {
            $err = $proc.StandardError.ReadToEnd()
            throw "bundled dw_host produced no stdout. stderr=$err"
        }
        $ready = $readyLine | ConvertFrom-Json
        if ($ready.method -ne 'host.ready') {
            throw "expected host.ready, got $readyLine"
        }
        if (-not $ready.params.pandasAvailable) {
            throw "bundled runtime pandasAvailable is false"
        }
        $hello = '{"jsonrpc":"2.0","id":1,"method":"host.hello","params":{"appVersion":"0.1.0","workspaceRoot":"pack-smoke"}}'
        $proc.StandardInput.WriteLine($hello)
        $helloLine = $proc.StandardOutput.ReadLine()
        $helloMsg = $helloLine | ConvertFrom-Json
        if (-not $helloMsg.result.ok) {
            throw "host.hello failed: $helloLine"
        }
        $proc.StandardInput.WriteLine('{"jsonrpc":"2.0","id":2,"method":"host.shutdown","params":{}}')
        [void]$proc.StandardOutput.ReadLine()
        if (-not $proc.WaitForExit(8000)) {
            $proc.Kill()
            throw "bundled dw_host did not exit after host.shutdown"
        }
        if ($proc.ExitCode -ne 0) {
            throw "bundled dw_host exit $($proc.ExitCode)"
        }
    } finally {
        if (-not $proc.HasExited) {
            $proc.Kill()
        }
        $proc.Dispose()
    }
}

Assert-Path $UnpackedDir 'win-unpacked'
Assert-Path $Exe 'DataWorkbench.exe'
Assert-Path $RuntimeExe 'bundled python.exe'
Assert-Path (Join-Path $PythonRoot 'dw_host\__main__.py') 'dw_host'
if (-not $Setup) {
    throw "NSIS installer DataWorkbench-Setup-*.exe not found under $Dist"
}

$venv = Join-Path $PythonRoot '.venv'
if (Test-Path $venv) {
    throw "Packed python/.venv must not ship: $venv"
}
$tests = Join-Path $PythonRoot 'tests'
if (Test-Path $tests) {
    throw "Packed python/tests must not ship: $tests"
}
$forbidden = @(
    (Join-Path $UnpackedDir 'testdata'),
    (Join-Path $PythonRoot '.env'),
    (Join-Path $UnpackedDir '.env')
)
foreach ($item in $forbidden) {
    if (Test-Path $item) {
        throw "Forbidden path shipped: $item"
    }
}

Write-Host "Checking bundled python imports (no system site-packages)"
$prevNoUser = $env:PYTHONNOUSERSITE
$prevPath = $env:PYTHONPATH
$env:PYTHONNOUSERSITE = '1'
Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
try {
    & $RuntimeExe -c "import pandas, numpy, pyarrow, openpyxl, pydantic, dw_host"
    if ($LASTEXITCODE -ne 0) {
        throw "bundled python cannot import runtime packages / dw_host"
    }
} finally {
    if ($null -eq $prevNoUser) {
        Remove-Item Env:PYTHONNOUSERSITE -ErrorAction SilentlyContinue
    } else {
        $env:PYTHONNOUSERSITE = $prevNoUser
    }
    if ($null -eq $prevPath) {
        Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
    } else {
        $env:PYTHONPATH = $prevPath
    }
}

Write-Host "RPC host.hello via bundled python (PYTHONPATH unset)"
Invoke-BundledHostRpc

if ($SkipGui) {
    Write-Host "SkipGui: installer $($Setup.FullName)"
    Write-Host "SkipGui: portable $UnpackedDir"
    exit 0
}

Write-Host "Launching packed exe with isolated userData (DW_PYTHON cleared)"
$userData = Join-Path $env:TEMP ("dw-pack-smoke-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $userData | Out-Null
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $Exe
$psi.Arguments = "--user-data-dir=`"$userData`""
$psi.WorkingDirectory = $UnpackedDir
$psi.UseShellExecute = $false
$psi.EnvironmentVariables.Remove('DW_PYTHON')
$psi.EnvironmentVariables.Remove('DW_PYTHON_ROOT')
$psi.EnvironmentVariables.Remove('PYTHONPATH')
$psi.EnvironmentVariables['PYTHONNOUSERSITE'] = '1'
$gui = New-Object System.Diagnostics.Process
$gui.StartInfo = $psi
[void]$gui.Start()
$deadline = (Get-Date).AddSeconds(45)
$sidecarLog = Join-Path $userData 'logs\sidecar.log'
$mainLog = Join-Path $userData 'logs\main.log'
try {
    $ok = $false
    while ((Get-Date) -lt $deadline) {
        if ((Test-Path $sidecarLog) -and (Test-Path $mainLog)) {
            $sidecarText = Get-Content -Raw -Path $sidecarLog -ErrorAction SilentlyContinue
            $mainText = Get-Content -Raw -Path $mainLog -ErrorAction SilentlyContinue
            $usesBundled = $mainText -match 'python-runtime\\python.exe' -or $sidecarText -match 'python-runtime\\python.exe'
            $ready = $sidecarText -match 'pandasAvailable=True' -or $sidecarText -match 'host.ready'
            if ($usesBundled -and $ready) {
                $ok = $true
                break
            }
        }
        Start-Sleep -Milliseconds 400
    }
    if (-not $ok) {
        $sidecarDump = if (Test-Path $sidecarLog) { Get-Content -Raw $sidecarLog } else { '(missing sidecar.log)' }
        $mainDump = if (Test-Path $mainLog) { Get-Content -Raw $mainLog } else { '(missing main.log)' }
        throw "packed exe did not become ready with bundled Python.`nmain.log:`n$mainDump`nsidecar.log:`n$sidecarDump"
    }
} finally {
    if (-not $gui.HasExited) {
        $gui.Kill()
        [void]$gui.WaitForExit(5000)
    }
    $gui.Dispose()
}

Write-Host "Installer: $($Setup.FullName)"
Write-Host "Portable: $UnpackedDir"
Write-Host "Packed sidecar used bundled python-runtime and reported pandasAvailable=True."
