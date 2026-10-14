(() => {
  if (window.__chatEchoLoaded) return;
  window.__chatEchoLoaded = true;

  const DEFAULTS = { enabled: false, rate: 1, voiceURI: "" };
  const STABILITY_MS = 1100;
  const MAX_CHUNK_LENGTH = 1800;
  let settings = { ...DEFAULTS };
  let utterances = [];
  let state = "idle";

  const assistantSelector = '[data-message-author-role="assistant"]';

  function getTurns() {
    const specific = [...document.querySelectorAll(assistantSelector)];
    if (specific.length) return specific;
    return [...document.querySelectorAll("article")].filter((article) => {
      const label = `${article.getAttribute("data-testid") || ""} ${article.innerText || ""}`;
      return /assistant|ChatGPT/i.test(label.slice(0, 120));
    });
  }

  function cloneReadableContent(turn) {
    const clone = turn.cloneNode(true);
    clone.querySelectorAll([
      "button", "[role=button]", "[data-testid*=copy]", "[data-testid*=vote]",
      "[data-testid*=action]", "nav", "svg", "textarea", "input", "pre"
    ].join(",")).forEach((node) => node.remove());
    return clone.innerText || clone.textContent || "";
  }

  function splitText(text, maxLength = MAX_CHUNK_LENGTH) {
    const chunks = [];
    let rest = text.trim();
    while (rest.length > maxLength) {
      let cut = rest.lastIndexOf("\n", maxLength);
      if (cut < maxLength * 0.55) cut = rest.lastIndexOf("。", maxLength);
      if (cut < maxLength * 0.55) cut = rest.lastIndexOf("，", maxLength);
      if (cut < maxLength * 0.55) cut = maxLength;
      chunks.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) chunks.push(rest);
    return chunks;
  }

  function findSelectedVoice() {
    const voices = speechSynthesis.getVoices();
    return voices.find((voice) => voice.voiceURI === settings.voiceURI)
      || voices.find((voice) => /^zh/i.test(voice.lang))
      || null;
  }

  function announceState() {
    chrome.runtime.sendMessage({ type: "CHAT_ECHO_STATE", state }).catch(() => {});
  }

  function speakText(rawText) {
    const text = ChatEchoCleaner.cleanForSpeech(rawText);
    if (!text || !settings.enabled) return;
    speechSynthesis.cancel();
    utterances = splitText(text).map((chunk) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.rate = Math.min(2, Math.max(0.5, Number(settings.rate) || 1));
      const voice = findSelectedVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "zh-CN";
      }
      return utterance;
    });
    utterances.forEach((utterance, index) => {
      utterance.onstart = () => { state = "speaking"; announceState(); };
      utterance.onend = () => {
        if (index === utterances.length - 1) { state = "idle"; announceState(); }
      };
      utterance.onerror = () => { state = "idle"; announceState(); };
      speechSynthesis.speak(utterance);
    });
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

  function replayLatest() {
    const latest = getTurns().at(-1);
    if (latest) speakText(cloneReadableContent(latest));
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "CHAT_ECHO_COMMAND") {
      if (message.command === "pause") { speechSynthesis.pause(); state = "paused"; }
      if (message.command === "resume") { speechSynthesis.resume(); state = "speaking"; }
      if (message.command === "stop") { speechSynthesis.cancel(); state = "idle"; }
      if (message.command === "replay") replayLatest();
      announceState();
      sendResponse({ ok: true, state });
      return true;
    }
    if (message.type === "CHAT_ECHO_SETTINGS") {
      settings = { ...settings, ...message.settings };
      if (!settings.enabled) { speechSynthesis.cancel(); state = "idle"; announceState(); }
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "CHAT_ECHO_GET_STATE") {
      sendResponse({ state, enabled: settings.enabled });
      return true;
    }
  });

  chrome.storage.local.get(DEFAULTS).then((stored) => { settings = { ...DEFAULTS, ...stored }; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
    if (!settings.enabled) { speechSynthesis.cancel(); state = "idle"; }
  });

  const observer = new MutationObserver(inspectLatestTurn);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.setTimeout(inspectLatestTurn, 1500);
})();
