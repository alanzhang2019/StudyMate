$ErrorActionPreference = 'Continue'

$root = 'd:\AItrade\AI-MATH-MISTAKE'

Set-Content "$root\tmp-diag-v2-marker.txt" 'start'

$dockerPs = docker ps -a --filter name=voxcpm --format "{{.Names}}|{{.Status}}|{{.Ports}}" 2>&1 | Out-String
Set-Content "$root\tmp-diag-v2-docker-ps.txt" $dockerPs
Add-Content "$root\tmp-diag-v2-marker.txt" 'after-docker-ps'

$listen = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 8000, 8001, 8002, 8003 } |
  Select-Object LocalAddress, LocalPort, OwningProcess, State |
  Format-Table -AutoSize |
  Out-String
Set-Content "$root\tmp-diag-v2-listen.txt" $listen
Add-Content "$root\tmp-diag-v2-marker.txt" 'after-listen'

$inspect8003 = docker inspect voxcpm-vllm-omni-8003 --format "{{.State.Running}}|{{.State.Status}}|{{.State.ExitCode}}" 2>&1 | Out-String
Set-Content "$root\tmp-diag-v2-inspect-8003.txt" $inspect8003
Add-Content "$root\tmp-diag-v2-marker.txt" 'after-inspect-8003'

$inspectDebug = docker inspect voxcpm-vllm-omni-debug --format "{{.State.Running}}|{{.State.Status}}|{{.State.ExitCode}}" 2>&1 | Out-String
Set-Content "$root\tmp-diag-v2-inspect-debug.txt" $inspectDebug
Add-Content "$root\tmp-diag-v2-marker.txt" 'after-inspect-debug'

$curl8001 = try {
  (Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8001/v1/models' -TimeoutSec 5 | Select-Object StatusCode, Content | Format-List | Out-String)
} catch {
  ($_ | Out-String)
}
Set-Content "$root\tmp-diag-v2-http-8001.txt" $curl8001
Add-Content "$root\tmp-diag-v2-marker.txt" 'done'
