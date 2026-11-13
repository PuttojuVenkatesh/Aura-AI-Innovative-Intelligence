# Aura AI Frontend

The frontend is the React + Vite application for Aura AI. It provides the landing page, saved-chat workspace, streaming chat interface, and message-insights panel. Vite forwards API requests to the local FastAPI backend.

## Run locally (Windows PowerShell)

You need Node.js compatible with Vite 7 (Node.js 20.19+ or 22.12+) and the backend running on port 8000.

From the `frontend` folder:

```powershell
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Stop Vite with `Ctrl+C`.

Run the backend separately; setup instructions are in [backend/README.md](../backend/README.md#setup-windows-powershell).

## How it connects

The frontend uses relative paths for `/api/...` and `/health`. In development, `vite.config.js` proxies those paths to `http://127.0.0.1:8000`. The FastAPI backend must be running for chat, history, and health status to work.

The chat sends requests to `POST /api/analyze/stream`. The backend first returns message-analysis metadata, then sends response fragments as server-sent events. The frontend displays those fragments as they arrive.

## Workspace features

| Feature | Location |
|---|---|
| Start a chat and browse saved conversations | Left sidebar |
| Search saved conversations | Search field in the sidebar |
| Archive a chat | Archive icon on a conversation |
| View/restore archived chats | **Archived chats** at the bottom of the sidebar |
| Message intent, risk, priority, action flag, token estimate, and summary | **Message insights** in the chat toolbar |
| Export conversation as Markdown or JSON | Export control in the chat toolbar |
| Voice input and text-file attachment | Composer controls |
| Light/dark appearance | Theme control in the header |
| Incognito mode | Header button beside **Get started** |

Incognito mode changes the UI to a charcoal, neutral theme and does not save chats to the app database. The current chat context is held in browser memory and sent to the configured AI provider to generate responses; it is not private from that provider.

## Project structure

```text
frontend/
├── index.html                 Vite page shell
├── vite.config.js             Dev server and backend proxy
├── package.json               Scripts and dependencies
└── src/
    ├── main.jsx               React entry point
    ├── App.jsx                App state, API calls, global header
    ├── styles.css             Shared styles and themes
    └── components/
        ├── LandingPage.jsx    Landing page
        ├── Workspace.jsx      Chat, sidebar, insights, composer
        └── Icon.jsx           Shared SVG icons
```

The older `script.js` and `style.css` files are not the Vite entry point; `index.html` loads `src/main.jsx`.

## Build and preview

```powershell
npm run build
npm run preview
```

The production build is written to `dist/`. The Vite development proxy is not included in production; production hosting must provide a backend URL and proxy/configuration appropriate to that host.

## Common issues

| Symptom | Fix |
|---|---|
| “FastAPI is not reachable” | Start the backend on `127.0.0.1:8000`; check `http://127.0.0.1:8000/health` |
| Port 5173 is occupied | Stop the other Vite process; `strictPort` is enabled |
| `npm` is not recognized | Install Node.js and open a new PowerShell terminal |
| Insights are not visible | Click **Message insights** at the top-right of the workspace |
| Frontend build fails | Confirm the Node.js version meets Vite 7 requirements, then run `npm install` |

## Complete first-time setup

The frontend depends on a running backend for the chat experience. If this is a fresh setup, prepare both sides before sending a message.

### 1. Check Node.js

Open PowerShell and run:

```powershell
node --version
npm --version
```

Use a Node.js release supported by Vite 7: version 20.19 or newer in the 20.x line, or version 22.12 or newer in the 22.x line.

### 2. Install frontend packages

From the project root:

```powershell
cd frontend
npm install
```

`npm install` reads `package.json` and `package-lock.json`. Run it once after cloning the project, or again after package dependencies change.

### 3. Start the backend first

In another PowerShell terminal:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend environment must already be created and configured with a Groq API key. See [the backend setup guide](../backend/README.md#full-first-time-setup). Confirm [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) responds before continuing.

### 4. Start Vite

In the terminal where you installed packages:

```powershell
npm run dev
```

Vite binds to `127.0.0.1:5173`. The server uses `strictPort`, so it fails rather than silently switching to a different port if 5173 is occupied. Stop the process with `Ctrl+C`.

### 5. Try a conversation

Open [http://127.0.0.1:5173](http://127.0.0.1:5173), click **Get started**, and submit a prompt. The left sidebar displays saved sessions. The assistant message streams into the conversation, and the analysis panel can show the latest intent, risk profile, priority, required-action flag, token estimate, and summary.

## What happens when you send a message

1. The composer trims the message and sends it to `POST /api/analyze/stream`.
2. During local development, Vite forwards the request to FastAPI on port 8000.
3. The backend first classifies the message. Once metadata arrives, the frontend updates the insight panel.
4. The backend streams answer fragments as SSE `token` events. The frontend appends them to the assistant message.
5. On a `done` event, a regular conversation is saved by the backend and the sidebar refreshes.

When Incognito is enabled, the browser sends recent in-memory messages as context, and the backend does not save that exchange. The actual message still reaches the configured AI provider.

## Using the workspace

### Conversation history

- **New chat** clears the selected conversation and starts a fresh session.
- Use the sidebar search to find a saved conversation by its title or latest preview.
- Select an entry to load its saved messages.
- Select the archive icon on a chat to move it to the archive.
- Open **Archived chats** at the bottom of the sidebar to restore an entry. Expired archives are removed after at most 30 days.

Incognito mode hides saved chats from the sidebar and starts a fresh in-memory conversation. Switching modes clears the currently displayed conversation so saved context is not accidentally continued in the other mode.

### Message insights

Click **Message insights** in the top-right chat toolbar to show or hide the panel. On narrow screens the panel opens as an overlay. It displays the latest backend analysis rather than independently evaluating the message in the browser. The token number is an estimate and is not billed usage.

### Composer, attachments, and voice

- Press **Enter** to send. Press **Shift+Enter** to add a line break.
- Text attachments support `.txt`, `.md`, `.csv`, `.json`, and `.log`; files larger than 200 KB are rejected. Only the beginning of the file content is included in the prompt.
- Voice input uses the browser's Speech Recognition API. It may not be available in every browser or operating system; type the message if the microphone control reports that voice input is unsupported.
- The displayed assistant response is Markdown rendered with a sanitizer. Export actions download the current conversation as Markdown or JSON.

### Appearance and local browser state

The light/dark theme preference is stored in browser local storage. Incognito mode applies a separate charcoal, neutral color theme; leaving Incognito returns to the selected regular theme. Incognito prevents app database persistence, but it does not prevent the AI provider from processing the prompt.

## Component map

| File | Responsibility |
|---|---|
| `src/main.jsx` | Creates the React root and imports global styles |
| `src/App.jsx` | Global page state, session loading, message streaming, archive actions, and header controls |
| `src/components/LandingPage.jsx` | Landing page and its navigation actions |
| `src/components/Workspace.jsx` | Chat workspace, session list, composer, message rendering, and insights panel |
| `src/components/Icon.jsx` | Shared SVG icon set |
| `src/styles.css` | Responsive layout, component styles, regular themes, and Incognito theme |
| `vite.config.js` | Local host/port settings and API/health proxy |

The Vite entry page is `index.html`, which loads `src/main.jsx`. The top-level `script.js` and `style.css` are legacy files and are not imported by the current React entry point.

## Scripts and outputs

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Create the optimized static bundle in `dist/` |
| `npm run preview` | Serve the built bundle locally for a production-style check |

`dist/` and `node_modules/` are generated locally and are excluded from Git. No frontend lint or test script is defined in `package.json`.

## Backend connection and production hosting

The development proxy forwards both `/api` and `/health` to `http://127.0.0.1:8000`. This is why the browser can use relative URLs during `npm run dev`. In production, the frontend uses `VITE_API_URL` as the base URL for all API and health requests.

The proxy only applies to the Vite development server. For a Vercel frontend and Render backend:

1. In Vercel, open the Aura AI project settings and add the environment variable `VITE_API_URL` with the Render backend's base URL, for example `https://your-service.onrender.com` (no trailing slash).
2. Apply it to the Production environment (and Preview too, if needed).
3. Redeploy the frontend so Vite bakes the variable into the production bundle.
4. Open `https://your-service.onrender.com/health` and confirm it returns HTTP 200.
5. Reload the Vercel site and check the browser's Network panel to confirm `/health` and `/api/...` requests go to the Render host.

This repository does not include Vercel or Render deployment manifests. Configure CORS and authentication on the backend before exposing it beyond a trusted environment. Do not put Groq or database credentials in frontend files; browser bundles are public. `VITE_API_URL` is a public service URL, not a secret.

## More troubleshooting

### Sidebar says the backend is offline

1. Make sure Uvicorn is still running in the backend terminal.
2. Open `http://127.0.0.1:8000/health`.
3. Check `frontend/vite.config.js` still proxies `/api` and `/health` to port 8000.
4. Refresh the browser page after restarting either server.

### The UI loads but sending a message fails

Check the backend terminal for Groq or database errors. A successful `/health` response means the API process is reachable; it does not prove that the configured Groq key or model is valid. The backend troubleshooting guide has provider and database checks.

### Port 5173 is busy

Close the other Vite process with `Ctrl+C`. Since `strictPort` is enabled, Vite will report an error rather than use another port.

### An attachment is rejected

Use a supported text extension and keep the file below 200 KB. This UI does not upload images or arbitrary binary documents.
