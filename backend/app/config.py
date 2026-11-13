
import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BACKEND_DIR / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DATABASE_BACKEND = os.getenv(
    "DATABASE_BACKEND",
    "postgres" if DATABASE_URL else "sqlite",
).strip().lower()
if DATABASE_BACKEND not in {"sqlite", "postgres"}:
    raise ValueError("DATABASE_BACKEND must be 'sqlite' or 'postgres'.")

sqlite_path = Path(os.getenv("SQLITE_PATH", str(BACKEND_DIR / "data" / "chat.db")))
SQLITE_PATH = sqlite_path if sqlite_path.is_absolute() else BACKEND_DIR / sqlite_path
ARCHIVE_RETENTION_DAYS = min(30, int(os.getenv("ARCHIVE_RETENTION_DAYS", "30")))
