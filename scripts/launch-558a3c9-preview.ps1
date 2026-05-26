$ErrorActionPreference = 'Stop'

$target = 'D:\AItrade\StudyMate-clean'
$expectedCommit = '558a3c904c4947bda49c56478298b835b9a6c7ee'
$port = 3003
$debugLog = Join-Path $target '.trae-launch-3003.debug.log'
$installOut = Join-Path $target '.trae-install-3003.out.log'
$installErr = Join-Path $target '.trae-install-3003.err.log'
$prismaOut = Join-Path $target '.trae-prisma-3003.out.log'
$prismaErr = Join-Path $target '.trae-prisma-3003.err.log'
$devOut = Join-Path $target '.next-dev-3003.out.log'
$devErr = Join-Path $target '.next-dev-3003.err.log'

function Write-DebugStage {
  param(
    [string]$Stage,
    [string]$Message
  )

  $line = "[{0}] {1} {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Stage, $Message
  Add-Content -Path $debugLog -Value $line
  Write-Output $line
}

if (-not (Test-Path $target)) {
  throw "Missing target directory: $target"
}

"" | Set-Content -Path $debugLog
Write-DebugStage 'BOOT' "target=$target port=$port expectedCommit=$expectedCommit"

Write-DebugStage 'GIT_FETCH_START' 'fetching origin'
$fetchProc = Start-Process -FilePath 'git' `
  -ArgumentList @('-C', $target, 'fetch', 'origin') `
  -RedirectStandardOutput $installOut `
  -RedirectStandardError $installErr `
  -PassThru `
  -Wait

if ($fetchProc.ExitCode -ne 0) {
  throw "git fetch failed with exit code $($fetchProc.ExitCode)"
}
Write-DebugStage 'GIT_FETCH_DONE' "exit=$($fetchProc.ExitCode)"

Write-DebugStage 'GIT_CHECKOUT_START' "checkout $expectedCommit"
$checkoutProc = Start-Process -FilePath 'git' `
  -ArgumentList @('-C', $target, 'checkout', '--detach', $expectedCommit) `
  -RedirectStandardOutput $installOut `
  -RedirectStandardError $installErr `
  -PassThru `
  -Wait

if ($checkoutProc.ExitCode -ne 0) {
  throw "git checkout failed with exit code $($checkoutProc.ExitCode)"
}
Write-DebugStage 'GIT_CHECKOUT_DONE' "exit=$($checkoutProc.ExitCode)"

$head = (git -C $target rev-parse HEAD).Trim()
Write-DebugStage 'GIT_HEAD' "head=$head"
if ($head -ne $expectedCommit) {
  throw "Unexpected commit in $target : $head"
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  $pids = $listener | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
  Write-DebugStage 'PORT_RESET' "stoppedPids=$($pids -join ',')"
}

if (-not (Test-Path (Join-Path $target 'node_modules'))) {
  Write-DebugStage 'PNPM_INSTALL_START' 'node_modules missing'
  $installProc = Start-Process -FilePath 'pnpm.cmd' `
    -ArgumentList @('install', '--frozen-lockfile') `
    -WorkingDirectory $target `
    -RedirectStandardOutput $installOut `
    -RedirectStandardError $installErr `
    -PassThru `
    -Wait

  if ($installProc.ExitCode -ne 0) {
    throw "pnpm install failed with exit code $($installProc.ExitCode)"
  }
  Write-DebugStage 'PNPM_INSTALL_DONE' "exit=$($installProc.ExitCode)"
} else {
  Write-DebugStage 'PNPM_INSTALL_SKIP' 'node_modules present'
}

Write-DebugStage 'PRISMA_START' 'running prisma generate'
$prismaProc = Start-Process -FilePath 'pnpm.cmd' `
  -ArgumentList @('exec', 'prisma', 'generate') `
  -WorkingDirectory $target `
  -RedirectStandardOutput $prismaOut `
  -RedirectStandardError $prismaErr `
  -PassThru `
  -Wait

if ($prismaProc.ExitCode -ne 0) {
  throw "prisma generate failed with exit code $($prismaProc.ExitCode)"
}
Write-DebugStage 'PRISMA_DONE' "exit=$($prismaProc.ExitCode)"

Write-DebugStage 'NEXT_START' "starting next dev on port $port"
$devProc = Start-Process -FilePath 'pnpm.cmd' `
  -ArgumentList @('exec', 'next', 'dev', '--webpack', '-p', "$port") `
  -WorkingDirectory $target `
  -RedirectStandardOutput $devOut `
  -RedirectStandardError $devErr `
  -PassThru

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listener) {
    Write-DebugStage 'WAIT_LISTEN' "attempt=$i listening=true"
  } else {
    Write-DebugStage 'WAIT_LISTEN' "attempt=$i listening=false"
  }
  if ($listener) {
    try {
      $resp = Invoke-WebRequest -Uri "http://localhost:$port/auth/login" -UseBasicParsing -TimeoutSec 5
      Write-DebugStage 'WAIT_HTTP' "attempt=$i status=$($resp.StatusCode)"
      if ($resp.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      Write-DebugStage 'WAIT_HTTP' "attempt=$i error=$($_.Exception.Message)"
    }
  }

  if ($devProc.HasExited) {
    Write-DebugStage 'NEXT_EXIT' "code=$($devProc.ExitCode)"
    break
  }
}

if (-not $ready) {
  if ($devProc.HasExited) {
    throw "next dev exited early with code $($devProc.ExitCode)"
  }

  throw "next dev did not become ready on port $port"
}

Write-DebugStage 'READY' "url=http://localhost:$port/ pid=$($devProc.Id)"
Write-Output "READY:http://localhost:$port/"
Write-Output "PID:$($devProc.Id)"
