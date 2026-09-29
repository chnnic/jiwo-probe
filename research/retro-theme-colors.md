# 复古主题顶级线路颜色研究

## 结论

- Windows XP Luna 的控件底色是 `#ece9d8`，XP.css 的真实按钮悬停高光使用 `#fdd889`、`#fbc761` 和 `#e5a01a`。因此 XP 顶级线路采用纯色 `#fdd889`、`#e5a01a` 边框和深棕字，保留 XP 的暖色强调但不伪造渐变。
- Windows 的系统颜色文档把 `COLOR_3DFACE` 定义为可交互控件面色，把 `COLOR_HIGHLIGHT`/`COLOR_HIGHLIGHTTEXT` 定义为选中或交互状态的前景/背景组合。Win2000 顶级线路使用项目已有的信息提示色 `#ffffe1` 和黑字，避免金色背景叠金色文字造成低对比度。
- Mac OS 9 路由沿用 Platinum 灰色面板与深灰字，顶级线路使用浅紫色 `#ccf` 和深紫边框 `#333399`，保留金牌图标。这是基于用户指定的 `livid/exe` 参考调色板作出的应用设计，并非 Mac OS 9 原生线路等级配色。此前金色 `#dfc16d` 缺少该参考支持，已替换；顶级线路不使用白色高光边。

## 来源

1. [XP.css XP variables](https://raw.githubusercontent.com/botoxparty/XP.css/main/themes/XP/_variables.scss)：定义 XP 控件面色 `#ece9d8`、高亮白色和对话框蓝色。
2. [XP.css XP buttons](https://raw.githubusercontent.com/botoxparty/XP.css/main/themes/XP/_buttons.scss)：定义 XP 按钮的悬停高光色 `#fff0cf`、`#fdd889`、`#fbc761`、`#e5a01a`，以及 XP 按钮的 3px 圆角和无外部阴影。
3. [Microsoft Learn: GetSysColor](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getsyscolor)：说明 `COLOR_3DFACE` 是可交互控件的背景，`COLOR_HIGHLIGHT` 与 `COLOR_HIGHLIGHTTEXT` 是选中/交互状态的背景与文字配对。
4. [项目 XP/Win2000 主题变量](../src/retro-themes.css)：保留本项目的 XP `--face`、`--bar-hot`、Win2000 `--face` 与 `--tip-bg` 语义，颜色改动只作用于金牌路由块。
5. [livid/exe site.css](https://github.com/livid/exe/blob/main/internal/server/site/site.css)：使用 Platinum 灰色 `#ddd`、深灰文字 `#262626`、浅紫 `#ccf` 和强调色 `#333399`；本项目据此统一 Mac 路由配色。
