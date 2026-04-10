import { marked } from "marked";
import hljs from "highlight.js";
import DOMPurify from "dompurify";
import { ToolCard } from "./ToolCard";
import { ConfirmDialog } from "./ConfirmDialog";

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: (code: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
} as any);

// VS Code webview API
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};
const vscode = acquireVsCodeApi();

// DOM references
const app = document.getElementById("app")!;

// Inject styles
const style = document.createElement("style");
style.textContent = getStyles();
document.head.appendChild(style);

// Build layout
app.innerHTML = `
  <div id="chat-container">
    <div id="messages"></div>
    <div id="input-row">
      <textarea id="input" placeholder="Ask Nex Code..." rows="1"></textarea>
      <button id="send-btn" title="Send">&#9654;</button>
    </div>
  </div>
`;

const messagesEl = document.getElementById("messages")!;
const inputEl = document.getElementById("input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn")!;

// State
let currentMsgEl: HTMLDivElement | null = null;
let currentAccum = "";
let currentToolCards = new Map<string, ToolCard>();
let pendingConfirm: ConfirmDialog | null = null;

// Auto-resize textarea
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
});

// Send on Enter (Shift+Enter = newline)
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSend();
  }
});
sendBtn.addEventListener("click", doSend);

function doSend() {
  const text = inputEl.value.trim();
  if (!text) {
    return;
  }
  addUserBubble(text);
  vscode.postMessage({ type: "chat", text });
  inputEl.value = "";
  inputEl.style.height = "auto";
  setInputEnabled(false);

  // Start a new assistant message placeholder
  currentAccum = "";
  currentMsgEl = document.createElement("div");
  currentMsgEl.className = "message assistant streaming";
  messagesEl.appendChild(currentMsgEl);
  scrollToBottom();
}

function addUserBubble(text: string) {
  const el = document.createElement("div");
  el.className = "message user";
  el.textContent = text;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function setInputEnabled(enabled: boolean) {
  inputEl.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// IPC from extension
window.addEventListener("message", (event) => {
  const msg = event.data;
  handleEvent(msg);
});

function handleEvent(msg: any) {
  switch (msg.type) {
    case "ready":
      setInputEnabled(true);
      break;

    case "token":
      if (currentMsgEl) {
        currentAccum += msg.text;
        // LLM output is untrusted: prompt-injection payloads can hide raw HTML
        // (img onerror, iframe, object, etc.) inside markdown. Sanitize before
        // assigning to innerHTML — CSP nonce blocks <script> but not other vectors.
        const rendered = marked(currentAccum) as string;
        currentMsgEl.innerHTML = DOMPurify.sanitize(rendered, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: ["style", "iframe", "object", "embed", "form"],
          FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
        });
        scrollToBottom();
      }
      break;

    case "tool_start": {
      const card = new ToolCard(msg.tool, msg.args);
      currentToolCards.set(msg.tool + "-" + msg.id, card);
      messagesEl.appendChild(card.element);
      scrollToBottom();
      break;
    }

    case "tool_end": {
      const key = msg.tool + "-" + msg.id;
      const card = currentToolCards.get(key);
      if (card) {
        card.finish(msg.summary, msg.ok);
        currentToolCards.delete(key);
      }
      scrollToBottom();
      break;
    }

    case "confirm_request": {
      pendingConfirm = new ConfirmDialog(
        msg.question,
        msg.tool,
        msg.critical,
        (answer) => {
          vscode.postMessage({ type: "confirm", id: msg.id, answer });
          pendingConfirm = null;
        },
      );
      messagesEl.appendChild(pendingConfirm.element);
      scrollToBottom();
      break;
    }

    case "done":
      if (currentMsgEl) {
        currentMsgEl.classList.remove("streaming");
        currentMsgEl = null;
      }
      currentAccum = "";
      setInputEnabled(true);
      break;

    case "error":
      if (currentMsgEl) {
        currentMsgEl.classList.remove("streaming");
        currentMsgEl.classList.add("error");
        currentMsgEl.textContent = "\u26a0 " + msg.message;
        currentMsgEl = null;
      }
      setInputEnabled(true);
      break;

    case "crashed":
      addSystemMessage(
        '\u26a0 Agent process crashed. Use "Nex Code: Restart Agent" to reconnect.',
      );
      setInputEnabled(false);
      break;
  }
}

function addSystemMessage(text: string) {
  const el = document.createElement("div");
  el.className = "message system";
  el.textContent = text;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function getStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); }
    #chat-container { display: flex; flex-direction: column; height: 100vh; }
    #messages { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
    #input-row { display: flex; gap: 4px; padding: 8px; border-top: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border)); background: var(--vscode-sideBar-background); }
    #input { flex: 1; resize: none; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 3px; padding: 6px 8px; font-family: inherit; font-size: inherit; outline: none; min-height: 32px; }
    #input:focus { border-color: var(--vscode-focusBorder); }
    #send-btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; padding: 4px 10px; cursor: pointer; font-size: 14px; }
    #send-btn:hover { background: var(--vscode-button-hoverBackground); }
    #send-btn:disabled, #input:disabled { opacity: 0.5; cursor: not-allowed; }
    .message { padding: 8px 10px; border-radius: 6px; max-width: 100%; word-break: break-word; line-height: 1.5; }
    .message.user { background: var(--vscode-button-background); color: var(--vscode-button-foreground); align-self: flex-end; max-width: 85%; border-radius: 6px 6px 2px 6px; }
    .message.assistant { background: var(--vscode-editor-background); border: 1px solid var(--vscode-sideBar-border, transparent); }
    .message.assistant.streaming::after { content: '\u258b'; animation: blink 1s step-end infinite; }
    .message.error { background: var(--vscode-inputValidation-errorBackground, #5a1d1d); border: 1px solid var(--vscode-inputValidation-errorBorder, #f44); }
    .message.system { color: var(--vscode-descriptionForeground); font-style: italic; font-size: 0.9em; text-align: center; }
    .message pre { background: var(--vscode-textBlockQuote-background, rgba(0,0,0,0.2)); padding: 8px; border-radius: 4px; overflow-x: auto; margin: 6px 0; }
    .message code { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em; }
    .message p { margin: 4px 0; }
    .message ul, .message ol { margin: 4px 0 4px 20px; }
    @keyframes blink { 50% { opacity: 0; } }
    .tool-card { background: var(--vscode-editor-background); border: 1px solid var(--vscode-sideBar-border, rgba(128,128,128,0.3)); border-radius: 4px; overflow: hidden; font-size: 0.85em; }
    .tool-card-header { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: pointer; user-select: none; }
    .tool-card-header:hover { background: var(--vscode-list-hoverBackground); }
    .tool-card-icon { font-size: 1em; }
    .tool-card-name { font-weight: bold; color: var(--vscode-symbolIcon-functionForeground, #dcdcaa); flex: 1; }
    .tool-card-summary { color: var(--vscode-descriptionForeground); }
    .tool-card-summary.ok { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
    .tool-card-summary.fail { color: var(--vscode-terminal-ansiRed, #f44747); }
    .tool-card-chevron { color: var(--vscode-descriptionForeground); transition: transform 0.15s; }
    .tool-card.expanded .tool-card-chevron { transform: rotate(90deg); }
    .tool-card-body { display: none; padding: 6px 8px; background: var(--vscode-textBlockQuote-background, rgba(0,0,0,0.15)); font-family: var(--vscode-editor-font-family, monospace); white-space: pre-wrap; word-break: break-all; color: var(--vscode-descriptionForeground); max-height: 200px; overflow-y: auto; }
    .tool-card.expanded .tool-card-body { display: block; }
    .tool-card.running .tool-card-icon { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .confirm-card { background: var(--vscode-editorWidget-background, var(--vscode-editor-background)); border: 1px solid var(--vscode-focusBorder); border-radius: 6px; padding: 10px 12px; }
    .confirm-question { margin-bottom: 8px; color: var(--vscode-foreground); }
    .confirm-tool { font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
    .confirm-buttons { display: flex; gap: 8px; }
    .confirm-btn { padding: 4px 14px; border-radius: 3px; border: none; cursor: pointer; font-size: inherit; }
    .confirm-btn.yes { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .confirm-btn.yes:hover { background: var(--vscode-button-hoverBackground); }
    .confirm-btn.no { background: var(--vscode-button-secondaryBackground, rgba(128,128,128,0.2)); color: var(--vscode-button-secondaryForeground, var(--vscode-foreground)); }
    .confirm-btn.no:hover { background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.35)); }
    .confirm-card.critical { border-color: var(--vscode-inputValidation-warningBorder, #cca700); }
    .confirm-card.critical .confirm-question::before { content: '\u26a0 '; color: var(--vscode-inputValidation-warningBorder, #cca700); }
  `;
}
