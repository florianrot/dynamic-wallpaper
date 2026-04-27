// AppShell — Support Bot + Bug Reporting
// Chat persistence (7 days), bug report from chat, category routing

const CHAT_STORAGE_KEY = "support_chats";
const CHAT_TTL_DAYS = 7;

if (typeof marked !== "undefined") {
  marked.setOptions({ breaks: true, gfm: true });
  marked.use({ renderer: { html: (token) => escapeHtml(typeof token === "string" ? token : token.text || "") } });
}

let supportView = "home";
let supportMessages = [];
let supportStreaming = false;
let supportBotReplies = 0;
let supportChatId = null;

function openSupport(view) {
  supportView = view || "home";
  if (view !== "ask") {
    supportMessages = [];
    supportChatId = null;
    supportBotReplies = 0;
  }
  supportStreaming = false;
  renderSupportView();
  document.querySelector(".support-overlay").classList.add("open");
}

function closeSupport() {
  document.querySelector(".support-overlay").classList.remove("open");
  if (supportMessages.length > 0 && supportChatId) {
    saveChatSession(supportChatId, supportMessages);
  }
}

// ── Chat Persistence ──

function getSavedChats() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const chats = JSON.parse(raw);
    const cutoff = Date.now() - CHAT_TTL_DAYS * 24 * 60 * 60 * 1000;
    return chats.filter((c) => c.updatedAt > cutoff);
  } catch { return []; }
}

function saveChatSession(id, messages) {
  if (messages.length === 0) return;
  const chats = getSavedChats().filter((c) => c.id !== id);
  const preview = messages.find((m) => m.role === "user")?.content?.slice(0, 60) || "Chat";
  chats.unshift({ id, messages, preview, updatedAt: Date.now() });
  if (chats.length > 10) chats.length = 10;
  try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats)); } catch {}
}

function loadChatSession(id) {
  const chat = getSavedChats().find((c) => c.id === id);
  return chat ? chat.messages : [];
}

function generateChatId() {
  return "chat_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

// ── Render Views ──

function renderSupportView() {
  const content = document.getElementById("support_content");
  if (!content) return;

  if (supportView === "ask") {
    content.innerHTML = renderChatView();
    const input = content.querySelector(".support-chat__input");
    if (input) setTimeout(() => input.focus(), 50);
  } else if (supportView === "ask-picker") {
    content.innerHTML = renderChatPicker();
  } else if (supportView === "bug") {
    content.innerHTML = renderBugForm();
  } else if (supportView === "issues") {
    content.innerHTML = renderKnownIssues();
    loadKnownIssues();
  } else {
    content.innerHTML = renderHomeView();
  }
}

function renderHomeView() {
  return `
    <div class="support-cards">
      <button class="support-card" onclick="onAskQuestion()">
        <svg class="support-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <div class="support-card__title">${t("support.ask")}</div>
        <div class="support-card__hint">${t("support.ask_hint")}</div>
      </button>
      <button class="support-card" onclick="supportView='bug';renderSupportView()">
        <svg class="support-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="support-card__title">${t("support.bug")}</div>
        <div class="support-card__hint">${t("support.bug_hint")}</div>
      </button>
      <button class="support-card" onclick="supportView='issues';renderSupportView()">
        <svg class="support-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <div class="support-card__title">${t("support.known")}</div>
        <div class="support-card__hint">${t("support.known_hint")}</div>
      </button>
    </div>`;
}

function onAskQuestion() {
  const saved = getSavedChats();
  if (saved.length > 0) {
    supportView = "ask-picker";
    renderSupportView();
  } else {
    startNewChat();
  }
}

function startNewChat() {
  supportMessages = [];
  supportChatId = generateChatId();
  supportBotReplies = 0;
  supportView = "ask";
  renderSupportView();
}

function resumeChat(id) {
  supportMessages = loadChatSession(id);
  supportChatId = id;
  supportBotReplies = supportMessages.filter((m) => m.role === "assistant").length;
  supportView = "ask";
  renderSupportView();
  scrollChatBottom();
}

// ── Chat Picker ──

function renderChatPicker() {
  const saved = getSavedChats();
  const chatList = saved.map((c) => {
    const ago = formatTimeAgo(c.updatedAt);
    return `<button class="support-chat-item" onclick="resumeChat('${c.id}')">
      <div class="support-chat-item__preview">${escapeHtml(c.preview)}</div>
      <div class="support-chat-item__time">${ago}</div>
    </button>`;
  }).join("");

  return `
    <div class="support-picker">
      <button class="support-back" onclick="supportView='home';renderSupportView()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        ${t("support.back")}
      </button>
      <button class="btn btn--primary" onclick="startNewChat()" style="width:100%;margin-bottom:16px">${t("support.new_conversation")}</button>
      <div class="support-picker__label">${t("support.recent")}</div>
      ${chatList}
    </div>`;
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("support.just_now");
  if (mins < 60) return t("support.mins_ago", { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("support.hours_ago", { hrs });
  const days = Math.floor(hrs / 24);
  return t("support.days_ago", { days });
}

// ── Chat View ──

function renderChatView() {
  let msgs = "";
  for (const m of supportMessages) {
    const isUser = m.role === "user";
    const content = isUser
      ? escapeHtml(m.content)
      : (typeof marked !== "undefined" ? marked.parse(m.content) : escapeHtml(m.content));
    const msgCls = isUser ? "chat__msg--user" : "chat__msg--assistant";
    const avatar = isUser ? t("support.you") : t("support.ai");
    msgs += `<div class="chat__msg ${msgCls}">
      <div class="chat__msg-avatar">${avatar}</div>
      <div class="chat__msg-body">
        <div class="chat__msg-bubble">${content}</div>
      </div>
    </div>`;

    if (!isUser && m.content.toLowerCase().includes("bug report")) {
      msgs += `<button class="support-inline-action" onclick="openBugFromChat()">${t("support.open_bug_form")}</button>`;
    }
  }
  if (supportStreaming) {
    msgs += `<div class="chat__typing">
      <div class="chat__msg-avatar" style="width:28px;height:28px;border-radius:50%;background:var(--surface-strong);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--text-secondary)">${t("support.ai")}</div>
      <div class="chat__typing-dots"><span class="chat__typing-dot"></span><span class="chat__typing-dot"></span><span class="chat__typing-dot"></span></div>
    </div>`;
  }

  return `
    <div class="support-chat">
      <button class="support-back" onclick="saveChatAndGoBack()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        ${t("support.back")}
      </button>
      <div class="support-chat__messages" id="support_messages">
        ${msgs || `<div class="support-chat__welcome">${t("support.welcome")}</div>`}
      </div>
      <div class="support-chat__inputbar">
        <input class="support-chat__input" placeholder="${t("support.placeholder")}" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();onSupportSend()}">
        <button class="btn btn--primary btn--sm" onclick="onSupportSend()">${t("support.send")}</button>
      </div>
    </div>`;
}

function saveChatAndGoBack() {
  if (supportMessages.length > 0 && supportChatId) {
    saveChatSession(supportChatId, supportMessages);
  }
  supportView = "home";
  renderSupportView();
}

function openBugFromChat() {
  if (supportMessages.length > 0 && supportChatId) {
    saveChatSession(supportChatId, supportMessages);
  }
  supportView = "bug";
  renderSupportView();
  const desc = document.getElementById("bug_description");
  if (desc) {
    const userMsgs = supportMessages.filter((m) => m.role === "user").map((m) => m.content);
    desc.value = userMsgs.join("\n\n");
  }
}

async function onSupportSend() {
  const input = document.querySelector(".support-chat__input");
  if (!input) return;
  const text = input.value.trim();
  if (!text || supportStreaming) return;

  supportMessages.push({ role: "user", content: text });
  input.value = "";
  supportStreaming = true;
  renderSupportView();
  scrollChatBottom();

  try {
    const msgPayload = supportMessages.map((m) => ({ role: m.role, content: m.content }));
    const result = await api.support_chat(msgPayload);

    if (result && result.content) {
      supportMessages.push({ role: "assistant", content: result.content });
      supportBotReplies++;
    } else {
      supportMessages.push({ role: "assistant", content: t("support.error") });
    }
  } catch (e) {
    supportMessages.push({ role: "assistant", content: t("support.connection_error") });
  }

  supportStreaming = false;
  if (supportChatId) saveChatSession(supportChatId, supportMessages);
  renderSupportView();
  scrollChatBottom();
}

function scrollChatBottom() {
  const el = document.getElementById("support_messages");
  if (el) setTimeout(() => el.scrollTop = el.scrollHeight, 50);
}

// ── Bug Report Form ──

function renderBugForm() {
  return `
    <div class="support-bug">
      <button class="support-back" onclick="supportView='home';renderSupportView()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        ${t("support.back")}
      </button>
      <div class="support-bug__title">${t("support.bug_title")}</div>

      <div class="field">
        <label class="field__label">${t("support.bug_description")}</label>
        <textarea id="bug_description" class="support-bug__textarea" rows="4" placeholder="${t("support.bug_description_placeholder")}"></textarea>
      </div>

      <div class="field">
        <label class="field__label">${t("support.bug_severity")}</label>
        <div class="radio-group">
          <label class="radio"><input type="radio" name="bug_severity" value="low"><span class="radio__dot"></span><span class="radio__title">${t("support.bug_low")}</span><span class="radio__hint">${t("support.bug_low_hint")}</span></label>
          <label class="radio"><input type="radio" name="bug_severity" value="medium" checked><span class="radio__dot"></span><span class="radio__title">${t("support.bug_medium")}</span><span class="radio__hint">${t("support.bug_medium_hint")}</span></label>
          <label class="radio"><input type="radio" name="bug_severity" value="high"><span class="radio__dot"></span><span class="radio__title">${t("support.bug_high")}</span><span class="radio__hint">${t("support.bug_high_hint")}</span></label>
        </div>
      </div>

      <div class="field">
        <label class="field__label">${t("support.bug_diagnostics")}</label>
        <div class="field__hint">${t("support.bug_diagnostics_hint")}</div>
        <label class="toggle"><input type="checkbox" id="diag_system"><span class="toggle__box"><svg class="toggle__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span><span class="toggle__label">${t("support.bug_system_info")}<div class="toggle__hint">${t("support.bug_system_info_hint")}</div></span></label>
        <label class="toggle"><input type="checkbox" id="diag_logs"><span class="toggle__box"><svg class="toggle__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span><span class="toggle__label">${t("support.bug_logs")}<div class="toggle__hint">${t("support.bug_logs_hint")}</div></span></label>
        <label class="toggle"><input type="checkbox" id="diag_actions"><span class="toggle__box"><svg class="toggle__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span><span class="toggle__label">${t("support.bug_actions")}<div class="toggle__hint">${t("support.bug_actions_hint")}</div></span></label>
      </div>

      <div class="support-bug__actions">
        <button class="btn btn--ghost btn--sm" onclick="onReviewDiagnostics()">${t("support.bug_review")}</button>
        <button class="btn btn--primary" onclick="onSubmitBug()">${t("support.bug_submit")}</button>
      </div>
    </div>`;
}

async function onReviewDiagnostics() {
  const diag = await collectDiagnostics();
  const desc = document.getElementById("bug_description")?.value || "";
  const severity = document.querySelector('input[name="bug_severity"]:checked')?.value || "medium";

  const payload = { description: desc, severity, diagnostics: diag };
  const pre = document.createElement("pre");
  pre.style.cssText = "max-height:400px;overflow:auto;font-size:12px;padding:16px;background:var(--surface);border-radius:var(--radius-sm);color:var(--text-secondary);white-space:pre-wrap;word-break:break-all";
  pre.textContent = JSON.stringify(payload, null, 2);

  const modal = document.createElement("div");
  modal.className = "support-review-modal";
  modal.innerHTML = `<div class="support-review-backdrop" onclick="this.parentElement.remove()"></div><div class="support-review-card"><div style="font-weight:600;margin-bottom:12px;color:var(--text)">${t("support.data_to_send")}</div></div>`;
  modal.querySelector(".support-review-card").appendChild(pre);
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn--ghost btn--sm";
  closeBtn.textContent = t("common.close");
  closeBtn.style.marginTop = "12px";
  closeBtn.onclick = () => modal.remove();
  modal.querySelector(".support-review-card").appendChild(closeBtn);
  document.body.appendChild(modal);
}

async function collectDiagnostics() {
  const includeSystem = document.getElementById("diag_system")?.checked || false;
  const includeLogs = document.getElementById("diag_logs")?.checked || false;
  const includeActions = document.getElementById("diag_actions")?.checked || false;
  if (!includeSystem && !includeLogs && !includeActions) return {};
  return await api.get_diagnostics(includeSystem, includeLogs, includeActions);
}

async function onSubmitBug() {
  const desc = document.getElementById("bug_description")?.value?.trim();
  if (!desc) { showToast(t("support.bug_describe"), "error"); return; }

  const severity = document.querySelector('input[name="bug_severity"]:checked')?.value || "medium";
  const diag = await collectDiagnostics();

  try {
    const result = await api.submit_bug_report(null, desc, severity, diag);
    if (result.error) {
      showToast(t("support.bug_failed", { error: result.error }), "error");
    } else {
      showToast(t("support.bug_submitted"), "success");
      closeSupport();
    }
  } catch (e) {
    showToast(t("billing.connection_error"), "error");
  }
}

// ── Known Issues ──

function renderKnownIssues() {
  return `
    <div class="support-issues">
      <button class="support-back" onclick="supportView='home';renderSupportView()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        ${t("support.back")}
      </button>
      <div id="known_issues_list" class="support-issues__list">
        <div class="support-issues__loading">${t("support.issues_loading")}</div>
      </div>
    </div>`;
}

async function loadKnownIssues() {
  const container = document.getElementById("known_issues_list");
  if (!container) return;
  try {
    const issues = await api.get_known_issues();
    if (!issues || issues.length === 0) {
      container.innerHTML = `<div class="support-issues__empty">${t("support.issues_empty")}</div>`;
      return;
    }
    container.innerHTML = issues.map((i) => `
      <div class="support-issue-card">
        <div class="support-issue-card__title">${escapeHtml(i.title)}</div>
        <div class="support-issue-card__desc">${escapeHtml(i.description || "")}</div>
        ${i.status ? `<span class="billing-badge billing-badge--${i.status === "resolved" ? "active" : "warning"}">${i.status}</span>` : ""}
      </div>`).join("");
  } catch (e) {
    container.innerHTML = `<div class="support-issues__empty">${t("support.issues_error")}</div>`;
  }
}

// ── Helpers ──

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
