import React, { useCallback, useEffect, useState } from "react";
import Icon from "./components/Icon.jsx";
import LandingPage from "./components/LandingPage.jsx";
import Workspace from "./components/Workspace.jsx";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function errorText(response, fallback) {
  return response.json().then((data) => {
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    if (detail?.error) return detail.error;
    return fallback;
  }).catch(() => fallback);
}

function createId() {
  return globalThis.crypto?.randomUUID?.()
    || `aura-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Dialog({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="app-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><Icon name="close" size={18} /></button>
        <span className="modal-mark"><Icon name="spark" size={20} /></span>
        <h2 id="modal-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("landing");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("aura-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [messages, setMessages] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [backendState, setBackendState] = useState("checking");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [incognito, setIncognito] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedSessions, setArchivedSessions] = useState([]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("aura-theme", theme);
    } catch {
      // The selected theme still applies for this page load if storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.incognito = String(incognito);
  }, [incognito]);

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setToast(""), 3200);
  }, []);

  const checkBackend = useCallback(async () => {
    setBackendState("checking");
    try {
      const response = await fetch(apiUrl("/health"));
      if (!response.ok) throw new Error("Health check failed");
      setBackendState("online");
      return true;
    } catch {
      setBackendState("offline");
      return false;
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    const response = await fetch(apiUrl("/api/conversations"));
    if (!response.ok) throw new Error(await errorText(response, "Could not load conversation history."));
    const data = await response.json();
    const items = Array.isArray(data) ? data : data.conversations || [];
    setSessions(items);
    return items;
  }, []);

  const openArchives = useCallback(async () => {
    try {
      const response = await fetch(apiUrl("/api/conversations/archived"));
      if (!response.ok) throw new Error(await errorText(response, "Could not load archived conversations."));
      setArchivedSessions(await response.json());
      setArchiveOpen(true);
    } catch (error) {
      notify(error.message || "Could not load archived conversations.");
    }
  }, [notify]);

  const archiveSession = useCallback(async (session) => {
    try {
      const response = await fetch(apiUrl(`/api/conversations/${encodeURIComponent(session.session_id)}/archive`), { method: "POST" });
      if (!response.ok) throw new Error(await errorText(response, "Could not archive this conversation."));
      await refreshSessions();
      if (selectedSessionId === session.session_id) {
        setSelectedSessionId(null);
        setSelectedTitle("");
        setMessages([]);
        setMetadata(null);
      }
      notify("Conversation moved to Archived chats.");
    } catch (error) {
      notify(error.message || "Could not archive this conversation.");
    }
  }, [notify, refreshSessions, selectedSessionId]);

  const restoreArchivedSession = useCallback(async (session) => {
    try {
      const response = await fetch(apiUrl(`/api/conversations/${encodeURIComponent(session.session_id)}/restore`), { method: "POST" });
      if (!response.ok) throw new Error(await errorText(response, "Could not restore this conversation."));
      setArchivedSessions((items) => items.filter((item) => item.session_id !== session.session_id));
      await refreshSessions();
      notify("Conversation restored.");
    } catch (error) {
      notify(error.message || "Could not restore this conversation.");
    }
  }, [notify, refreshSessions]);

  useEffect(() => {
    checkBackend();
    refreshSessions().catch(() => setSessions([]));
  }, [checkBackend, refreshSessions]);

  const openSession = useCallback(async (session) => {
    setSelectedSessionId(session.session_id);
    setSelectedTitle(session.title || "Conversation");
    setMetadata(null);
    setLoadingMessages(true);
    try {
      const response = await fetch(apiUrl(`/api/conversations/${encodeURIComponent(session.session_id)}/messages`));
      if (!response.ok) throw new Error(await errorText(response, "Could not load this conversation."));
      const data = await response.json();
      const loaded = data.map((message, index) => ({
        ...message,
        id: `${session.session_id}-${index}`,
      }));
      setMessages(loaded);
      const lastMetadata = [...loaded].reverse().find((message) => message.role === "assistant" && message.metadata)?.metadata;
      setMetadata(lastMetadata || null);
    } catch (error) {
      notify(error.message || "Could not load this conversation.");
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [notify]);

  const enterWorkspace = useCallback(async () => {
    setPage("workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (incognito) return;
    try {
      const items = await refreshSessions();
      if (!selectedSessionId && items.length) await openSession(items[0]);
    } catch (error) {
      notify(error.message || "Conversation history is unavailable.");
    }
  }, [incognito, notify, openSession, refreshSessions, selectedSessionId]);

  const navigateTo = useCallback((section) => {
    setPage("landing");
    window.setTimeout(() => {
      if (section === "home") window.scrollTo({ top: 0, behavior: "smooth" });
      else document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }, []);

  const startNewChat = useCallback(() => {
    setSelectedSessionId(null);
    setSelectedTitle("");
    setMessages([]);
    setMetadata(null);
    setLoadingMessages(false);
    setPage("workspace");
  }, []);

  const sendMessage = useCallback(async (rawMessage) => {
    const message = rawMessage.trim();
    if (!message || isBusy) return;
    if (backendState !== "online" && !(await checkBackend())) {
      notify("FastAPI is not reachable. Start the backend, then retry.");
      return;
    }

    const sessionId = selectedSessionId || createId();
    const now = new Date().toISOString();
    const assistantId = createId();
    let assistantAdded = false;
    let answer = "";
    let streamError = "";
    setPage("workspace");
    setSelectedSessionId(sessionId);
    setSelectedTitle((title) => title || message.slice(0, 58));
    setMetadata(null);
    if (!incognito) {
      setSessions((current) => [
        {
          session_id: sessionId,
          title: selectedTitle || message.slice(0, 58),
          updated_at: now,
          preview: message,
        },
        ...current.filter((session) => session.session_id !== sessionId),
      ]);
    }
    setMessages((current) => [...current, {
      id: createId(),
      role: "user",
      content: message,
      created_at: now,
    }]);
    setIsBusy(true);

    const addAssistant = (content, extra = {}) => {
      if (!assistantAdded) {
        assistantAdded = true;
        setMessages((current) => [...current, {
          id: assistantId,
          role: "assistant",
          content,
          created_at: new Date().toISOString(),
          ...extra,
        }]);
      } else {
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content, ...extra } : item));
      }
    };

    try {
      const response = await fetch(apiUrl("/api/analyze/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          message,
          session_id: sessionId,
          incognito,
          history: incognito
            ? messages.filter((item) => item.role === "user" || item.role === "assistant")
              .slice(-12)
              .map(({ role, content }) => ({ role, content }))
            : [],
        }),
      });
      if (!response.ok) throw new Error(await errorText(response, "The assistant request failed."));
      if (!response.body) throw new Error("Streaming is unavailable in this browser.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      const handleBlock = (block) => {
        const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!data) return;
        const event = JSON.parse(data);
        if (event.type === "metadata") {
          setMetadata(event.metadata);
          addAssistant("", { metadata: event.metadata, streaming: true });
        } else if (event.type === "token") {
          answer += event.content || "";
          addAssistant(answer, { streaming: true });
        } else if (event.type === "error") {
          streamError = event.message || "The assistant could not complete this response.";
        } else if (event.type === "done") {
          finished = true;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          handleBlock(block);
          if (streamError) break;
        }
        if (streamError || done) break;
      }
      if (!streamError && buffer.trim()) handleBlock(buffer);
      if (streamError) {
        addAssistant(streamError, { streaming: false, error: true });
        notify(streamError);
        if (!incognito) refreshSessions().catch(() => {});
      } else if (!finished) {
        throw new Error("The connection ended before the response was complete. Please try again.");
      } else {
        addAssistant(answer, { streaming: false });
        if (!incognito) {
          const updatedSessions = await refreshSessions();
          const updated = updatedSessions.find((item) => item.session_id === sessionId);
          if (updated?.title) setSelectedTitle(updated.title);
        }
      }
    } catch (error) {
      const messageText = error.message || "The assistant could not complete this response.";
      addAssistant(messageText, { streaming: false, error: true });
      notify(messageText);
      checkBackend();
      if (!incognito) refreshSessions().catch(() => {});
    } finally {
      setIsBusy(false);
    }
  }, [backendState, checkBackend, incognito, isBusy, messages, notify, refreshSessions, selectedSessionId, selectedTitle]);

  function toggleIncognito() {
    setIncognito((active) => !active);
    setSelectedSessionId(null);
    setSelectedTitle("");
    setMessages([]);
    setMetadata(null);
    setLoadingMessages(false);
    notify(incognito
      ? "Incognito is off. New chats will be saved."
      : "Incognito is on. This app won't save the chat, but your messages are still sent to the AI provider.");
  }

  function showLogin() {
    setModal({
      title: "Welcome to Aura AI",
      body: (
        <>
          <p className="modal-copy">This workspace is running in local demo mode. Account sign-in is not configured for this application.</p>
          <div className="modal-note"><Icon name="shield" size={17} /> Your chats are saved by the connected backend.</div>
          <button className="button button-primary modal-primary" onClick={() => { setModal(null); enterWorkspace(); }}>Continue to workspace <Icon name="arrow" size={16} /></button>
        </>
      ),
    });
  }

  function showSettings() {
    setModal({
      title: "Workspace settings",
      body: (
        <>
          <p className="modal-copy">Personalize this workspace. Conversations are stored by the backend database.</p>
          <div className="settings-row"><span><b>Appearance</b><small>Choose a comfortable theme</small></span><button className="button button-outline settings-theme-button" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")}><Icon name={theme === "light" ? "moon" : "sun"} size={16} /> {theme === "light" ? "Dark mode" : "Light mode"}</button></div>
          <div className="settings-row"><span><b>API connection</b><small>{backendState === "online" ? "FastAPI is reachable" : "FastAPI is currently unavailable"}</small></span><span className={`settings-status ${backendState === "online" ? "status-online" : ""}`}><i />{backendState === "online" ? "Connected" : "Offline"}</span></div>
          <button className="button button-primary modal-primary" onClick={() => setModal(null)}>Done</button>
        </>
      ),
    });
  }

  function showLegal(topic) {
    const text = topic === "Privacy"
      ? "Conversation history is stored in the database configured for this application. Avoid sharing passwords, authentication codes, or sensitive account details."
      : topic === "Contact"
        ? "This local workspace does not include a support inbox. For help with this deployment, contact the person who configured the application."
        : "Aura AI is a focused chat workspace for thoughtful conversations, useful context, and clearer next steps.";
    setModal({ title: topic, body: <><p className="modal-copy">{text}</p><button className="button button-primary modal-primary" onClick={() => setModal(null)}>Close</button></> });
  }

  return (
    <div className="app-shell">
      <header className="global-header">
        <button className="brand-lockup" onClick={() => navigateTo("home")} aria-label="Aura AI home">
          <span className="brand-mark"><Icon name="spark" size={19} /></span><span>Aura <b>AI</b></span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={page === "landing" ? "active" : ""} onClick={() => navigateTo("home")}>Home</button>
          <button onClick={() => navigateTo("features")}>Features</button>
          <button onClick={() => navigateTo("how-it-works")}>How It Works</button>
        </nav>
        <div className="header-actions">
          <button className="theme-toggle" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}><Icon name={theme === "light" ? "moon" : "sun"} size={18} /></button>
          <button className="login-button" onClick={showLogin}>Log in</button>
          <button className={`button header-incognito ${incognito ? "active" : ""}`} onClick={toggleIncognito} aria-pressed={incognito} title={incognito ? "Turn off incognito mode" : "Turn on incognito mode"}>
            <Icon name="shield" size={15} /><span>{incognito ? "Incognito on" : "Incognito"}</span>
          </button>
          <button className="button button-primary header-cta" onClick={enterWorkspace}>Get started <Icon name="arrow" size={16} /></button>
        </div>
      </header>

      {page === "landing" ? (
        <LandingPage onGetStarted={enterWorkspace} onNavigate={navigateTo} onLegal={showLegal} />
      ) : (
        <Workspace
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          selectedTitle={selectedTitle}
          messages={messages}
          loadingMessages={loadingMessages}
          isBusy={isBusy}
          metadata={metadata}
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          onNewChat={startNewChat}
          onSelectSession={openSession}
          onSend={sendMessage}
          onOpenSettings={showSettings}
          onNotify={notify}
          backendState={backendState}
          onRetryBackend={checkBackend}
          incognito={incognito}
          onOpenArchives={openArchives}
          onArchiveSession={archiveSession}
        />
      )}

      {modal && <Dialog title={modal.title} onClose={() => setModal(null)}>{modal.body}</Dialog>}
      {archiveOpen && (
        <Dialog title="Archived chats" onClose={() => setArchiveOpen(false)}>
          <p className="modal-copy">Archived chats are automatically deleted after no more than 30 days.</p>
          <div className="archive-list">
            {archivedSessions.length ? archivedSessions.map((session) => (
              <div className="archive-entry" key={session.session_id}>
                <span><b>{session.title || "Conversation"}</b><small>Deleted after {new Date(session.delete_at).toLocaleDateString()}</small></span>
                <button className="button button-outline" onClick={() => restoreArchivedSession(session)}>Restore</button>
              </div>
            )) : <p className="archive-empty">No archived chats.</p>}
          </div>
        </Dialog>
      )}
      {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{toast}</div>}
    </div>
  );
}
