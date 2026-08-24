"""
Input sanitization for user-supplied free text.

The LLM receives this text inside prompts, and it gets stored in SQLite and
rendered in the UI, so it is normalized before any of that happens:
control characters are stripped, whitespace is collapsed, and lengths are
capped. Answers keep their newlines; single-line fields do not.
"""
import re

_WS_RUN = re.compile(r"\s+")
_NEWLINE_RUN = re.compile(r"\n{3,}")


def clean_single_line(value: str, max_length: int) -> str:
    """Strip control chars (incl. newlines), collapse whitespace, cap length."""
    without_controls = "".join(
        ch for ch in value if ch == "\t" or ord(ch) >= 32
    )
    collapsed = _WS_RUN.sub(" ", without_controls).strip()
    return collapsed[:max_length]


def clean_multiline(value: str, max_length: int) -> str:
    """Like clean_single_line but preserves intentional newlines."""
    normalized = value.replace("\r\n", "\n").replace("\r", "\n")
    without_controls = "".join(
        ch for ch in normalized if ch in ("\n", "\t") or ord(ch) >= 32
    )
    tidied = _NEWLINE_RUN.sub("\n\n", without_controls).strip()
    return tidied[:max_length]


def clean_skills(items: list[str], max_items: int, max_length_each: int) -> list[str]:
    """Clean each skill, drop empties, dedupe case-insensitively, cap count."""
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in items:
        skill = clean_single_line(item, max_length_each)
        key = skill.lower()
        if skill and key not in seen:
            seen.add(key)
            cleaned.append(skill)
        if len(cleaned) >= max_items:
            break
    return cleaned
