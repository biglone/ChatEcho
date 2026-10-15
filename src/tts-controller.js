(function (root) {
  function splitSpeech(text, maxLength = 1800) {
    const chunks = [];
    let rest = String(text || "").trim();
    while (rest.length > maxLength) {
      let cut = rest.lastIndexOf("\n", maxLength);
      if (cut < maxLength * 0.55) {
        for (const punctuation of ["。", "！", "？", "!", "?", "；", ";"]) {
          cut = Math.max(cut, rest.lastIndexOf(punctuation, maxLength - 1));
        }
      }
      if (cut < maxLength * 0.55) {
        for (const punctuation of ["，", "、", ","]) {
          cut = Math.max(cut, rest.lastIndexOf(punctuation, maxLength - 1));
        }
      }
      if (cut < maxLength * 0.55) cut = maxLength - 1;
      chunks.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) chunks.push(rest);
    return chunks;
  }

  class TtsController {
    constructor(tts, onState = () => {}) {
      this.tts = tts;
      this.onState = onState;
      this.sequence = 0;
      this.state = { state: "idle", error: "" };
    }

    setState(state, error = "") {
      this.state = { state, error };
      this.onState(this.state);
    }

    getState() {
      return { ...this.state };
    }

    async speak(text, settings = {}) {
      const chunks = splitSpeech(text);
      if (!chunks.length) return this.getState();

      const sequence = ++this.sequence;
      this.tts.stop();
      this.setState("starting");

      try {
        const voices = await this.tts.getVoices();
        if (sequence !== this.sequence) return this.getState();

        const localVoices = voices.filter((voice) => voice.remote !== true);
        const voice = localVoices.find((item) => item.voiceName === settings.voiceName)
          || localVoices.find((item) => /^zh-CN/i.test(item.lang || ""))
          || localVoices.find((item) => /^zh/i.test(item.lang || ""))
          || localVoices[0];
        if (!voice) {
          throw new Error("没有可用的本地语音。请在系统语音设置中安装语音后重试。");
        }

        for (const [index, chunk] of chunks.entries()) {
          if (sequence !== this.sequence) return this.getState();
          await this.tts.speak(chunk, {
            voiceName: voice.voiceName,
            lang: voice.lang || "zh-CN",
            rate: Math.min(2, Math.max(0.5, Number(settings.rate) || 1)),
            pitch: Math.min(2, Math.max(0, Number(settings.pitch) || 1)),
            volume: 1,
            enqueue: index > 0,
            onEvent: (event) => this.handleEvent(sequence, index, chunks.length, event)
          });
        }
      } catch (error) {
        if (sequence === this.sequence) this.setState("error", error?.message || String(error));
      }

      return this.getState();
    }

    handleEvent(sequence, index, total, event) {
      if (sequence !== this.sequence) return;
      if (event.type === "start" || event.type === "resume") this.setState("speaking");
      if (event.type === "pause") this.setState("paused");
      if (event.type === "end" && index === total - 1) this.setState("idle");
      if (event.type === "interrupted" || event.type === "cancelled") this.setState("idle");
      if (event.type === "error") {
        this.sequence += 1;
        this.tts.stop();
        this.setState("error", event.errorMessage || "语音引擎播放失败。");
      }
    }

    command(command) {
      if (command === "pause") {
        this.tts.pause();
        this.setState("paused");
      } else if (command === "resume") {
        this.tts.resume();
        this.setState("speaking");
      } else if (command === "stop") {
        this.sequence += 1;
        this.tts.stop();
        this.setState("idle");
      }
      return this.getState();
    }
  }

  root.ChatEchoTtsController = TtsController;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { TtsController, splitSpeech };
  }
})(globalThis);
