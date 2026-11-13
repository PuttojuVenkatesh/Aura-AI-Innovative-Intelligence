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

## Full first-time setup

The commands below assume Windows PowerShell. Run them from the `backend` directory unless a step says otherwise.

### 1. Check Python and create the environment

```powershell
python --version
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The command prompt should show that the virtual environment is active. If PowerShell blocks `Activate.ps1`, run this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then activate the environment again. The dependencies include FastAPI/Uvicorn, Groq, Instructor, Pydantic, dotenv, token estimation, and the PostgreSQL driver/pool. `pytest` and `httpx` are also included for local tests.

### 2. Create and edit `.env`

```powershell
copy .env.example .env
notepad .env
```

Replace the Groq key placeholder with a valid key. A local SQLite setup can look like:

```env
GROQ_API_KEY=your_real_groq_key
GROQ_MODEL=openai/gpt-oss-120b
DATABASE_BACKEND=sqlite
SQLITE_PATH=data/chat.db
ARCHIVE_RETENTION_DAYS=30
```

`GROQ_MODEL` must name a model available to the supplied key. It is read at backend startup, so restart Uvicorn after changing the value.

For Neon, set `DATABASE_BACKEND=postgres` and `DATABASE_URL` to the connection string from the intended Neon project/branch. Preserve the connection string's SSL query parameters. If `DATABASE_BACKEND=sqlite` is explicitly present, SQLite remains selected even when `DATABASE_URL` is also set. Never put a real key or connection string in this README or commit the `.env` file.

### 3. Start the server and verify it

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Uvicorn's reload option restarts the process after Python code changes. The FastAPI startup lifespan initializes the selected database and purges expired archives. If startup cannot connect to PostgreSQL, inspect the error printed in this terminal.

Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) to send sample requests interactively. `/health` returns a simple API status response; it does not make an LLM request or independently test the database.

## Request and result schemas

`IngestionRequest` is validated before analysis:

| Field | Rules |
|---|---|
| `message` | Required, trimmed, 1–5,000 characters |
| `session_id` | Optional, 1–100 characters |
| `incognito` | Optional boolean; defaults to `false` |
| `history` | Optional list of at most 12 user/assistant messages for Incognito context |

The model's structured analysis is checked against these values:

| Field | Valid values or meaning |
|---|---|
| `intent` | `greeting`, `order_tracking`, `payment_issue`, `current_time`, `general_question`, `unknown` |
| `risk_profile` | `low`, `medium`, `high`, `unknown` |
| `priority` | `low`, `medium`, `high` |
| `required_action` | Whether an external service or additional follow-up is needed |
| `summary` | Short description of the user's message |
| `token_metadata` | Approximate local input-token estimate and explanatory note |

`AssistantResult` extends the analysis with a `session_id` and `response_markdown`. The estimate is informational and may differ from token counts reported by the model provider.

## Try the endpoints

Create a regular conversation through the complete-response endpoint:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/analyze `
  -ContentType "application/json" `
  -Body '{"message":"I need help understanding my payment status."}'
```

The result includes a session ID. To continue the same saved conversation, pass that ID in the next request:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/analyze `
  -ContentType "application/json" `
  -Body '{"message":"What should I check next?","session_id":"paste-session-id-here"}'
```

List active chats or load an individual chat:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/conversations
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/conversations/paste-session-id-here/messages
```

The React app uses `/api/analyze/stream` instead of `/api/analyze`. Its event stream is formatted as server-sent events, with one JSON object in each `data:` field:

```text
data: {"type":"metadata","session_id":"...","metadata":{"intent":"general_question",...}}

data: {"type":"token","content":"Here is"}

data: {"type":"token","content":" a concise answer."}

data: {"type":"done","session_id":"..."}
```

An error during generation is sent as an `error` event. A streaming exchange is saved only after generation completes; Incognito requests are never saved by this app.

## How the backend is organized

### `app/config.py`

Loads `backend/.env`, resolves the SQLite path relative to the backend directory, selects the database backend, and caps archive retention at 30 days. Environment variables are loaded once when the application starts.

### `app/schemas/ingestion.py` and `app/schemas/assistant.py`

Define allowed request and response data. Pydantic rejects invalid fields and invalid intent/risk/priority values. `AssistantResult` adds the session identifier and generated Markdown to the structured analysis.

### `app/services/llm_services.py`

Builds a Groq client and uses Instructor's JSON mode to request an `IngestionResult`. The classifier prompt describes the intent and risk categories. It does not call an order, payment, or time service.

### `app/services/response_service.py`

Combines the checked analysis, current message, and recent history into a second model request. The non-streaming function returns a complete answer; the streaming function yields answer fragments while generation is in progress.

### `app/services/database_service.py`

Owns SQLite/PostgreSQL connection handling, schema initialization, chat history, conversation listing, and archive/restore/purge functions. SQL parameters are bound through the database driver rather than interpolated into query strings.

### `app/utils/token_counter.py`

Provides a local token estimate for the input text. It is not a provider billing counter.

### `app/main.py`

Defines the FastAPI application, startup lifespan, CORS middleware, health route, analysis routes, conversation routes, and SSE formatting. `/docs` is provided automatically by FastAPI.

## Database layout and lifecycle

The application initializes these tables:

| Table | Stored data |
|---|---|
| `conversations` | Session ID, title, created/updated timestamps, and optional archive timestamp |
| `messages` | Conversation ID, `user`/`assistant` role, content, timestamp, and assistant analysis metadata |

Regular exchanges are stored after the response is generated. The most recent 12 messages (six user/assistant exchanges) are used as model context. Incognito mode keeps its context in the browser and sends the supplied history with each request; it bypasses database reads and writes for the exchange.

Archived conversations are hidden from the active list. `ARCHIVE_RETENTION_DAYS` defaults to 30 and cannot be configured above 30. Expired records are purged at startup and when `/api/conversations/archived` is requested.

To confirm the tables in Neon, open the SQL Editor for the same branch and database used in `DATABASE_URL`:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('conversations', 'messages');
```

For SQLite, the default database file is `data/chat.db` relative to the backend folder. It is local data and should not be committed.

## API behavior and status codes

| Status | Meaning |
|---|---|
| `200` | Request completed |
| `404` | Conversation was missing, already archived, or not archived for a restore |
| `422` | Invalid request fields, blank message, or message outside the allowed length |
| `500` | A generated response could not be saved |
| `502` | Analysis or response generation failed |

The streaming endpoint may return HTTP `200` and then report a generation failure using an SSE `error` event, because generation runs after the stream has started.

## Running tests

The tests use temporary SQLite files and replace model calls with test doubles. They verify persistence, API responses, streaming, archive/restore/expiry, and that Incognito requests are not saved.

```powershell
python -m pytest -q
```

No live Groq call is needed to run the test suite. Make sure the virtual environment is active and run the command from `backend`.

## Troubleshooting guide

### Neon tables do not appear

1. Check `DATABASE_BACKEND=postgres` in `backend\.env`.
2. Confirm `DATABASE_URL` is the Neon string for the branch and database being inspected.
3. Keep the SSL options from Neon and ensure the password is URL-encoded if it contains reserved characters.
4. Stop and restart Uvicorn. Table creation happens during application startup.
5. Read the backend terminal for a connection or authentication error, then query `information_schema.tables` in that same Neon branch.

### `GROQ_API_KEY` missing or invalid

Check that the file is named `.env` inside `backend`, the value is valid, and Uvicorn was restarted after editing it. Do not print or share the key when troubleshooting.

### `502` from `/api/analyze`

The API hides provider details from the response. Check the backend console and verify the configured model is available to your Groq key, the key is active, and the network/provider is reachable.

### Frontend reports that FastAPI is offline

Start Uvicorn on port 8000 and open `/health`. The Vite proxy in the frontend points to `http://127.0.0.1:8000`.

### Port 8000 is already occupied

Stop the other backend process with `Ctrl+C` in its terminal. Then run the Uvicorn command again.

## Limitations

- Each normal request makes two sequential model calls, which contributes to response latency.
- There are no user accounts or per-user conversation permissions. Anyone who can reach the API may access stored conversations.
- CORS is permissive for local development and must be restricted before public deployment.
- The assistant does not perform transactions or query external business systems.
- No production deployment manifest is included in this repository.
