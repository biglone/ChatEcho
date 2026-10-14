(function (root) {
  class ReplyCompletionTracker {
    constructor({ delay = 1100, onComplete }) {
      this.delay = delay;
      this.onComplete = onComplete;
      this.candidate = null;
      this.handled = new WeakSet();
      this.timer = null;
    }

    observe(element, text, isGenerating) {
      if (!element || !text || this.handled.has(element)) return;

      if (this.candidate?.element !== element || this.candidate.text !== text) {
        this.candidate = { element, text };
      }

      // Re-arm even when the text is unchanged: the stop button disappearing
      // is often the only DOM signal that streaming has ended.
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        if (isGenerating()) return;
        this.handled.add(element);
        this.onComplete(text, element);
      }, this.delay);
    }

    dispose() {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  root.ChatEchoReplyCompletionTracker = ReplyCompletionTracker;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ReplyCompletionTracker };
  }
})(globalThis);
