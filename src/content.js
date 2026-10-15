(() => {
  if (window.__chatEchoLoaded) return;
  window.__chatEchoLoaded = true;

  const DEFAULTS = { enabled: false, rate: 1, pitch: 1, voiceName: "" };
  const STABILITY_MS = 1100;
  let settings = { ...DEFAULTS };

  const assistantSelector = '[data-message-author-role="assistant"]';

  function getTurns() {
    const specific = [...document.querySelectorAll(assistantSelector)];
    if (specific.length) return specific;

    // ChatGPT has changed the outer message markup over time. Prefer message
    // containers that still expose an assistant role somewhere below them.
    const conversationTurns = [...document.querySelectorAll('[data-testid^="conversation-turn-"], article')];
    const roleMarked = conversationTurns.filter((turn) =>
      turn.getAttribute("data-message-author-role") === "assistant"
      || turn.querySelector('[data-message-author-role="assistant"]')
    );
    if (roleMarked.length) return roleMarked;

    // Current layouts commonly keep assistant answer bodies as `.markdown`
    // even when the role attribute is only present on a wrapper we cannot see.
    const markdown = [...document.querySelectorAll([
      "main .markdown", "[role=main] .markdown", "[data-testid^=conversation-turn-] .markdown",
      "main [class*=MarkdownRoot]", "[class*=MarkdownRoot]",
      "main [class*=prose]", "[role=main] [class*=prose]",
      "main [class*=assistant]", "[role=main] [class*=assistant]"
    ].join(", "))]
      .filter((node) => !node.querySelector(".markdown"));
    if (markdown.length) return markdown;

    return [];
  }

  function cloneReadableContent(turn) {
    const clone = turn.cloneNode(true);
    clone.querySelectorAll([
      "button", "[role=button]", "[data-testid*=copy]", "[data-testid*=vote]",
      "[data-testid*=action]", "nav", "svg", "textarea", "input", "pre"
    ].join(",")).forEach((node) => node.remove());
    return clone.innerText || clone.textContent || "";
  }

  function speakText(rawText, { force = false } = {}) {
    const text = ChatEchoCleaner.cleanForSpeech(rawText);
    if (!text) return Promise.resolve({ state: "error", error: "没有提取到可朗读的文本。" });
    if (!force && !settings.enabled) return Promise.resolve({ state: "idle", error: "自动朗读尚未开启。" });
    return chrome.runtime.sendMessage({
      type: "CHAT_ECHO_TTS_SPEAK",
      text,
      settings: { rate: settings.rate, pitch: settings.pitch, voiceName: settings.voiceName }
    }).catch((error) => ({ state: "error", error: error?.message || "无法连接语音引擎。" }));
  }

  function isGenerating() {
    return Boolean(document.querySelector(
      'button[data-testid="stop-button"], button[aria-label*="Stop"], button[aria-label*="停止"]'
    ));
  }

  function inspectLatestTurn() {
    if (!settings.enabled) return;
    const turns = getTurns();
    const latest = turns.at(-1);
    if (!latest) return;
    const text = cloneReadableContent(latest).trim();
    if (!text) return;
    completionTracker.observe(latest, text, isGenerating);
  }

  const completionTracker = new ChatEchoReplyCompletionTracker({
    delay: STABILITY_MS,
    onComplete: (text, element) => {
      if (!settings.enabled || getTurns().at(-1) !== element) return;
      const finalText = cloneReadableContent(element).trim();
      if (finalText === text) speakText(finalText);
      else completionTracker.observe(element, finalText, isGenerating);
    }
  });

  async function replayLatest() {
    const latest = getTurns().at(-1);
    if (!latest) {
      const turns = document.querySelectorAll('[data-testid^="conversation-turn-"], article').length;
      const counts = {
        main: document.querySelectorAll("main").length,
        roleMain: document.querySelectorAll('[role="main"]').length,
        testid: document.querySelectorAll("[data-testid]").length,
        messageTestid: document.querySelectorAll('[data-testid*="message"], [data-testid*="conversation"]').length,
        markdown: document.querySelectorAll(".markdown").length,
        prose: document.querySelectorAll('[class*=prose]').length,
        paragraphs: document.querySelectorAll("main p, [role=main] p").length,
        bodyText: (document.body?.innerText || "").length
      };
      const structure = [...document.querySelectorAll("main p, [role=main] p")].slice(-3).map((paragraph) => {
        const path = [];
        let node = paragraph;
        for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
          const tag = (node.tagName || "?").toLowerCase();
          const classes = typeof node.className === "string" ? node.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
          const testid = node.getAttribute?.("data-testid");
          const role = node.getAttribute?.("data-message-author-role") || node.getAttribute?.("role");
          path.push(`${tag}${classes ? `.${classes}` : ""}${testid ? `[testid=${testid}]` : ""}${role ? `[role=${role}]` : ""}`);
        }
        return path.join(" ← ");
      }).join(" | ");
      return {
        ok: false,
        error: `未识别到回复节点（对话块${turns}、main${counts.main}、role-main${counts.roleMain}、testid${counts.testid}、消息标记${counts.messageTestid}、markdown${counts.markdown}、prose${counts.prose}、段落${counts.paragraphs}、页面文字${counts.bodyText}字）。结构：${structure || "未找到段落"}`
      };
    }
    const text = cloneReadableContent(latest).trim();
    if (!text) return { ok: false, error: "找到了最新消息，但没有提取到可朗读文字。" };
    const result = await speakText(text, { force: true });
    return { ok: result?.state !== "error", chars: text.length, state: result?.state, error: result?.error || "" };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "CHAT_ECHO_COMMAND") {
      if (message.command === "replay") {
        replayLatest().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message || "重播失败。" }));
        return true;
      } else {
        chrome.runtime.sendMessage({ type: "CHAT_ECHO_TTS_COMMAND", command: message.command })
          .then(sendResponse)
          .catch((error) => sendResponse({ ok: false, error: error.message }));
      }
      return true;
    }
    if (message.type === "CHAT_ECHO_SETTINGS") {
      settings = { ...settings, ...message.settings };
      if (!settings.enabled) chrome.runtime.sendMessage({ type: "CHAT_ECHO_TTS_COMMAND", command: "stop" }).catch(() => {});
      sendResponse({ ok: true });
      return true;
    }
  });

  chrome.storage.local.get(DEFAULTS).then((stored) => { settings = { ...DEFAULTS, ...stored }; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
    if (!settings.enabled) chrome.runtime.sendMessage({ type: "CHAT_ECHO_TTS_COMMAND", command: "stop" }).catch(() => {});
  });

  const observer = new MutationObserver(inspectLatestTurn);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.setTimeout(inspectLatestTurn, 1500);
})();
