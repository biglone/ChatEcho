const defaults = { enabled: false, rate: 1, pitch: 1, voiceName: "" };
const enabledInput = document.querySelector("#enabled");
const voiceSelect = document.querySelector("#voice");
const rateInput = document.querySelector("#rate");
const rateValue = document.querySelector("#rateValue");
const pitchInput = document.querySelector("#pitch");
const pitchValue = document.querySelector("#pitchValue");
const statusLabel = document.querySelector("#status");
const ttsError = document.querySelector("#tts-error");
const notice = document.querySelector("#notice");
let activeTabId = null;

async function activeChatTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url || "")) return null;
  return tab;
}

async function sendCommand(command) {
  if (activeTabId == null) return;
  try {
    const result = await chrome.tabs.sendMessage(activeTabId, { type: "CHAT_ECHO_COMMAND", command });
    if (command === "replay") {
      if (!result?.ok) {
        statusLabel.textContent = "未识别回复";
        statusLabel.classList.add("error");
        ttsError.hidden = false;
        ttsError.textContent = result?.error || "没有找到可朗读的最新消息";
      } else {
        statusLabel.textContent = `已提取最新消息（${result.chars} 字），正在启动朗读`;
        statusLabel.classList.remove("error");
        ttsError.hidden = true;
        ttsError.textContent = "";
      }
    }
  }
  catch { statusLabel.textContent = "请刷新 ChatGPT 页面"; }
}

async function saveSetting(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

async function loadVoices(selectedVoiceName) {
  try {
    const voices = await chrome.tts.getVoices();
    const localVoices = voices.filter((voice) => voice.remote !== true).sort((a, b) => {
      const aChinese = /^zh-CN/i.test(a.lang || "") ? 0 : /^zh/i.test(a.lang || "") ? 1 : 2;
      const bChinese = /^zh-CN/i.test(b.lang || "") ? 0 : /^zh/i.test(b.lang || "") ? 1 : 2;
      return aChinese - bChinese || (a.lang || "").localeCompare(b.lang || "");
    });
    voiceSelect.replaceChildren(new Option("自动选择（优先简体中文）", ""));
    for (const voice of localVoices) {
      const option = new Option(`${voice.voiceName} (${voice.lang || "未标注语言"})`, voice.voiceName);
      voiceSelect.add(option);
    }
    voiceSelect.value = selectedVoiceName || "";
    return localVoices.length > 0;
  } catch {
    statusLabel.textContent = "无法读取系统语音";
    statusLabel.classList.add("error");
    return false;
  }
}

function showSpeechState(result) {
  if (!result) return;
  const labels = { speaking: "正在朗读", starting: "正在启动语音", paused: "已暂停", idle: "就绪" };
  statusLabel.textContent = result.state === "error" ? `语音错误：${result.error || "未知错误"}` : (labels[result.state] || "就绪");
  statusLabel.classList.toggle("error", result.state === "error");
  ttsError.hidden = result.state !== "error";
  ttsError.textContent = result.state === "error" ? (result.error || "语音引擎播放失败。") : "";
}

async function initialize() {
  const settings = { ...defaults, ...await chrome.storage.local.get(defaults) };
  enabledInput.checked = settings.enabled;
  rateInput.value = settings.rate;
  rateValue.value = `${Number(settings.rate).toFixed(1)}×`;
  pitchInput.value = settings.pitch;
  pitchValue.value = Number(settings.pitch).toFixed(2);
  const hasLocalVoices = await loadVoices(settings.voiceName);

  const tab = await activeChatTab();
  if (!tab) {
    notice.hidden = false;
    statusLabel.textContent = "未连接";
    for (const element of [enabledInput, voiceSelect, rateInput, ...document.querySelectorAll("button")]) element.disabled = true;
    return;
  }
  activeTabId = tab.id;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "CHAT_ECHO_SETTINGS", settings });
    const result = await chrome.runtime.sendMessage({ type: "CHAT_ECHO_TTS_GET_STATE" });
    showSpeechState(result);
    if (!hasLocalVoices) {
      showSpeechState({ state: "error", error: "没有可用的本地语音。请在系统语音设置中安装语音后重试。" });
    }
  } catch {
    statusLabel.textContent = "请刷新 ChatGPT 页面";
  }
}

enabledInput.addEventListener("change", async () => {
  await saveSetting("enabled", enabledInput.checked);
  if (activeTabId != null) {
    try { await chrome.tabs.sendMessage(activeTabId, { type: "CHAT_ECHO_SETTINGS", settings: { enabled: enabledInput.checked } }); } catch {}
  }
});
voiceSelect.addEventListener("change", () => saveSetting("voiceName", voiceSelect.value));
rateInput.addEventListener("input", () => { rateValue.value = `${Number(rateInput.value).toFixed(1)}×`; });
rateInput.addEventListener("change", () => saveSetting("rate", Number(rateInput.value)));
pitchInput.addEventListener("input", () => { pitchValue.value = Number(pitchInput.value).toFixed(2); });
pitchInput.addEventListener("change", () => saveSetting("pitch", Number(pitchInput.value)));
document.querySelector("#pause").addEventListener("click", () => sendCommand("pause"));
document.querySelector("#resume").addEventListener("click", () => sendCommand("resume"));
document.querySelector("#stop").addEventListener("click", () => sendCommand("stop"));
document.querySelector("#replay").addEventListener("click", () => sendCommand("replay"));
document.querySelector("#test-voice").addEventListener("click", async () => {
  try {
    const settings = { ...defaults, ...await chrome.storage.local.get(defaults) };
    const result = await chrome.runtime.sendMessage({
      type: "CHAT_ECHO_TTS_SPEAK",
      text: "ChatEcho 语音测试。如果你听到了这句话，系统语音引擎正常。",
      settings: { rate: settings.rate, pitch: settings.pitch, voiceName: settings.voiceName }
    });
    showSpeechState(result);
  } catch (error) {
    showSpeechState({ state: "error", error: error.message || "无法启动 Chrome 语音引擎。" });
  }
});
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CHAT_ECHO_TTS_STATE") showSpeechState(message);
});
initialize();
