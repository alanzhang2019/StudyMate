import vllm
import pkgutil
import sys

print(f"vLLM version: {vllm.__version__}")

# Search for TokensPrompt in all vllm modules
results = []
for importer, modname, ispkg in pkgutil.iter_modules(vllm.__path__):
    if modname.startswith('_'):
        continue
    try:
        mod = __import__(f"vllm.{modname}", fromlist=[''])
        for attr in dir(mod):
            if 'prompt' in attr.lower() or 'token' in attr.lower():
                results.append(f"vllm.{modname}.{attr}")
    except Exception as e:
        pass

for r in results:
    print(r)

# Also check specific locations
print("--- Direct imports ---")
locations = [
    'vllm.inputs',
    'vllm.engine',
    'vllm.lora',
    'vllm.model_executor',
]
for loc in locations:
    try:
        mod = __import__(loc, fromlist=[''])
        print(f"{loc}: {dir(mod)}")
    except Exception as e:
        print(f"{loc}: ERROR {e}")
