# ChatEcho

ChatEcho 是一个 Chrome / Edge Manifest V3 扩展，用浏览器本地语音引擎朗读 ChatGPT 网页的新回复。不需要 API Key，不会调用 OpenAI API。

## 当前版本

- 监听 `chatgpt.com` 和旧版 `chat.openai.com` 的助手回复。
- 等待流式回复结束后自动朗读，按回复去重；生成结束但文字未变化时也会重新确认完成状态。
- 移除代码块、Markdown 控制符和链接 URL。
- 控制自动朗读、暂停、继续、停止、重播、语音和语速。
- 长回复分段，设置保存在浏览器本地。

## 安装到 Chrome / Edge

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”，选择本目录 `chatecho-extension`。
4. 刷新 ChatGPT 标签页，点击扩展图标，开启“自动朗读”。
5. 在弹窗选择系统语音和语速。可用语音由操作系统和浏览器决定。

首次使用时若浏览器拦截声音，请在扩展弹窗点击“重播最新回复”或先暂停再继续一次，以激活语音播放。某些浏览器版本仍可能限制后台自动播放。

## 开发与测试

要求 Node.js 18 或更新版本。无需安装第三方依赖。

```sh
npm test
```

## 已知限制

- ChatGPT 网页 DOM 变化可能需要更新助手消息识别逻辑。
- 播放控制作用于当前 ChatGPT 标签页；切换标签页后需在对应标签页打开扩展弹窗。
- 浏览器 Web Speech API 的声音、发音质量和自动播放策略依赖当前操作系统及浏览器。
- 当前版本不朗读代码块，也不包含快捷键、选中文本朗读、Claude/Gemini 支持。

## 隐私

扩展仅在 ChatGPT 页面读取助手回复文本，并在本机调用 `speechSynthesis`。不向外部服务发送内容；设置保存在浏览器 `storage.local`。