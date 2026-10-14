const defaults = { enabled: false, rate: 1, voiceURI: "" };
const enabledInput = document.querySelector("#enabled");
const voiceSelect = document.querySelector("#voice");
const rateInput = document.querySelector("#rate");
const rateValue = document.querySelector("#rateValue");
const statusLabel = document.querySelector("#status");
const notice = document.querySelector("#notice");
let activeTabId = null;

async function activeChatTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url || "")) return null;
  return tab;
}

async function sendCommand(command) {
  if (activeTabId == null) return;
  try { await chrome.tabs.sendMessage(activeTabId, { type: "CHAT_ECHO_COMMAND", command }); }
  catch { statusLabel.textContent = "请刷新 ChatGPT 页面"; }
}

async function saveSetting(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

function loadVoices(selectedURI) {
  const voices = speechSynthesis.getVoices();
  voiceSelect.replaceChildren(new Option("自动选择中文语音", ""));
  for (const voice of voices) {
    const option = new Option(`${voice.name} (${voice.lang})`, voice.voiceURI);
    voiceSelect.add(option);
  }
  voiceSelect.value = selectedURI || "";
}

async function initialize() {
  const settings = { ...defaults, ...await chrome.storage.local.get(defaults) };
  enabledInput.checked = settings.enabled;
  rateInput.value = settings.rate;
  rateValue.value = `${Number(settings.rate).toFixed(1)}×`;
  loadVoices(settings.voiceURI);
  speechSynthesis.onvoiceschanged = () => loadVoices(settings.voiceURI);

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
    const result = await chrome.tabs.sendMessage(tab.id, { type: "CHAT_ECHO_GET_STATE" });
    statusLabel.textContent = result.state === "speaking" ? "正在朗读" : result.state === "paused" ? "已暂停" : "就绪";
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
voiceSelect.addEventListener("change", () => saveSetting("voiceURI", voiceSelect.value));
rateInput.addEventListener("input", () => { rateValue.value = `${Number(rateInput.value).toFixed(1)}×`; });
rateInput.addEventListener("change", () => saveSetting("rate", Number(rateInput.value)));
document.querySelector("#pause").addEventListener("click", () => sendCommand("pause"));
document.querySelector("#resume").addEventListener("click", () => sendCommand("resume"));
document.querySelector("#stop").addEventListener("click", () => sendCommand("stop"));
document.querySelector("#replay").addEventListener("click", () => sendCommand("replay"));
initialize();
