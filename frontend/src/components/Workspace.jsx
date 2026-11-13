import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import Icon from "./Icon.jsx";

const starterPrompts = [
  "Help me organize my priorities for today",
  "Explain a technical concept in simple terms",
  "Turn these notes into a concise summary",
];

const followUps = {
  order_tracking: [
    "What details should I have ready?",
    "Draft a message to customer support",
    "Summarize the next steps",
    "What should I check first?",
    "Make this easier to share",
  ],
  payment_issue: [
    "What information is safe to share?",
    "Draft a message to billing support",
    "Summarize the next steps",
    "What should I check first?",
    "Make this easier to share",
  ],
  general_question: [
    "Explain that with a practical example",
    "Summarize the key takeaways",
    "What should I explore next?",
    "Turn this into a checklist",
    "Make this easier to share",
  ],
  current_time: [
    "Convert that to another time zone",
    "Help me plan around that time",
    "Summarize this conversation",
    "What should I explore next?",
  ],
  greeting: [
    "Help me plan my day",
    "Explain a topic I'm learning",
    "Draft a concise email",
    "Summarize a block of notes",
  ],
  unknown: [
    "Can you clarify what you need?",
    "Give me a step-by-step answer",
    "Summarize the key takeaways",
    "Turn this into a checklist",
  ],
};

function sessionGroups(sessions, query) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today);
  week.setDate(week.getDate() - 7);
  const groups = [
    { title: "Today", items: [] },
    { title: "Yesterday", items: [] },
    { title: "Previous 7 Days", items: [] },
    { title: "Earlier", items: [] },
  ];

  for (const session of sessions) {
    const text = `${session.title || ""} ${session.preview || ""}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) continue;
    const date = new Date(session.updated_at);
    if (date >= today) groups[0].items.push(session);
    else if (date >= yesterday) groups[1].items.push(session);
    else if (date >= week) groups[2].items.push(session);
    else groups[3].items.push(session);
  }
  return groups.filter((group) => group.items.length > 0);
}

function timeAgo(value) {
  if (!value) return "Just now";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportConversation(messages, title, format) {
  if (!messages.length) return;
  const safeTitle = (title || "aura-conversation").replace(/[<>:"/\\|?*]+/g, "-").slice(0, 60);
  if (format === "json") {
    downloadFile(`${safeTitle}.json`, JSON.stringify({ title, messages }, null, 2), "application/json");
    return;
  }
  const markdown = `# ${title || "Aura AI conversation"}\n\n${messages
    .map((message) => `## ${message.role === "user" ? "You" : "Aura AI"}\n\n${message.content}`)
    .join("\n\n---\n\n")}\n`;
  downloadFile(`${safeTitle}.md`, markdown, "text/markdown;charset=utf-8");
}

function Message({ message, onCopy }) {
  const isUser = message.role === "user";
  return (
    <article className={`message-row ${isUser ? "user-row" : "assistant-row"}`}>
      {!isUser && <div className="message-avatar"><Icon name="spark" size={16} /></div>}
      <div className="message-content-wrap">
        <div className="message-author">{isUser ? "You" : "Aura AI"}<span>{timeAgo(message.created_at)}</span></div>
        <div className={`message-bubble ${isUser ? "user-bubble" : "assistant-bubble"} ${message.error ? "error-bubble" : ""}`}>
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {message.content || ""}
            </ReactMarkdown>
            {message.streaming && <span className="stream-caret" />}
          </div>
        </div>
        {!isUser && message.content && !message.error && (
          <button className="message-action" onClick={() => onCopy(message.content)}><Icon name="copy" size={14} /> Copy response</button>
        )}
      </div>
      {isUser && <div className="message-avatar user-message-avatar"><Icon name="user" size={16} /></div>}
    </article>
  );
}

function InsightRow({ label, value, tone = "" }) {
  return <div className="insight-row"><span>{label}</span><b className={tone}>{value}</b></div>;
}

export default function Workspace({
  sessions,
  selectedSessionId,
  selectedTitle,
  messages,
  loadingMessages,
  isBusy,
  metadata,
  collapsed,
  onToggleSidebar,
  onNewChat,
  onSelectSession,
  onSend,
  onOpenSettings,
  onNotify,
  backendState,
  onRetryBackend,
  incognito,
  onOpenArchives,
  onArchiveSession,
  onDeleteSession,
}) {
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [listening, setListening] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [insightsVisible, setInsightsVisible] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const fileInput = useRef(null);
  const textarea = useRef(null);
  const conversationScroll = useRef(null);
  const speechRecognition = useRef(null);
  const groups = useMemo(() => sessionGroups(sessions, query), [sessions, query]);
  const currentSuggestions = followUps[metadata?.intent] || followUps.general_question;
  const lastActive = messages.length ? timeAgo(messages[messages.length - 1].created_at) : "Ready for a new conversation";
  const tokenText = `${input} ${attachment?.content || ""}`.trim();
  const tokenEstimate = tokenText
    ? Math.max(1, Math.ceil(tokenText.split(/\s+/).length * 1.3))
    : metadata?.token_metadata?.estimated_input_tokens;

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 760px)").matches) {
      if (collapsed) onToggleSidebar();
      setMobileSidebarOpen((value) => !value);
    } else onToggleSidebar();
  }

  function toggleInsights() {
    if (window.matchMedia("(max-width: 920px)").matches) {
      setInsightsVisible(true);
      setInspectorOpen((value) => !value);
    } else {
      setInsightsVisible((value) => !value);
    }
  }

  useEffect(() => {
    const element = conversationScroll.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, isBusy]);

  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "auto";
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  function handleSubmit(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    const fullMessage = attachment
      ? `${text}\n\nAttached text file: ${attachment.name}\n\n${attachment.content}`
      : text;
    onSend(fullMessage.slice(0, 4900));
    setInput("");
    setAttachment(null);
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(txt|md|csv|json|log)$/i.test(file.name)) {
      onNotify("Choose a text, Markdown, CSV, JSON, or log file.");
      return;
    }
    if (file.size > 200000) {
      onNotify("That file is over 200 KB. Choose a smaller text file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, content: String(reader.result || "").slice(0, 3200) });
    reader.onerror = () => onNotify("The selected file could not be read.");
    reader.readAsText(file);
  }

  function toggleVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onNotify("Voice input is not supported by this browser. You can type your message instead.");
      return;
    }
    if (listening) {
      speechRecognition.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    speechRecognition.current = recognition;
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setInput((value) => `${value}${value ? " " : ""}${event.results[0][0].transcript}`);
    };
    recognition.onerror = () => onNotify("Voice input stopped. Please try again or type your message.");
    recognition.onend = () => {
      speechRecognition.current = null;
      setListening(false);
    };
    recognition.start();
    setListening(true);
  }

  function exportFile(format) {
    exportConversation(messages, selectedTitle, format);
    setExportOpen(false);
    if (messages.length) onNotify(`Conversation exported as ${format.toUpperCase()}.`);
    else onNotify("Start a conversation before exporting.");
  }

  return (
    <main className={`workspace ${collapsed ? "sidebar-collapsed" : ""} ${inspectorOpen ? "inspector-open" : ""} ${insightsVisible ? "" : "insights-hidden"}`}>
      <aside className={`history-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileSidebarOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-heading">
          {!collapsed && <span className="sidebar-label">Workspace</span>}
          <button className="icon-button sidebar-collapse" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={17} />
          </button>
        </div>
        <button className={`new-chat-button ${collapsed ? "icon-only" : ""}`} onClick={() => { onNewChat(); setMobileSidebarOpen(false); }} title="Start a new chat">
          <span className="new-chat-plus"><Icon name="plus" size={17} /></span>{!collapsed && <span>New chat</span>}
        </button>
        {!collapsed ? (
          <>
            <label className="history-search"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search past conversations..." aria-label="Search past conversations" />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={14} /></button>}</label>
            <div className="history-list">
              {incognito ? <div className="history-empty">Saved chats are hidden while incognito is on.</div> : groups.length ? groups.map((group) => (
                <section className="history-group" key={group.title}>
                  <h3>{group.title}</h3>
                  {group.items.map((session) => (
                    <div className="history-entry" key={session.session_id}>
                      <button className={`history-item ${selectedSessionId === session.session_id ? "selected" : ""}`} onClick={() => { onSelectSession(session); setMobileSidebarOpen(false); }}>
                        <span className="history-item-title">{session.title || "New conversation"}</span>
                        <span className="history-item-meta">{session.preview || "Open conversation"}<time>{timeAgo(session.updated_at)}</time></span>
                      </button>
                      <button className="history-archive" onClick={() => onArchiveSession(session)} aria-label={`Archive ${session.title || "conversation"}`} title="Archive chat"><Icon name="archive" size={15} /></button>
                      <button className="history-delete" onClick={() => onDeleteSession(session)} aria-label={`Delete ${session.title || "conversation"}`} title="Delete chat" disabled={isBusy && selectedSessionId === session.session_id}><Icon name="trash" size={15} /></button>
                    </div>
                  ))}
                </section>
              )) : <div className="history-empty">{query ? "No conversations match that search." : "Your conversations will appear here."}</div>}
            </div>
          </>
        ) : (
          <div className="collapsed-history" aria-label={`${sessions.length} saved conversations`}>
            {!incognito && sessions.slice(0, 5).map((session) => <button key={session.session_id} className={`collapsed-session ${selectedSessionId === session.session_id ? "selected" : ""}`} onClick={() => { onSelectSession(session); setMobileSidebarOpen(false); }} title={session.title}><Icon name="clock" size={17} /></button>)}
          </div>
        )}
        <button className={`archive-button ${collapsed ? "icon-only" : ""}`} onClick={onOpenArchives} title="View archived chats">
          <Icon name="archive" size={16} />{!collapsed && <span>Archived chats</span>}
        </button>
        <div className="sidebar-footer">
          <div className="profile-block">
            <span className="profile-avatar">V</span>
            {!collapsed && <span className="profile-info"><b>Workspace profile</b><small><i /> Online</small></span>}
          </div>
          <button className="icon-button settings-button" onClick={onOpenSettings} aria-label="Open settings" title="Settings"><Icon name="settings" size={18} /></button>
        </div>
      </aside>

      {mobileSidebarOpen && <button className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} aria-label="Close conversation history" />}
      <section className="chat-panel">
        <header className="chat-toolbar">
          <div className="chat-title-area">
            <button className="icon-button mobile-sidebar-toggle" onClick={() => { if (collapsed) onToggleSidebar(); setMobileSidebarOpen(true); }} aria-label="Toggle conversation history"><Icon name="menu" size={19} /></button>
            <div className="chat-title-group"><h1>{selectedTitle || "New conversation"}</h1><span><i className={`connection-dot ${backendState === "online" ? "online" : ""}`} />{backendState === "online" ? `Last active ${lastActive}` : "Backend not connected"}</span></div>
          </div>
          <div className="chat-toolbar-actions">
            <div className="dropdown-anchor">
              <button className={`model-select ${modelOpen ? "active" : ""}`} onClick={() => { setModelOpen((value) => !value); setExportOpen(false); }} aria-expanded={modelOpen}>
                <span className="model-spark"><Icon name="spark" size={14} /></span><span>Aura-v2 Turbo</span><Icon name="chevronDown" size={14} />
              </button>
              {modelOpen && <div className="dropdown-menu model-menu"><b>Model selection</b><button className="dropdown-item selected" onClick={() => setModelOpen(false)}><span><i className="model-dot" />Aura-v2 Turbo</span><Icon name="check" size={15} /></button><p>The model is managed by your backend configuration.</p><button className="dropdown-close" onClick={() => setModelOpen(false)}>Got it</button></div>}
            </div>
            <div className="dropdown-anchor">
              <button className="icon-button export-button" onClick={() => { setExportOpen((value) => !value); setModelOpen(false); }} aria-expanded={exportOpen} aria-label="Export conversation" title="Export conversation"><Icon name="download" size={17} /></button>
              {exportOpen && <div className="dropdown-menu export-menu"><b>Export conversation</b><button className="dropdown-item" onClick={() => exportFile("md")}><Icon name="file" size={15} /> Markdown (.md)</button><button className="dropdown-item" onClick={() => exportFile("json")}><Icon name="file" size={15} /> JSON (.json)</button></div>}
            </div>
            <button className="insights-toggle button button-outline" onClick={toggleInsights} aria-expanded={window.matchMedia("(max-width: 920px)").matches ? inspectorOpen : insightsVisible} aria-label="Toggle message insights">
              <Icon name="spark" size={15} /><span>Message insights</span>
            </button>
          </div>
        </header>

        <div className="conversation-scroll" ref={conversationScroll}>
          {loadingMessages ? <div className="conversation-loading"><span className="loading-spinner" /> Loading conversation...</div> : messages.length ? (
            <div className="message-list">{messages.map((message) => <Message key={message.id} message={message} onCopy={(value) => { navigator.clipboard?.writeText(value).then(() => onNotify("Response copied to clipboard.")).catch(() => onNotify("Could not access the clipboard.")); }} />)}</div>
          ) : (
            <div className="welcome-state">
              <div className="welcome-symbol"><Icon name="spark" size={26} /></div>
              <span className="welcome-kicker">Your AI workspace</span>
              <h2>What would you like to<br /><span>work through today?</span></h2>
              <p>Ask a question, explore an idea, or bring in notes to get started.</p>
              <div className="starter-grid">{starterPrompts.map((prompt) => <button key={prompt} onClick={() => onSend(prompt)}><span>{prompt}</span><Icon name="arrowUpRight" size={16} /></button>)}</div>
            </div>
          )}
          {isBusy && !messages.some((message) => message.streaming) && <div className="typing-indicator"><span className="message-avatar"><Icon name="spark" size={15} /></span><span><i /><i /><i /></span><small>Aura is thinking</small></div>}
        </div>

        <div className="composer-area">
          {attachment && <div className="attachment-preview"><Icon name="file" size={15} /><span>{attachment.name}</span><small>Text context attached</small><button onClick={() => setAttachment(null)} aria-label="Remove attachment"><Icon name="close" size={14} /></button></div>}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea ref={textarea} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleSubmit(event); } }} placeholder="Ask anything..." aria-label="Message Aura AI" rows={1} disabled={isBusy} />
            <div className="composer-controls">
              <div className="composer-tools">
                <input ref={fileInput} className="visually-hidden" type="file" accept=".txt,.md,.csv,.json,.log,text/plain,text/markdown,text/csv,application/json" onChange={handleFile} />
                <button type="button" className="icon-button composer-tool" onClick={() => fileInput.current?.click()} aria-label="Attach a text file" title="Attach a text file"><Icon name="paperclip" size={17} /></button>
                <button type="button" className={`icon-button composer-tool ${listening ? "listening" : ""}`} onClick={toggleVoice} aria-label={listening ? "Stop voice input" : "Start voice input"} title="Voice input"><Icon name="mic" size={17} /></button>
                <span className="composer-hint">Enter to send · Shift + Enter for a new line</span>
              </div>
              <button type="submit" className="send-button" disabled={!input.trim() || isBusy} aria-label={isBusy ? "Response in progress" : "Send message"} title="Send message"><Icon name={isBusy ? "spark" : "send"} size={17} /></button>
            </div>
          </form>
          <div className="composer-disclaimer"><span><Icon name="shield" size={13} /> Do not share passwords or sensitive account details.</span><span>{incognito ? "Not saved here · sent to AI provider" : tokenEstimate ? `~${tokenEstimate} input tokens` : "Private, persistent conversation history"}</span></div>
        </div>
      </section>

      <aside className={`insights-panel ${inspectorOpen ? "mobile-open" : ""}`}>
        <div className="insights-header"><div><span className="insights-kicker">Live analysis</span><h2>Message insights</h2></div><button className="icon-button mobile-inspector-close" onClick={() => setInspectorOpen(false)} aria-label="Close insights"><Icon name="close" size={17} /></button><span className="insights-live"><i /> Live</span></div>
        <div className="insight-card">
          <div className="insight-card-title"><span className="insight-icon"><Icon name="spark" size={16} /></span><div><b>Exchange overview</b><small>{metadata ? "Latest message analysis" : "Insights update with your message"}</small></div></div>
          <div className="insight-rows">
            <InsightRow label="Intent" value={metadata?.intent?.replaceAll("_", " ") || "Waiting for a message"} tone="intent-value" />
            <InsightRow label="Risk profile" value={metadata?.risk_profile ? `${metadata.risk_profile} risk` : "Not analyzed"} tone={metadata?.risk_profile === "low" ? "status-good" : metadata?.risk_profile === "high" ? "status-high" : ""} />
            <InsightRow label="Priority" value={metadata?.priority ? `${metadata.priority} priority` : "Not analyzed"} />
            <InsightRow label="Requires action" value={metadata ? (metadata.required_action ? "Yes" : "No") : "Not analyzed"} tone={metadata?.required_action ? "status-action" : ""} />
            <InsightRow label="Estimated input tokens" value={metadata?.token_metadata?.estimated_input_tokens ? `~${metadata.token_metadata.estimated_input_tokens} tokens` : tokenEstimate ? `~${tokenEstimate} tokens` : "Ready to estimate"} />
          </div>
          <div className="insight-footnote"><Icon name="shield" size={14} /> Token count is an estimate, not billed usage.</div>
          {metadata?.summary && <div className="insight-summary"><b>Message summary</b><p>{metadata.summary}</p></div>}
        </div>
        <div className="suggestions-section">
          <div className="suggestions-heading"><div><h3>Keep the conversation going</h3><p>Choose a suggested next step</p></div><span>{currentSuggestions.length}</span></div>
          <div className="suggestion-list">{currentSuggestions.map((suggestion) => <button key={suggestion} className="suggestion-chip" onClick={() => onSend(suggestion)} disabled={isBusy}><span>{suggestion}</span><Icon name="arrowUpRight" size={15} /></button>)}</div>
        </div>
        <div className="insights-bottom">
          <div className={`backend-status ${backendState === "online" ? "connected" : "disconnected"}`}><span className="status-indicator"><i /></span><div><b>{backendState === "online" ? "Backend connected" : backendState === "checking" ? "Checking connection" : "Backend unavailable"}</b><small>{backendState === "online" ? "Conversation history is saved" : "Connect FastAPI to chat and save"}</small></div>{backendState !== "online" && <button onClick={onRetryBackend} title="Retry connection"><Icon name="chevronRight" size={15} /></button>}</div>
          <p>AI responses can be inaccurate. Review important information.</p>
        </div>
      </aside>
    </main>
  );
}
