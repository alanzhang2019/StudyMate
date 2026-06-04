import sys
print("START")
sys.stdout.flush()

import vllm
print(f"vLLM version: {vllm.__version__}")
sys.stdout.flush()

try:
    from vllm.inputs import data
    print("vllm.inputs.data: EXISTS")
    print("Attributes:", dir(data))
except ImportError as e:
    print(f"vllm.inputs.data: MISSING - {e}")
sys.stdout.flush()

try:
    from vllm.inputs.data import TokensPrompt
    print("TokensPrompt from vllm.inputs.data: EXISTS")
except ImportError as e:
    print(f"TokensPrompt from vllm.inputs.data: MISSING - {e}")
sys.stdout.flush()

print("END")
