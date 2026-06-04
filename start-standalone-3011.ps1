$ErrorActionPreference = 'Stop'

$root = 'D:\AItrade\AI-MATH-MISTAKE'
$out = 'D:\AItrade\ai-math-mistake-machine\standalone-3011.out.log'
$err = 'D:\AItrade\ai-math-mistake-machine\standalone-3011.err.log'
$pidFile = 'D:\AItrade\ai-math-mistake-machine\standalone-3011.pid'

Remove-Item -Force $out, $err, $pidFile -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath powershell `
  -ArgumentList @(
    '-NoProfile',
    '-Command',
    "`$env:PORT='3011'; Set-Location '$root'; node '.next/standalone/server.js'"
  ) `
  -WorkingDirectory $root `
  -RedirectStandardOutput $out `
  -RedirectStandardError $err `
  -PassThru

Set-Content -Path $pidFile -Value $proc.Id
Start-Sleep -Seconds 4

if (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue) {
  Write-Output "STARTED_PID=$($proc.Id)"
} else {
  Write-Output 'START_FAILED'
}
