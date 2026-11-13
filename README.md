# Aura AI

Aura AI is a full-stack AI chat workspace. The React frontend sends messages to a FastAPI backend, which classifies each message, generates a streamed response with Groq, and stores regular conversations in SQLite or PostgreSQL.

## How a message flows

```text
Browser (React + Vite, 127.0.0.1:5173)
        │  /api/analyze/stream
        ▼
FastAPI (127.0.0.1:8000)
  1. Validate the message
  2. Classify intent, risk, priority, and action requirement with Groq
  3. Load recent conversation context (unless Incognito is on)
  4. Stream a Markdown answer from Groq
  5. Save the exchange (unless Incognito is on)
        │
        ▼
SQLite (local) or PostgreSQL/Neon
```

The classifier uses Instructor and Pydantic to validate the structured analysis before it is used to generate the answer. The assistant does not connect to order, billing, or live-information systems; it can explain next steps but does not perform those actions.

## Features

- Streamed Markdown answers and saved conversation history.
- Message insights for intent, risk profile, priority, required action, token estimate, and summary.
- Searchable conversation list, archive/restore controls, and export to Markdown or JSON.
- Incognito mode: chats are not saved by this app; the messages are still sent to the configured AI provider.
- Light/dark themes, with a charcoal incognito appearance.
- Archived conversations are retained for no more than 30 days.

## Requirements

- Python 3.10 or newer.
- Node.js compatible with Vite 7 (Node.js 20.19+ or 22.12+).
- A Groq API key and internet access for model requests.

## Run locally (Windows PowerShell)

Use two terminals from the project root.

### 1. Set up the backend (once)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
notepad .env
```

Set `GROQ_API_KEY` in `backend\.env`. SQLite is the local default. To use Neon/PostgreSQL, set both `DATABASE_BACKEND=postgres` and `DATABASE_URL` to your Neon connection string. The backend creates its tables when it starts.

Start the backend in Terminal 1:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Set up and start the frontend

In Terminal 2, from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api` and `/health` to the backend on port 8000. Stop either server with `Ctrl+C`.

The backend also exposes [FastAPI's interactive API docs](http://127.0.0.1:8000/docs) and a health endpoint at [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health).

## Database configuration

The backend defaults to SQLite at `backend/data/chat.db`. To use Neon, update `backend\.env`:

```env
DATABASE_BACKEND=postgres
DATABASE_URL=your-Neon-connection-string
```

Use the connection string provided by Neon, including its SSL settings. Restart the backend after changing `.env`. Do not commit `.env`; it is excluded by `.gitignore`. See [backend/README.md](backend/README.md) for all settings and database details.

## API overview

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Check that the backend is running |
| `POST` | `/api/analyze` | Analyze a message and return a complete answer |
| `POST` | `/api/analyze/stream` | Analyze a message and stream the answer |
| `GET` | `/api/conversations` | List active conversations |
| `GET` | `/api/conversations/{session_id}/messages` | Load a conversation |
| `POST` | `/api/conversations/{session_id}/archive` | Archive a conversation |
| `POST` | `/api/conversations/{session_id}/restore` | Restore an archived conversation |
| `GET` | `/api/conversations/archived` | List archived conversations and their expiry dates |

For endpoint behavior and request examples, see [backend/README.md](backend/README.md#api).

## Tests and production build

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m pytest -q
```

Build the frontend:

```powershell
cd frontend
npm run build
npm run preview
```

## Project layout

```text
backend/   FastAPI API, Groq services, schemas, database, and tests
frontend/  React + Vite application
README.md  Project overview and local setup
```

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for the application flow and component-level details.

## Security notes

Keep API keys and database credentials in the local `.env` file or a deployment provider's secret settings; never put real credentials in source files or README examples. The current backend is a local-development app: it has no user authentication and its CORS configuration is permissive, so restrict access and configure CORS before exposing it publicly.
