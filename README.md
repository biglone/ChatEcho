# ChatEcho

ChatEcho 是一个 Chrome Manifest V3 扩展，用浏览器本地语音引擎朗读 ChatGPT 网页的新回复。不需要 API Key，不会调用 OpenAI API。

## 当前版本

- 监听 `chatgpt.com` 和旧版 `chat.openai.com` 的助手回复。
- 等待流式回复结束后自动朗读，按回复去重；生成结束但文字未变化时也会重新确认完成状态。
- 移除代码块、Markdown 控制符和链接 URL。
- 控制自动朗读、暂停、继续、停止、重播、语音、语速和音调；自动选择时优先使用简体中文语音。
- 长回复分段，设置保存在浏览器本地。

## 安装到 Chrome / Edge

1. 打开 Chrome 的 `chrome://extensions`。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”，选择解压后直接包含 `manifest.json` 的 `ChatEcho` 文件夹。
4. 刷新 ChatGPT 标签页，点击扩展图标，开启“自动朗读”。
5. 在弹窗选择本地语音、语速和音调。可用语音由操作系统和浏览器决定。

首次使用时若浏览器拦截声音，请在扩展弹窗点击“重播最新回复”或先暂停再继续一次，以激活语音播放。某些浏览器版本仍可能限制后台自动播放。

## 开发与测试

要求 Node.js 18 或更新版本。无需安装第三方依赖。

```sh
npm test
```

## 已知限制

- ChatGPT 网页 DOM 变化可能需要更新助手消息识别逻辑。
- 播放控制作用于当前 ChatGPT 标签页；切换标签页后需在对应标签页打开扩展弹窗。
- Chrome 的 TTS 使用操作系统提供的语音合成能力；音色自然度取决于已安装的本地语音。语速、音调和断句控制可微调听感，但不能把系统语音变成云端神经语音。
- 当前版本不朗读代码块，也不包含快捷键、选中文本朗读、Claude/Gemini 支持。

## 隐私

启用自动朗读后，扩展会读取 ChatGPT 页面上的助手回复文本，并通过 Chrome 的 `tts` 接口调用本机语音引擎。扩展只提供本地语音选项；回复文本不会发送到开发者或第三方服务器。语音、语速、音调和自动朗读设置保存在浏览器 `storage.local`。查看[完整隐私政策](PRIVACY.md)。

## Chrome 网上应用店版本

- 发布包：运行 `npm run package`，生成 `dist/ChatEcho-<版本号>-chrome.zip`。ZIP 根目录直接包含 `manifest.json`。
- 上架资料和隐私声明：见 [`store/STORE_LISTING.md`](store/STORE_LISTING.md)。
- 商店图片：见 [`store/assets/`](store/assets/)。
