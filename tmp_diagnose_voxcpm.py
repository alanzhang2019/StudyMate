from __future__ import annotations

import json
import socket
import subprocess
from pathlib import Path


ROOT = Path(r"d:\AItrade\AI-MATH-MISTAKE")


def run(cmd: list[str]) -> dict[str, object]:
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return {
        "cmd": cmd,
        "returncode": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


def tcp_probe(host: str, port: int, timeout: float = 3.0) -> dict[str, object]:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
      sock.connect((host, port))
      return {"host": host, "port": port, "ok": True}
    except Exception as exc:  # noqa: BLE001
      return {"host": host, "port": port, "ok": False, "error": repr(exc)}
    finally:
      sock.close()


def main() -> None:
    data = {
        "docker_ps": run(["docker", "ps", "-a", "--filter", "name=voxcpm", "--format", "{{.Names}}|{{.Status}}|{{.Ports}}"]),
        "hold_state": run(["docker", "inspect", "voxcpm-vllm-omni-hold", "--format", "{{json .State}}"]),
        "host_state": run(["docker", "inspect", "voxcpm-vllm-omni-host", "--format", "{{json .State}}"]),
        "hold_port": run(["docker", "port", "voxcpm-vllm-omni-hold"]),
        "host_port": run(["docker", "port", "voxcpm-vllm-omni-host"]),
        "hold_vllm_ps": run(["docker", "exec", "voxcpm-vllm-omni-hold", "bash", "-lc", "ps -ef | grep '[v]llm serve'"]),
        "hold_ss": run(["docker", "exec", "voxcpm-vllm-omni-hold", "bash", "-lc", "ss -lnt"]),
        "host_vllm_ps": run(["docker", "exec", "voxcpm-vllm-omni-host", "bash", "-lc", "ps -ef | grep '[v]llm serve'"]),
        "host_ss": run(["docker", "exec", "voxcpm-vllm-omni-host", "bash", "-lc", "ss -lnt"]),
        "tcp_8004": tcp_probe("127.0.0.1", 8004),
        "tcp_8005": tcp_probe("127.0.0.1", 8005),
        "tcp_8006": tcp_probe("127.0.0.1", 8006),
    }
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    try:
        (ROOT / "tmp_voxcpm_diag.json").write_text(payload, encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        data["write_error"] = repr(exc)
        payload = json.dumps(data, ensure_ascii=False, indent=2)
    print(payload)


if __name__ == "__main__":
    main()
