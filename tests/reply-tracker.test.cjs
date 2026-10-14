const test = require("node:test");
const assert = require("node:assert/strict");
const { ReplyCompletionTracker } = require("../src/reply-tracker.js");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("fires once after a stable completed reply", async () => {
  const element = {};
  const completed = [];
  const tracker = new ReplyCompletionTracker({ delay: 10, onComplete: (text) => completed.push(text) });
  tracker.observe(element, "Hello", () => false);
  await wait(20);
  tracker.observe(element, "Hello", () => false);
  await wait(20);
  assert.deepEqual(completed, ["Hello"]);
  tracker.dispose();
});

test("re-arms for the same text when streaming ends", async () => {
  const element = {};
  const completed = [];
  let generating = true;
  const tracker = new ReplyCompletionTracker({ delay: 10, onComplete: (text) => completed.push(text) });
  tracker.observe(element, "Final answer", () => generating);
  await wait(20);
  assert.deepEqual(completed, []);
  generating = false;
  tracker.observe(element, "Final answer", () => generating);
  await wait(20);
  assert.deepEqual(completed, ["Final answer"]);
  tracker.dispose();
});

test("new text replaces the pending candidate", async () => {
  const element = {};
  const completed = [];
  const tracker = new ReplyCompletionTracker({ delay: 15, onComplete: (text) => completed.push(text) });
  tracker.observe(element, "partial", () => false);
  await wait(7);
  tracker.observe(element, "complete", () => false);
  await wait(22);
  assert.deepEqual(completed, ["complete"]);
  tracker.dispose();
});
