const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanForSpeech } = require("../src/cleaner.js");

test("removes fenced code and markdown controls while preserving prose", () => {
  const result = cleanForSpeech("## 安装步骤\n\n```bash\nnpm install\n```\n然后运行 **npm start**。");
  assert.equal(result, "安装步骤\n\n。\n然后运行 npm start。");
});

test("keeps link labels and removes URLs", () => {
  assert.equal(cleanForSpeech("查看 [官方文档](https://example.com/docs)"), "查看 官方文档");
});

test("normalizes excessive whitespace", () => {
  assert.equal(cleanForSpeech("第一行\n\n\n第二行"), "第一行\n\n第二行");
});
