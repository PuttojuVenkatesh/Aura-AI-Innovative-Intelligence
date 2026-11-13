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
