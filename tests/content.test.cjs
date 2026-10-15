const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("replay finds assistant markdown when role selectors are absent", async () => {
  const speechCalls = [];
  let messageListener;
  const markdown = {
    querySelector: () => null,
    cloneNode() {
      return {
        querySelectorAll: () => [],
        innerText: "This is the latest assistant answer.",
        textContent: "This is the latest assistant answer."
      };
    }
  };
  const document = {
    documentElement: {},
    querySelectorAll(selector) {
      if (selector === '[data-message-author-role="assistant"]') return [];
      if (selector === '[data-testid^="conversation-turn-"], article') return [];
      if (selector.includes("main .markdown") && selector.includes("[class*=MarkdownRoot]")) return [markdown];
      return [];
    }
  };
  const chrome = {
    runtime: {
      onMessage: { addListener(listener) { messageListener = listener; } },
      sendMessage(message) {
        if (message.type === "CHAT_ECHO_TTS_SPEAK") {
          speechCalls.push(message);
          return Promise.resolve({ state: "speaking" });
        }
        return Promise.resolve({ state: "idle" });
      }
    },
    storage: {
      local: { get: async (defaults) => defaults },
      onChanged: { addListener() {} }
    }
  };
  class MutationObserver { observe() {} }
  class ChatEchoReplyCompletionTracker { observe() {} }
  vm.runInNewContext(fs.readFileSync("src/content.js", "utf8"), {
    window: { __chatEchoLoaded: false, setTimeout },
    document,
    chrome,
    MutationObserver,
    setTimeout,
    clearTimeout,
    ChatEchoReplyCompletionTracker,
    ChatEchoCleaner: { cleanForSpeech: (text) => text }
  });

  const result = await new Promise((resolve) => {
    const keepChannelOpen = messageListener(
      { type: "CHAT_ECHO_COMMAND", command: "replay" },
      {},
      resolve
    );
    assert.equal(keepChannelOpen, true);
  });

  assert.equal(result.ok, true);
  assert.equal(result.chars, "This is the latest assistant answer.".length);
  assert.equal(speechCalls.length, 1);
  assert.match(speechCalls[0].text, /latest assistant answer/);
});
