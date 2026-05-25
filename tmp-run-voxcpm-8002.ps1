$ErrorActionPreference = 'Stop'

$logFile = 'd:\AItrade\AI-MATH-MISTAKE\voxcpm-run-8002.log'

try {
  docker rm -f voxcpm-vllm-omni-8002 *> $null
} catch {
}

docker run --gpus all -p 8002:8000 --name voxcpm-vllm-omni-8002 `
  voxcpm-vllm-omni:official `
  vllm serve openbmb/VoxCPM2 --served-model-name voxcpm2 --omni --port 8000 *>> $logFile
