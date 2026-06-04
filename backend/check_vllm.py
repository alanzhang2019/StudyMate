import vllm
import pkgutil

# Check vllm version
print(f"vLLM version: {vllm.__version__}")

# List all vllm submodules
submodules = [m.name for m in pkgutil.iter_modules(vllm.__path__)]
print(f"Submodules: {submodules}")

# Check if inputs.data exists
try:
    from vllm.inputs import data
    print("vllm.inputs.data: EXISTS")
    print(dir(data))
except ImportError as e:
    print(f"vllm.inputs.data: MISSING ({e})")

# Check if TokensPrompt exists somewhere
for submodule in submodules:
    try:
        mod = __import__(f"vllm.{submodule}", fromlist=['TokensPrompt'])
        if hasattr(mod, 'TokensPrompt'):
            print(f"Found TokensPrompt in vllm.{submodule}")
    except:
        pass
