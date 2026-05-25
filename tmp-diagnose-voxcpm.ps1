$ErrorActionPreference = 'Continue'

$root = 'd:\AItrade\AI-MATH-MISTAKE'
$names = @(
  'voxcpm-vllm-omni',
  'voxcpm-vllm-omni-debug',
  'voxcpm-vllm-omni-8002',
  'voxcpm-vllm-omni-8003'
)

docker ps -a --no-trunc | Out-File -FilePath "$root\tmp-docker-ps-all.txt" -Encoding utf8
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 8000, 8001, 8002, 8003 } |
  Select-Object LocalAddress, LocalPort, OwningProcess, State |
  Format-Table -AutoSize |
  Out-File -FilePath "$root\tmp-voxcpm-listen.txt" -Encoding utf8

foreach ($name in $names) {
  $exists = docker inspect $name 2>$null
  if ($LASTEXITCODE -ne 0) {
    "missing" | Out-File -FilePath "$root\tmp-$name-status.txt" -Encoding utf8
    continue
  }

  docker inspect $name | Out-File -FilePath "$root\tmp-$name-inspect.json" -Encoding utf8
  docker logs --tail 200 $name 2>&1 | Out-File -FilePath "$root\tmp-$name-logs.txt" -Encoding utf8
  docker top $name 2>&1 | Out-File -FilePath "$root\tmp-$name-top.txt" -Encoding utf8
}

$urls = @(
  'http://127.0.0.1:8000/v1/models',
  'http://127.0.0.1:8001/v1/models',
  'http://127.0.0.1:8002/v1/models',
  'http://127.0.0.1:8003/v1/models'
)

foreach ($url in $urls) {
  $safe = $url.Replace('http://', '').Replace('/', '_').Replace(':', '_')
  try {
    $resp = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 5
    "status=$($resp.StatusCode)`n$($resp.Content)" |
      Out-File -FilePath "$root\tmp-$safe.txt" -Encoding utf8
  } catch {
    $_ | Out-String | Out-File -FilePath "$root\tmp-$safe.txt" -Encoding utf8
  }
}
