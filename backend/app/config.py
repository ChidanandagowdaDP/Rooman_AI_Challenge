"""
Centralized configuration. All environment-dependent values live here so the
rest of the app never touches os.environ directly.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    MODEL_NAME: str = os.getenv("MODEL_NAME", "claude-sonnet-4-6")
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "interview_ai.db")
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    MAX_LLM_RETRIES: int = int(os.getenv("MAX_LLM_RETRIES", "3"))
    ENV: str = os.getenv("ENV", "development")

    def validate(self) -> None:
        if not self.ANTHROPIC_API_KEY:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
            )


settings = Settings()
