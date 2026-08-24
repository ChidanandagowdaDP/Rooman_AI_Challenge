"""
Centralized configuration. All environment-dependent values live here so the
rest of the app never touches os.environ directly.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Any OpenAI-compatible server works here, e.g.
    #   Ollama:    http://localhost:11434/v1
    #   vLLM:      http://localhost:8000/v1
    #   LM Studio: http://localhost:1234/v1
    #   Groq:      https://api.groq.com/openai/v1
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    # Local servers ignore this value, but the OpenAI client requires a
    # non-empty string. Set a real key only when pointing at a hosted provider.
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "not-needed-for-local")
    MODEL_NAME: str = os.getenv("MODEL_NAME", "qwen2.5:7b")
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "interview_ai.db")
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    MAX_LLM_RETRIES: int = int(os.getenv("MAX_LLM_RETRIES", "3"))
    ENV: str = os.getenv("ENV", "development")
    # Signs auth tokens. Generate a stable random value for real deployments.
    SECRET_KEY: str = os.getenv("SECRET_KEY", os.urandom(32).hex())

    def validate(self) -> None:
        if not self.LLM_BASE_URL:
            raise RuntimeError(
                "LLM_BASE_URL is not set. Copy .env.example to .env and point it "
                "at your OpenAI-compatible server (e.g. Ollama at "
                "http://localhost:11434/v1)."
            )


settings = Settings()
