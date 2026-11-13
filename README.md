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

## Complete first-time setup

The quick start above assumes Python, Node.js, and npm are already installed. Use this walkthrough if you are setting up Aura AI on a new Windows computer.

### Step 1: Verify prerequisites

Open PowerShell and check the installed versions:

```powershell
python --version
node --version
npm --version
```

Use Python 3.10 or newer. Vite 7 requires a supported Node.js release (20.19+ or 22.12+). If a command is not recognized, install the corresponding runtime and open a new PowerShell window.

### Step 2: Install and configure the backend

From the Aura AI project root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
copy .env.example .env
notepad .env
```

In the editor, replace the `GROQ_API_KEY` placeholder with a valid key from your Groq account. Keep the key private. `GROQ_MODEL` selects the model the backend requests. The example file selects SQLite for local use.

If PowerShell says script execution is disabled when activating the environment, run the following once, then activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Step 3: Choose a database

**Local SQLite (default):** leave `DATABASE_BACKEND=sqlite`. The application creates `backend/data/chat.db` and its tables when the API starts.

**Neon/PostgreSQL:** replace the placeholder `DATABASE_URL` with the connection string copied from your Neon project and set:

```env
DATABASE_BACKEND=postgres
DATABASE_URL=your-Neon-connection-string
```

Keep the SSL query parameters included by Neon. If `DATABASE_BACKEND=sqlite` is explicitly set, that choice takes precedence even when a URL is present. The PostgreSQL tables are initialized during backend startup. Restart the backend after any `.env` changes.

### Step 4: Start and check the backend

With PowerShell still in `backend` and the virtual environment active:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Keep this terminal open. Open the following URLs to check that the server responds:

| URL | Result |
|---|---|
| [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) | Backend running status |
| [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Interactive FastAPI endpoints |

`/health` only reports application status; it is not a provider/model latency check. The app creates database tables during startup, so a failed database connection should be diagnosed from the backend terminal output.

### Step 5: Start the frontend

Open a second PowerShell terminal, go to the project root, and run:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173), choose **Get started**, and send a message. The frontend requires the backend to be running. Use `Ctrl+C` in each terminal to stop its server.

## Conversation and insight details

For each normal chat message, the backend makes two model requests:

1. **Classification:** Groq returns structured intent and risk analysis. Instructor requests JSON output and Pydantic validates it.
2. **Response:** Groq uses the validated result, current message, and up to 12 recent stored messages to generate an answer. The streamed endpoint sends answer fragments as server-sent events.

The categories are `greeting`, `order_tracking`, `payment_issue`, `current_time`, `general_question`, and `unknown`. Risk can be `low`, `medium`, `high`, or `unknown`; priority can be `low`, `medium`, or `high`. The `required_action` field indicates whether an external service or a follow-up would be needed. No external order/payment tools are connected.

The **Message insights** panel shows the latest analysis, summary, and an estimated input-token count. Token counts are local estimates and are not Groq billing data.

## API examples

The frontend uses the streaming endpoint. To try the complete, non-streaming endpoint from PowerShell while the backend is running:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/analyze `
  -ContentType "application/json" `
  -Body '{"message":"Can you explain this issue?"}'
```

The response includes the analysis fields, a `session_id`, and `response_markdown`. Send the returned session ID with later messages to continue that saved conversation.

To inspect saved conversations:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/conversations
```

The API request and response shapes, including streaming events, archives, and Incognito history, are documented in [backend/README.md](backend/README.md#api).

## Troubleshooting

| Symptom | Likely cause and next step |
|---|---|
| “FastAPI is not reachable” in the UI | Start the backend in a second terminal and confirm `/health` responds on port 8000. |
| Backend startup fails after choosing Neon | Check that `DATABASE_BACKEND=postgres`, the Neon URL belongs to the intended branch/database, and SSL parameters are present. Do not paste credentials into chat or logs. |
| Neon shows no tables | Confirm the backend actually started with PostgreSQL configuration. Table initialization runs when the FastAPI application starts. |
| `GROQ_API_KEY` is missing | Check the filename is `backend\.env`, not `.env.txt`, and restart Uvicorn after saving. |
| An analyze request returns `502` | Check the backend terminal, Groq key/model configuration, network access, and provider limits. |
| Browser opens but the chat cannot send messages | Confirm both servers are running and that Vite uses port 5173 while FastAPI uses port 8000. |
| Port 5173 or 8000 is already in use | Stop the old process from its terminal with `Ctrl+C`, then start it again. |
| `npm` or `python` is not recognized | Install the runtime and reopen PowerShell so the updated PATH is loaded. |

## Development checks

Run backend tests from the `backend` folder with its virtual environment active:

```powershell
python -m pytest -q
```

Run a frontend production build from `frontend`:

```powershell
npm run build
npm run preview
```

The project does not include provider-specific deployment manifests. The frontend reads the public FastAPI base URL from `VITE_API_URL`; set it in the frontend host (for example, Vercel) to the backend host (for example, Render), then rebuild/redeploy the frontend. The backend host must receive its own Groq/database environment variables. Configure CORS and access controls before exposing the API publicly. See [frontend/README.md](frontend/README.md#backend-connection-and-production-hosting) for deployment steps.
