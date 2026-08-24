"""
Thin wrapper around any OpenAI-compatible LLM server (Ollama, vLLM,
LM Studio, llama.cpp-server, Groq, OpenRouter, ...).

Everything that talks to the LLM goes through call_json(), which:
  1. sends the system + user prompt
  2. strips markdown fences defensively (models sometimes add them anyway)
  3. parses JSON
  4. retries with a stricter follow-up instruction on parse failure

This is the ONLY module in the app that imports the OpenAI SDK — keeping
that isolated makes it trivial to swap providers later.
"""
import json
import logging

import openai

from app.config import settings

logger = logging.getLogger(__name__)

_client = openai.OpenAI(
    base_url=settings.LLM_BASE_URL,
    api_key=settings.LLM_API_KEY,
)


class LLMJSONError(Exception):
    """Raised when the model fails to return parseable JSON after retries."""


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


def _extract_json(text: str) -> dict:
    cleaned = _strip_fences(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Fall back to grabbing the outermost {...} block
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def call_json(
    *, system_prompt: str, user_prompt: str, max_tokens: int = 1024
) -> dict:
    """Call the model and return a parsed JSON dict, retrying on bad JSON."""
    last_error: Exception | None = None
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    for attempt in range(1, settings.MAX_LLM_RETRIES + 1):
        try:
            response = _client.chat.completions.create(
                model=settings.MODEL_NAME,
                max_tokens=max_tokens,
                messages=messages,
            )
            raw_text = response.choices[0].message.content or ""
            return _extract_json(raw_text)
        except json.JSONDecodeError as exc:
            last_error = exc
            logger.warning("LLM returned invalid JSON (attempt %s): %s", attempt, exc)
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": raw_text},
                {
                    "role": "user",
                    "content": (
                        "That was not valid JSON. Reply again with ONLY the "
                        "raw JSON object, no markdown fences, no other text."
                    ),
                },
            ]
        except openai.APIError as exc:
            last_error = exc
            logger.warning("LLM API error (attempt %s): %s", attempt, exc)

    raise LLMJSONError(
        f"Failed to get valid JSON from model after {settings.MAX_LLM_RETRIES} attempts"
    ) from last_error
