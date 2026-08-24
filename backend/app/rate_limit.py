"""
In-process sliding-window rate limiting.

Limits are keyed per user (when a valid bearer token is presented) or per
client IP otherwise, and applied per scope: tighter for auth endpoints to
blunt credential stuffing, looser for the interview API where every answer
submission triggers LLM calls. State lives in memory — appropriate for a
single-process deployment; swap in Redis if this ever runs multi-process.
"""
import threading
import time
from collections import defaultdict, deque

from app import auth as auth_service
from app.config import settings


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_seconds: float) -> bool:
        """Record one hit; return True if the caller is still under the limit."""
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            cutoff = now - window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                return False
            bucket.append(now)
            return True

    def retry_after(self, key: str, window_seconds: float) -> int:
        """Seconds until the oldest recorded hit leaves the window (best effort)."""
        with self._lock:
            bucket = self._hits.get(key)
            if not bucket:
                return 1
            elapsed = time.monotonic() - bucket[0]
            return max(1, int(window_seconds - elapsed) + 1)


limiter = SlidingWindowLimiter()

_WINDOW_SECONDS = 60.0


def _client_key(request, scope: str) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        claims = auth_service.verify_token(auth_header.removeprefix("Bearer ").strip())
        if claims:
            return f"{scope}:user:{claims['sub']}"
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else "unknown"
    )
    return f"{scope}:ip:{ip}"


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after


def check_rate_limit(request, scope: str) -> None:
    """Raise RateLimitExceeded if this request exceeds its scope's allowance."""
    limit = (
        settings.RATE_LIMIT_AUTH_PER_MIN
        if scope == "auth"
        else settings.RATE_LIMIT_API_PER_MIN
    )
    key = _client_key(request, scope)
    if not limiter.allow(key, limit, _WINDOW_SECONDS):
        raise RateLimitExceeded(limiter.retry_after(key, _WINDOW_SECONDS))
