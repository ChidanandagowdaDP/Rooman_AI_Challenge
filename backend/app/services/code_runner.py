"""
Local code execution for coding-challenge answers.

Deliberately minimal: this is a local dev tool, so we run trusted-user code
in a subprocess with a hard timeout and output caps instead of building a
sandbox. Only runtimes actually installed on the machine are offered —
anything else returns supported=False and the UI falls back to AI review.
"""
import os
import shutil
import subprocess
import sys
import tempfile

TIMEOUT_SECONDS = 8
MAX_CODE_CHARS = 20_000
MAX_OUTPUT_CHARS = 4_000


def _python_runtime():
    return sys.executable


def _node_runtime():
    return shutil.which("node")


# language id (same ids the frontend dropdown uses) -> (file ext, runtime lookup)
_RUNTIMES = {
    "python": (".py", _python_runtime),
    "javascript": (".js", _node_runtime),
}


def supported_languages() -> list[str]:
    return sorted(
        lang for lang, (_, resolve) in _RUNTIMES.items() if resolve()
    )


def run_code(language: str, code: str) -> dict:
    """Execute `code` locally. Returns a plain dict matching RunCodeOut."""
    lang = (language or "").strip().lower()
    entry = _RUNTIMES.get(lang)

    def unsupported() -> dict:
        available = ", ".join(supported_languages()) or "none installed"
        return {
            "supported": False,
            "exit_code": None,
            "stdout": "",
            "stderr": "",
            "timed_out": False,
            "message": (
                f"'{language}' can't be executed locally. Supported here: "
                f"{available}. Other languages are still reviewed by the AI."
            ),
        }

    if entry is None:
        return unsupported()

    ext, resolve_runtime = entry
    runtime = resolve_runtime()
    if not runtime:
        return unsupported()

    code = code[:MAX_CODE_CHARS]
    workdir = tempfile.mkdtemp(prefix="interviewai_run_")
    filepath = os.path.join(workdir, f"solution{ext}")
    with open(filepath, "w", encoding="utf-8") as fh:
        fh.write(code)

    try:
        proc = subprocess.run(
            [runtime, filepath],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            cwd=workdir,
        )
        return {
            "supported": True,
            "exit_code": proc.returncode,
            "stdout": proc.stdout[:MAX_OUTPUT_CHARS],
            "stderr": proc.stderr[:MAX_OUTPUT_CHARS],
            "timed_out": False,
            "message": None,
        }
    except subprocess.TimeoutExpired:
        return {
            "supported": True,
            "exit_code": None,
            "stdout": "",
            "stderr": "",
            "timed_out": True,
            "message": f"Execution exceeded {TIMEOUT_SECONDS}s and was stopped.",
        }
    except OSError as exc:
        return {
            "supported": True,
            "exit_code": None,
            "stdout": "",
            "stderr": f"Runner error: {exc}",
            "timed_out": False,
            "message": "The code could not be started on this machine.",
        }
