# dsh-friends-wine

DeepSeek Harness 的整活插件：思考和输出时播放《朋友的酒》，同时把界面上的输入框、按钮、侧栏图标、插件页图标、快捷键帽、小鲸鱼挂件一起按 1 秒一轮上下拉伸；DSH 窗口未最大化时，窗口本身也跟着弹跳。回复结束立刻截断音乐、恢复原状。

## 功能

- **音乐**：会话运行期间循环播放 `assets/friends-wine.mp3`，结束时立即暂停并归零。
- **伸缩**：输入框、输入框内按钮、侧栏全部 SVG/图片图标、插件页图标、`kbd` 快捷键帽、侧栏品牌鲸鱼、`dsh-whale-widget` 的鲸鱼一起以底边为固定点做 1 秒伸缩。
- **思考文案**：把运行状态里的“深度求索中”改为“时间来不及了”，并放到用时后面，例如 `用时 1分32秒，时间来不及了 ···`。
- **窗口弹跳**：Windows 下，若 DSH 窗口未最大化/最小化，窗口会随节奏上下弹跳约 26px；结束回到原坐标。最大化时只保留内部元素伸缩。
- **插件图标**：使用仓库中的 `icon.webp`。

## 安装

1. 下载 Releases 中的 `dsh-friends-wine-1.0.1.zip` 并解压。
2. 在解压目录运行：

```powershell
node install.mjs
```

安装脚本会把插件复制到 `~/.dsh/plugins/dsh-friends-wine`，并修复旧的断链 junction；之后不再依赖解压目录，重复运行即可升级。

3. 完全退出并重启 DeepSeek Harness（不是刷新页面）。

> 需要 DeepSeek Harness Desktop 与 Node.js。窗口弹跳依赖 Windows PowerShell，只在 Windows 生效。

## 安全

`/dsh-friends-wine/window-bounce` 会先调用宿主的 `connection.requestRejection()`；Host、Origin 或浏览器凭据任一不通过即返回 401/403，认证服务不可用时路由不注册。未认证请求不会启动本机 PowerShell 脚本。

## 说明

- 原生窗口弹跳由 `assets/window-bounce.ps1` 调用 Win32 `SetWindowPos` 完成，只移动窗口、不改尺寸，最大化时自动跳过。
- `dsh-whale-widget` 的小鲸鱼动画依赖其页面结构（`.dshwv-img`）；未安装该插件时不影响其他功能。
- 歌曲《朋友的酒》版权归原权利人所有。本仓库仅作个人学习与自用，若权利人提出异议会删除相关音频。
