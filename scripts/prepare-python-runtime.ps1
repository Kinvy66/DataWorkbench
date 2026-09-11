# Download Windows embeddable CPython and install sidecar runtime wheels.
# Output: apps/resources/python-runtime/python.exe (gitignored, not committed).
# Packaged layout: resources/python-runtime/python.exe + resources/python/dw_host.
# Embeddable Python ignores PYTHONPATH; python*._pth must list ../python.
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PythonVersion = '3.12.10'
$EmbedName = "python-$PythonVersion-embed-amd64.zip"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $RepoRoot 'apps\resources\python-runtime'
$ReqFile = Join-Path $RepoRoot 'python\requirements-runtime.txt'
$CacheDir = Join-Path $RepoRoot '.cache\python-embed'
$ZipPath = Join-Path $CacheDir $EmbedName
$GetPipPath = Join-Path $CacheDir 'get-pip.py'
$StampPath = Join-Path $RuntimeDir '.dw-runtime-stamp'
$PythonExe = Join-Path $RuntimeDir 'python.exe'

function Get-RequirementsHash {
    return (Get-FileHash -Algorithm SHA256 -Path $ReqFile).Hash.ToLowerInvariant()
}

function Write-Stamp {
    $hash = Get-RequirementsHash
    @(
        "python=$PythonVersion-amd64"
        "requirements=$hash"
    ) | Set-Content -Path $StampPath -Encoding ASCII
}

function Test-StampFresh {
    if (-not (Test-Path $PythonExe) -or -not (Test-Path $StampPath)) {
        return $false
    }
    $expected = "python=$PythonVersion-amd64"
    $req = "requirements=$(Get-RequirementsHash)"
    $lines = Get-Content -Path $StampPath | ForEach-Object { $_.Trim() }
    return ($lines -contains $expected) -and ($lines -contains $req)
}

function Download-FirstSuccess {
    param(
        [string[]]$Urls,
        [string]$OutFile
    )
    New-Item -ItemType Directory -Force -Path (Split-Path $OutFile) | Out-Null
    foreach ($url in $Urls) {
        try {
            Write-Host "Downloading $url"
            Invoke-WebRequest -Uri $url -OutFile $OutFile -UseBasicParsing
            if ((Test-Path $OutFile) -and ((Get-Item $OutFile).Length -gt 10000)) {
                return
            }
        } catch {
            Write-Host "Download failed: $url ($($_.Exception.Message))"
        }
        if (Test-Path $OutFile) {
            Remove-Item $OutFile -Force
        }
    }
    throw "Could not download $(Split-Path $OutFile -Leaf)"
}

function Invoke-RuntimePython {
    param(
        [string[]]$PyArgs,
        [string]$FailureMessage
    )
    $previous = $env:PYTHONNOUSERSITE
    $env:PYTHONNOUSERSITE = '1'
    try {
        & $PythonExe @PyArgs
        if ($LASTEXITCODE -ne 0) {
            throw $FailureMessage
        }
    } finally {
        if ($null -eq $previous) {
            Remove-Item Env:PYTHONNOUSERSITE -ErrorAction SilentlyContinue
        } else {
            $env:PYTHONNOUSERSITE = $previous
        }
    }
}

function Install-RuntimeWheels {
    param([string[]]$ExtraPipArgs)
    $pipArgs = @(
        '-m', 'pip', 'install', '--no-warn-script-location', '--disable-pip-version-check',
        '-r', $ReqFile
    ) + $ExtraPipArgs
    Invoke-RuntimePython -PyArgs $pipArgs -FailureMessage 'pip install of runtime requirements failed'
}

function Complete-Runtime {
    Write-Host "Verifying pandas / numpy / pyarrow"
    Invoke-RuntimePython -PyArgs @(
        '-c', 'import pandas, numpy, pyarrow, openpyxl, pydantic'
    ) -FailureMessage 'Bundled runtime cannot import pandas/numpy/pyarrow'
    try {
        Invoke-RuntimePython -PyArgs @(
            '-m', 'pip', 'uninstall', '-y', 'pip', 'setuptools', 'wheel'
        ) -FailureMessage 'pip uninstall failed'
    } catch {
        Write-Host "Leaving pip installed (uninstall skipped)"
    }
    Get-ChildItem -Path $RuntimeDir -Recurse -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Write-Stamp
    Write-Host "Python runtime ready: $PythonExe"
}

if (-not (Test-Path $ReqFile)) {
    throw "Missing $ReqFile"
}

if (-not $Force -and (Test-StampFresh)) {
    Write-Host "Python runtime already prepared at $RuntimeDir"
    exit 0
}

if (-not $Force -and (Test-Path $PythonExe)) {
    try {
        Complete-Runtime
        exit 0
    } catch {
        Write-Host "Existing runtime failed verify, rebuilding"
    }
}

if (Test-Path $RuntimeDir) {
    Remove-Item $RuntimeDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

if (-not (Test-Path $ZipPath)) {
    Download-FirstSuccess -OutFile $ZipPath -Urls @(
        "https://www.python.org/ftp/python/$PythonVersion/$EmbedName",
        "https://mirrors.huaweicloud.com/python/$PythonVersion/$EmbedName"
    )
}

Write-Host "Extracting $EmbedName"
Expand-Archive -Path $ZipPath -DestinationPath $RuntimeDir -Force

if (-not (Test-Path $PythonExe)) {
    throw "python.exe missing after extract: $PythonExe"
}
$pth = Get-ChildItem -Path $RuntimeDir -Filter 'python*._pth' | Select-Object -First 1
if (-not $pth) {
    throw "Embeddable Python ._pth file missing in $RuntimeDir"
}
$stdZip = Get-ChildItem -Path $RuntimeDir -Filter 'python*.zip' | Select-Object -First 1
if (-not $stdZip) {
    throw "Embeddable Python stdlib zip missing in $RuntimeDir"
}
@(
    $stdZip.Name
    '.'
    'Lib/site-packages'
    '../python'
    ''
    'import site'
) | Set-Content -Path $pth.FullName -Encoding ASCII

if (-not (Test-Path $GetPipPath)) {
    Download-FirstSuccess -OutFile $GetPipPath -Urls @(
        'https://bootstrap.pypa.io/get-pip.py',
        'https://mirrors.aliyun.com/pypi/get-pip.py'
    )
}

Write-Host "Bootstrapping pip"
Invoke-RuntimePython -PyArgs @($GetPipPath, '--no-warn-script-location') -FailureMessage 'get-pip.py failed'

try {
    Install-RuntimeWheels -ExtraPipArgs @()
} catch {
    Write-Host "Retrying pip with Tsinghua mirror"
    Install-RuntimeWheels -ExtraPipArgs @('-i', 'https://pypi.tuna.tsinghua.edu.cn/simple', '--trusted-host', 'pypi.tuna.tsinghua.edu.cn')
}

Complete-Runtime
