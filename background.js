importScripts("src/tts-controller.js");

const controller = new ChatEchoTtsController(chrome.tts, (state) => {
  chrome.runtime.sendMessage({ type: "CHAT_ECHO_TTS_STATE", ...state }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CHAT_ECHO_TTS_GET_STATE") {
    sendResponse(controller.getState());
    return false;
  }

  if (message.type === "CHAT_ECHO_TTS_COMMAND") {
    sendResponse({ ok: true, ...controller.command(message.command) });
    return false;
  }

  if (message.type === "CHAT_ECHO_TTS_SPEAK") {
    controller.speak(message.text, message.settings).then(sendResponse);
    return true;
  }
});
