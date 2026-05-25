$ErrorActionPreference = 'Stop'

try {
  docker rm -f voxcpm-vllm-omni-8003 *> $null
} catch {
}

docker run --gpus all -p 8003:8000 --name voxcpm-vllm-omni-8003 `
  voxcpm-vllm-omni:official `
  vllm serve openbmb/VoxCPM2 --served-model-name voxcpm2 --omni --port 8000
