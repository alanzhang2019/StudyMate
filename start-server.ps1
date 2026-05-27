param(
  [int]$Port = 3001,
  [int]$MaxWaitSeconds = 60
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$outPath = Join-Path $projectRoot "server-out.log"
$errPath = Join-Path $projectRoot "server-err.log"
$pidPath = Join-Path $projectRoot "server-pid.txt"
$nextBin = Join-Path $projectRoot "node_modules\next\dist\bin\next"
$probeUrl = "http://localhost:$Port/auth/login"
$rootUrl = "http://localhost:$Port/"

function Test-AppReady {
  param(
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (Test-AppReady -Url $probeUrl) {
  Write-Output "READY:$rootUrl"
  return
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  $pid = ($listener | Select-Object -First 1).OwningProcess
  throw "Port $Port is already in use by process $pid, but $probeUrl is not returning 200. Please free the port and try again."
}

if (-not (Test-Path $nextBin)) {
  throw "Next.js executable not found: $nextBin"
}

Set-Content -Path $outPath -Value "[launcher] starting next dev on port $Port"
Set-Content -Path $errPath -Value "[launcher] initialized"

$devProc = Start-Process -FilePath "node.exe" `
  -ArgumentList @($nextBin, "dev", "--webpack", "--port", "$Port") `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $outPath `
  -RedirectStandardError $errPath `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $pidPath -Value "$($devProc.Id)"

for ($i = 0; $i -lt $MaxWaitSeconds; $i++) {
  Start-Sleep -Seconds 1

  if ($devProc.HasExited) {
    throw "next dev exited prematurely with code $($devProc.ExitCode). Please check $errPath."
  }

  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $listener) {
    continue
  }

  if (Test-AppReady -Url $probeUrl) {
    Write-Output "READY:$rootUrl"
    Write-Output "PID:$($devProc.Id)"
    return
  }
}

throw "next dev did not become ready within $MaxWaitSeconds seconds. Please check $outPath and $errPath."
