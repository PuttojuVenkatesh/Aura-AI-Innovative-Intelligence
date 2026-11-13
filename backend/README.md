# Aura AI Backend

The backend is a FastAPI service that validates each message, asks Groq to classify it, generates a response, and stores regular conversations in SQLite or PostgreSQL.

## Message flow

```text
POST /api/analyze/stream
  → Validate IngestionRequest
  → analyze_message() with Instructor/Pydantic
  → Load recent history, or use supplied browser history in Incognito mode
  → stream_response() from Groq
  → Save the exchange unless Incognito is enabled
```

Classification and response generation are separate Groq calls. The structured analysis includes intent, risk profile, priority, required action, summary, and an estimated input-token count. The assistant provides guidance; it does not look up orders, issue refunds, or retrieve live information.

## Setup (Windows PowerShell)

Run these commands from the `backend` folder:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
notepad .env
```

Add your real Groq API key to `.env`. The example file uses placeholders; do not commit the real `.env`.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | Yes | Authenticates model requests |
| `GROQ_MODEL` | No | Groq model identifier |
| `DATABASE_BACKEND` | No | `sqlite` or `postgres`; defaults to PostgreSQL when `DATABASE_URL` is set, otherwise SQLite |
| `DATABASE_URL` | For PostgreSQL | Neon or other PostgreSQL connection string |
| `SQLITE_PATH` | No | SQLite file path; defaults to `data/chat.db` relative to `backend` |
| `ARCHIVE_RETENTION_DAYS` | No | Archive retention; capped at 30 days |

For Neon, set both values:

```env
DATABASE_BACKEND=postgres
DATABASE_URL=your-Neon-connection-string
```

If `DATABASE_BACKEND=sqlite` is explicitly set, the app uses SQLite even if `DATABASE_URL` is present. Use the SSL-enabled connection string supplied by Neon. Database tables are initialized during backend startup.

## Run the API

From `backend`, with the virtual environment active:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Interactive API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

There is no `/` endpoint. Stop the server with `Ctrl+C`. Restart it after editing `.env`.

## API

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/health` | Returns a simple backend-running status |
| `POST` | `/api/analyze` | Returns analysis metadata and a complete Markdown answer |
| `POST` | `/api/analyze/stream` | Sends analysis and streams the Markdown answer as server-sent events |
| `GET` | `/api/conversations` | Lists active conversations |
| `GET` | `/api/conversations/{session_id}/messages` | Returns messages and their saved metadata |
| `POST` | `/api/conversations/{session_id}/archive` | Archives an active conversation |
| `POST` | `/api/conversations/{session_id}/restore` | Restores an archived conversation |
| `GET` | `/api/conversations/archived` | Lists archived conversations and their deletion dates |

### Analyze request

```json
{
  "message": "Can you help me understand this issue?",
  "session_id": "optional-existing-session-id"
}
```

`message` is required, trimmed, and limited to 5,000 characters. `session_id` is optional and limited to 100 characters. Analysis values are validated against the schemas in `app/schemas/ingestion.py`.

### Streaming response

`POST /api/analyze/stream` returns `text/event-stream`. Events use a JSON `data:` field:

- `metadata` includes the classifier output and session ID.
- `token` contains a streamed answer fragment.
- `done` signals that generation completed; the exchange is persisted in regular mode.
- `error` reports an error during streaming.

The exchange is stored only after the response completes.

### Incognito mode

Send `"incognito": true` to either analyze endpoint to prevent this app from saving the conversation. Prior context can be included as up to 12 `history` entries, each with a `user` or `assistant` role and message content. The conversation remains in browser memory only; messages are still sent to Groq.

```json
{
  "message": "What about the second option?",
  "incognito": true,
  "history": [
    { "role": "user", "content": "Compare these two options." },
    { "role": "assistant", "content": "Here is the comparison..." }
  ]
}
```

### Archive retention

Archived conversations are kept for at most 30 days. Expired archives are purged at startup and when the archived-conversations endpoint is requested. The archive response includes `archived_at` and `delete_at` values. Restore an archive before its expiry to return it to the active list.

## Database

The database service supports:

- **SQLite:** local default at `backend/data/chat.db`.
- **PostgreSQL:** selected with `DATABASE_BACKEND=postgres`; uses `DATABASE_URL` and a small connection pool.

Tables are created automatically when FastAPI starts. The schema contains `conversations` and `messages`; recent message history is limited to the last 12 messages (six exchanges) when sent to the LLM. Tests use a temporary SQLite database.

## Code map

```text
app/
├── main.py                    API routes and FastAPI startup
├── config.py                  Loads .env configuration
├── schemas/
│   ├── ingestion.py           Request and structured analysis schemas
│   └── assistant.py           Complete assistant response schema
├── services/
│   ├── llm_services.py        Groq classification
│   ├── response_service.py    Context-aware response generation/streaming
│   └── database_service.py    SQLite/PostgreSQL storage and archives
└── utils/
    └── token_counter.py       Local token estimate
tests/
└── test_database_service.py   API, storage, archive, and incognito tests
```

## Tests

With the backend virtual environment active:

```powershell
python -m pytest -q
```

The tests mock model calls; they do not require a Groq API key or make live LLM requests.

## Troubleshooting

| Symptom | Check |
|---|---|
| Startup uses SQLite instead of Neon | Set `DATABASE_BACKEND=postgres` in `backend\.env`; restart Uvicorn |
| PostgreSQL startup fails | Verify the Neon URL, password encoding, SSL parameters, branch, and database; keep the URL private |
| `GROQ_API_KEY` missing | Confirm the file is named `backend\.env` and contains the key |
| `502` from an analyze endpoint | Check the backend terminal, Groq key/model configuration, network, and provider limits |
| Port 8000 is occupied | Stop the existing backend with `Ctrl+C`, then restart it |

The API currently has no authentication and uses permissive local-development CORS settings. Do not expose it publicly without adding appropriate access controls and restricting CORS.
