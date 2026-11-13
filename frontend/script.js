const API_URL = "http://127.0.0.1:8000";
const messageInput = document.getElementById("message");
const composer = document.getElementById("composer");
const submitButton = document.getElementById("submit");
const newChatButton = document.getElementById("new-chat");
const statusText = document.getElementById("status");
const chat = document.getElementById("chat");
const welcome = document.getElementById("welcome");
const chatTitle = document.getElementById("chat-title");
const historyList = document.getElementById("history-list");
const HISTORY_KEY = "assistantSearchHistory";
const HISTORY_RESET_KEY = "assistantSearchHistoryResetV3";

let searchHistory = [];
let currentSessionId = crypto.randomUUID();

function renderSearchHistory() {
  historyList.replaceChildren();

  searchHistory.forEach((query, index) => {
    const item = document.createElement("div");
    item.className = "history-entry";

    const queryButton = document.createElement("button");
    queryButton.className = "history-item";
    queryButton.type = "button";
    queryButton.textContent = query;
    queryButton.addEventListener("click", () => {
      messageInput.value = query;
      messageInput.dispatchEvent(new Event("input"));
      messageInput.focus();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "history-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete history item: ${query}`);
    deleteButton.addEventListener("click", () => {
      try {
        const updatedHistory = searchHistory.filter((_, itemIndex) => itemIndex !== index);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
        searchHistory = updatedHistory;
        renderSearchHistory();
      } catch (error) {
        console.error("Could not delete search history item.", error);
        statusText.textContent = "Could not delete this search from history.";
      }
    });

    item.append(queryButton, deleteButton);
    historyList.append(item);
  });
}

function initializeSearchHistory() {
  try {
    if (localStorage.getItem(HISTORY_RESET_KEY) !== "true") {
      localStorage.removeItem(HISTORY_KEY);
      localStorage.setItem(HISTORY_RESET_KEY, "true");
    }

    const savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(savedHistory) || !savedHistory.every((query) => typeof query === "string")) {
      throw new Error("Saved search history has an invalid format.");
    }

    searchHistory = savedHistory;
  } catch (error) {
    console.error("Could not load search history.", error);
    statusText.textContent = "Search history is unavailable in this browser.";
  }

  renderSearchHistory();
}

function addSearchToHistory(query) {
  searchHistory.unshift(query);
  renderSearchHistory();

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory));
  } catch (error) {
    console.error("Could not save search history.", error);
    statusText.textContent = "Could not save this search to history.";
  }
}

function addMessage(text, kind) {
  const message = document.createElement("div");
  message.className = `message message-${kind}`;
  message.textContent = text;
  chat.append(message);
  chat.scrollTop = chat.scrollHeight;
  return message;
}

function appendInlineMarkdown(parent, text) {
  const tokenPattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)]+\))/g;
  let previousIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index;
    parent.append(document.createTextNode(text.slice(previousIndex, index)));

    let element;
    if (token.startsWith("`")) {
      element = document.createElement("code");
      element.textContent = token.slice(1, -1);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      element = document.createElement("strong");
      appendInlineMarkdown(element, token.slice(2, -2));
    } else if (token.startsWith("~~")) {
      element = document.createElement("del");
      appendInlineMarkdown(element, token.slice(2, -2));
    } else if (token.startsWith("*") || token.startsWith("_")) {
      element = document.createElement("em");
      appendInlineMarkdown(element, token.slice(1, -1));
    } else {
      const linkParts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const label = linkParts[1];
      let url;
      try {
        url = new URL(linkParts[2], window.location.href);
      } catch {
        url = null;
      }

      if (url && ["http:", "https:", "mailto:"].includes(url.protocol)) {
        element = document.createElement("a");
        element.href = url.href;
        element.target = "_blank";
        element.rel = "noopener noreferrer";
        appendInlineMarkdown(element, label);
      } else {
        parent.append(document.createTextNode(label));
      }
    }

    if (element) parent.append(element);
    previousIndex = index + token.length;
  }

  parent.append(document.createTextNode(text.slice(previousIndex)));
}

function renderMarkdown(container, markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;

  const isBlockStart = (line) => (
    /^ {0,3}(#{1,6}\s|```|~~~|>\s?|[-*+]\s+|\d+[.)]\s+)/.test(line)
    || /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)
  );
  const isTableStart = (sourceLines, lineIndex) => (
    lineIndex + 1 < sourceLines.length
    && sourceLines[lineIndex].includes("|")
    && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(sourceLines[lineIndex + 1])
  );
  const splitTableRow = (line) => {
    const cells = [];
    let cell = "";
    let escaped = false;
    for (const character of line.trim().replace(/^\||\|$/g, "")) {
      if (character === "|" && !escaped) {
        cells.push(cell.trim());
        cell = "";
        continue;
      }
      if (character === "\\" && !escaped) {
        escaped = true;
      } else {
        escaped = false;
      }
      cell += character;
    }
    cells.push(cell.trim());
    return cells.map((value) => value.replace(/\\\|/g, "|"));
  };

  const appendBlocks = (target, quotedLines = null) => {
    const source = quotedLines || lines;
    let list = null;

    while (index < source.length) {
      const line = source[index];
      if (!line.trim()) {
        list = null;
        index += 1;
        continue;
      }

      const fence = line.match(/^ {0,3}(```+|~~~+)\s*([^\s]*)/);
      if (fence) {
        const codeLines = [];
        const closingFence = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
        index += 1;
        while (index < source.length && !closingFence.test(source[index])) {
          codeLines.push(source[index]);
          index += 1;
        }
        if (index < source.length) index += 1;
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        if (fence[2]) code.className = `language-${fence[2].replace(/[^\w-]/g, "")}`;
        code.textContent = codeLines.join("\n");
        pre.append(code);
        target.append(pre);
        list = null;
        continue;
      }

      const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        const element = document.createElement(`h${heading[1].length}`);
        appendInlineMarkdown(element, heading[2]);
        target.append(element);
        index += 1;
        list = null;
        continue;
      }

      if (/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)) {
        target.append(document.createElement("hr"));
        index += 1;
        list = null;
        continue;
      }

      if (isTableStart(source, index)) {
        const headers = splitTableRow(source[index]);
        const alignments = splitTableRow(source[index + 1]).map((cell) => (
          cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left"
        ));
        const table = document.createElement("table");
        const head = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headers.forEach((value, cellIndex) => {
          const cell = document.createElement("th");
          cell.style.textAlign = alignments[cellIndex] || "left";
          appendInlineMarkdown(cell, value);
          headerRow.append(cell);
        });
        head.append(headerRow);
        table.append(head);
        const body = document.createElement("tbody");
        index += 2;
        while (index < source.length && source[index].includes("|") && source[index].trim()) {
          const values = splitTableRow(source[index]);
          const row = document.createElement("tr");
          headers.forEach((_, cellIndex) => {
            const cell = document.createElement("td");
            cell.style.textAlign = alignments[cellIndex] || "left";
            appendInlineMarkdown(cell, values[cellIndex] || "");
            row.append(cell);
          });
          body.append(row);
          index += 1;
        }
        table.append(body);
        target.append(table);
        list = null;
        continue;
      }

      if (/^ {0,3}>\s?/.test(line)) {
        const quoteLines = [];
        while (index < source.length && /^ {0,3}>\s?/.test(source[index])) {
          quoteLines.push(source[index].replace(/^ {0,3}>\s?/, ""));
          index += 1;
        }
        const quote = document.createElement("blockquote");
        const priorIndex = index;
        index = 0;
        appendBlocks(quote, quoteLines);
        index = priorIndex;
        target.append(quote);
        list = null;
        continue;
      }

      const listItem = line.match(/^ {0,3}([-*+]|\d+[.)])\s+(.+)$/);
      if (listItem) {
        const ordered = /^\d/.test(listItem[1]);
        if (!list || list.tagName !== (ordered ? "OL" : "UL")) {
          list = document.createElement(ordered ? "ol" : "ul");
          if (ordered) list.start = Number.parseInt(listItem[1], 10);
          target.append(list);
        }
        const item = document.createElement("li");
        appendInlineMarkdown(item, listItem[2]);
        list.append(item);
        index += 1;
        continue;
      }

      const paragraphLines = [line.trim()];
      index += 1;
      while (index < source.length && source[index].trim() && !isBlockStart(source[index]) && !isTableStart(source, index)) {
        paragraphLines.push(source[index].trim());
        index += 1;
      }
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, paragraphLines.join(" "));
      target.append(paragraph);
      list = null;
    }
  };

  appendBlocks(container);
}

function addAssistantMessage(markdown) {
  const message = document.createElement("div");
  message.className = "message message-assistant";
  message.setAttribute("aria-label", "Assistant response");
  const content = document.createElement("div");
  content.className = "markdown-body";
  renderMarkdown(content, markdown);
  message.append(content);
  chat.append(message);
  chat.scrollTop = chat.scrollHeight;
  return message;
}

function getAssistantText(data) {
  if (typeof data.response_markdown === "string" && data.response_markdown.trim()) {
    return data.response_markdown.trim();
  }

  if (typeof data.summary === "string" && data.summary.trim()) {
    const intent = typeof data.intent === "string" ? `\n\nIntent: ${data.intent.replaceAll("_", " ")}` : "";
    return `${data.summary.trim()}${intent}`;
  }

  return "I received a response, but it did not include a message to display.";
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  newChatButton.disabled = isBusy;
  document.querySelectorAll(".suggestion").forEach((button) => {
    button.disabled = isBusy;
  });
  submitButton.setAttribute("aria-label", isBusy ? "Sending message" : "Send message");
}

initializeSearchHistory();

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.dataset.message || "";
    messageInput.dispatchEvent(new Event("input"));
    messageInput.focus();
  });
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 160)}px`;
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) {
    statusText.textContent = "Type a message before sending.";
    messageInput.focus();
    return;
  }

  addSearchToHistory(message);
  welcome.hidden = true;
  if (chatTitle.textContent === "New Chat") {
    chatTitle.textContent = message.length > 38 ? `${message.slice(0, 38)}…` : message;
  }
  addMessage(message, "user");
  messageInput.value = "";
  messageInput.style.height = "auto";
  statusText.textContent = "Thinking...";
  setBusy(true);

  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: currentSessionId }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
      const detail = typeof data.detail === "string"
        ? data.detail
        : "The request could not be completed. Please try again.";
      addMessage(detail, "error");
      statusText.textContent = `Request failed (${response.status}).`;
      return;
    }

    if (typeof data.session_id === "string") {
      currentSessionId = data.session_id;
    }
    addAssistantMessage(getAssistantText(data));
    statusText.textContent = "Reply received.";
  } catch (error) {
    addMessage(
      error instanceof Error
        ? `${error.message} Check that the FastAPI backend is running.`
        : "Could not connect. Check that the FastAPI backend is running.",
      "error",
    );
    statusText.textContent = "Unable to reach the assistant.";
  } finally {
    setBusy(false);
    messageInput.focus();
  }
});

newChatButton.addEventListener("click", () => {
  chat.querySelectorAll(".message").forEach((message) => message.remove());
  currentSessionId = crypto.randomUUID();
  welcome.hidden = false;
  chatTitle.textContent = "New Chat";
  messageInput.value = "";
  messageInput.style.height = "auto";
  statusText.textContent = "Press Enter to send · Shift + Enter for a new line";
  messageInput.focus();
});
