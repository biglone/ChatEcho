const test = require("node:test");
const assert = require("node:assert/strict");
const { TtsController, splitSpeech } = require("../src/tts-controller.js");

function makeTts(voices = [{ voiceName: "Chinese", lang: "zh-CN", remote: false }]) {
  const calls = [];
  return {
    calls,
    stopCalls: 0,
    pauseCalls: 0,
    resumeCalls: 0,
    async getVoices() { return voices; },
    async speak(text, options) {
      calls.push({ text, options });
      options.onEvent({ type: "start" });
      options.onEvent({ type: "end" });
    },
    stop() { this.stopCalls += 1; },
    pause() { this.pauseCalls += 1; },
    resume() { this.resumeCalls += 1; }
  };
}

test("speaks using a local Chinese voice and reports completion", async () => {
  const tts = makeTts([
    { voiceName: "Remote Chinese", lang: "zh-CN", remote: true },
    { voiceName: "Local Traditional Chinese", lang: "zh-TW", remote: false },
    { voiceName: "Local Chinese", lang: "zh-CN", remote: false }
  ]);
  const controller = new TtsController(tts);

  const result = await controller.speak("你好", { rate: 1.2, pitch: 1.08 });

  assert.equal(tts.calls.length, 1);
  assert.equal(tts.calls[0].options.voiceName, "Local Chinese");
  assert.equal(tts.calls[0].options.rate, 1.2);
  assert.equal(tts.calls[0].options.pitch, 1.08);
  assert.equal(tts.calls[0].options.volume, 1);
  assert.equal(result.state, "idle");
});

test("does not send text to a remote voice when no local voice exists", async () => {
  const tts = makeTts([{ voiceName: "Remote", lang: "zh-CN", remote: true }]);
  const controller = new TtsController(tts);

  const result = await controller.speak("你好");

  assert.equal(tts.calls.length, 0);
  assert.equal(result.state, "error");
  assert.match(result.error, /本地语音/);
});

test("queues long text in order and marks subsequent chunks as queued", async () => {
  const tts = makeTts();
  const controller = new TtsController(tts);
  const text = "甲".repeat(1801);

  await controller.speak(text);

  assert.deepEqual(tts.calls.map((call) => call.text.length), [1800, 1]);
  assert.equal(tts.calls[0].options.enqueue, false);
  assert.equal(tts.calls[1].options.enqueue, true);
});

test("surfaces engine errors and supports playback controls", async () => {
  const tts = makeTts();
  tts.speak = async (_text, options) => options.onEvent({ type: "error", errorMessage: "voice unavailable" });
  const controller = new TtsController(tts);

  const result = await controller.speak("你好");
  assert.equal(result.state, "error");
  assert.equal(result.error, "voice unavailable");

  assert.equal(controller.command("pause").state, "paused");
  assert.equal(controller.command("resume").state, "speaking");
  assert.equal(controller.command("stop").state, "idle");
  assert.equal(tts.pauseCalls, 1);
  assert.equal(tts.resumeCalls, 1);
});

test("splits long speech at a nearby newline", () => {
  const text = `${"a".repeat(1000)}\n${"b".repeat(1000)}`;
  const chunks = splitSpeech(text, 1200);
  assert.equal(chunks.length, 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 1200));
});

test("splits at sentence punctuation before falling back to a hard cut", () => {
  const text = `${"甲".repeat(900)}。${"乙".repeat(900)}`;
  const chunks = splitSpeech(text, 1200);
  assert.equal(chunks.length, 2);
  assert.ok(chunks[0].endsWith("。"));
});
