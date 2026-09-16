# Jiwo Probe（鸡窝状态站）

妙妙屋 X（MiaoMiaoWuX）独立服务器探针的**非官方魔改 fork**，基于 [mmwx-probe](https://github.com/mmwx-group/mmwx-probe)（功能基线 `e6f3a11`，2026-09-11；最新 Passkey 登录、Premium 移动端顶栏、续费链接和白金对比度修复已按本 fork 架构移植）。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chnnic/jiwo-probe)

与原版的差异（定制增强）：

### 视图模式（三套，一键切换）

- **极简卡片模式**（`Rows3` 图标）——单行扁平卡，状态点 + 旗帜 + 名字 + 核心指标，手机一屏看 20+ 台服务器（普通卡片模式仅 ~4 台）
- **极简卡片展开模式**——再点一下极简卡片图标，卡片变高为 **3 行信息**：
  - 第一行：状态点 + 旗帜名字 + 在线/离线 + 到期天数
  - 第二行：CPU / 内存 / 硬盘 / 流量 + 续费价格
  - 第三行：平均延迟 + 丢包率 + 实时上下行速度 + **三网回程线路**（无回程数据自动隐藏，`Unknown` 运营商自动过滤，CN2 GIA / 9929 / CMIN2 等优质线路金色高亮）
  - 展开状态持久化，刷新后保持
- **卡片模式**——带 Ping 趋势、回程勋章、到期续费链接的完整卡片
- **列表模式**——可排序表格（CPU/内存/流量/延迟等列点击排序），带迷你趋势按钮

### 主题系统（七套 + Ran 金工界面，一键切换）

- **Ran 主题**（第 6 主题）——**完整复刻 Komari-Ran-Theme「岚」**（精密金工质感，原版整体移植 + 数据适配层，非换皮）：
  - 完整界面：Sidebar 导航（Overview / Nodes / Hub / Traffic / Billing / Geo Map）+ Topbar（⌘K 搜索 / V1·V2 布局切换 / 主题下拉）+ Footer
  - V1 经典卡片网格 / V2 信息盘式仪表盘（Cluster Health Score、24h 吞吐大图、Top Talkers、Alerts/Incidents 面板）
  - HeroStats 顶部 4 大数（在线 / 上行速率 / 下行速率 / 累计流量，带 sparkline）
  - 节点卡：金工质感全套（双 hairline 倒角、凹陷读数窗、蚀刻铭牌字、BlockMeter 分段条、状态扫光），出站/入站显示**当前周期流量**（周期上行/下行，物理口径）
  - NodeDetail 详情页、Traffic 全网流量、Billing 订阅汇总（月成本 / 年估算 / 到期提醒 / 多币种 + 汇率）、访客信息浮卡（每会话一次）
  - **10 个主题变体**：墨石深（night）/ 雾色浅（mist）/ 烬枣红（ember）/ 樱粉（sakura）/ 薰衣草（lavender）等，右上角切换
  - 懒加载分包（首屏 index 196KB 不变），访客接口走 CF 请求头（零第三方依赖）
- **Lumina 主题**（第 5 主题，`pixel → flat → anime → glass → lumina → ran` 循环）——保留 Komari Theme LuminaPlus 的信息布局，并移植主控白金/黑金视觉：无外框不透明卡片、关闭动态背景模糊、轻量静态阴影、无边框顶栏、未选中按钮无金框，详情页和弹窗保留 1px 结构线；健康区延迟/丢包柱条热力分段（与数值同色）、流量脉冲点击弹日流量趋势图、延迟/丢包柱条点击弹完整趋势图、延迟展示内容可选（平均或任意线路）、上下行箭头图标化（悬停 title 提示）、**三网回程勋章扁平化**（去掉系统金/银拟物动画勋章，改细边框低饱和 chip，CN2 GIA / 9929 / CMIN2 等优质线路金色点缀，详情页同步同款）
  - **四态配色循环**（Gem 图标切换：浅 → 暗 → 黑金 → 白金）——黑金为 Lumina 专属配色：深墨绿黑底 + 金色描边/光晕 + 米白文字，顶部金色光晕；白金移植自 license.miaomiaowu.net premium light（米白底 + 暗金 #a87c22）；切换记忆在浏览器（localStorage），刷新保持
  - **黑金/白金金色体系**——非语义色收敛金色：进度条/脉冲条/剩余流量条/延迟与丢包率数值与柱条/资产总揽金额（`--accent`）/许可证徽章/spark 星光统一金色；黑金/白金两态的**进度条统一使用原版 premium 黑金渐变**（深金 `#8f651d` → 亮金 `#e5c367`，含二级详情页 .meter）；进度条轨道用详情页同款 `color-mix(border 70%)` 暗轨道（全主题自适应）；状态语义色保留（绿在线/红离线/黄到期），趋势图多线区分色保留
- **玻璃主题**（第 4 主题）——重新设计为可读性优先的现代磨砂玻璃：低噪声冷色环境光、三层玻璃透明度、顶部细高光、克制阴影，桌面/手机与详情页统一适配
- **主控自定义主题**——主控后台可下发任意主题名，探针原样挂 `theme-{name}` CSS 类（站长可在探针 CSS 里写 `:root.theme-{name}` 覆盖，无对应样式自动回退默认）；内置主题名大小写不敏感归一化（主控下发 `Lumina` 正确应用本地 lumina 主题）；用户手动切换主题优先于主控下发

#### 主控后台切换主题（核心能力）

**主控后台 → 主题设置 → 输入主题名**，全站访客实时跟随：

| 主控输入 | 访客看到 |
|---|---|
| `pixel` / `flat` / `anime` / `glass` / `lumina` / `premium` | 经典界面 + 对应主题 |
| `lumina-gold` | Lumina 黑金配色（默认黑金，访客手动切换仍优先） |
| `lumina-platinum` | Lumina 白金配色（米白底暗金，license premium light 移植） |
| `premium-platinum` / `premium-light` | Premium 整页主题 · 白金配色（米白底暗金） |
| `ran` | Ran 金工界面 + 默认变体（ran-mist 雾色浅） |
| `ran-night` | Ran · 夜（墨石深） |
| `ran-mist` | Ran · 雾（雾色浅） |
| `ran-ember` | Ran · 烬（烬枣红） |
| `ran-sakura` | Ran · 樱（樱粉） |
| `ran-lavender` | Ran · 薰（薰衣草紫） |
| `ran-tomcat` | Ran · 凶鸟（橘猫橙） |
| `ran-teal` | Ran · 松石（松石青） |
| `ran-midnight` | Ran · 午夜（深蓝夜） |
| `ran-mint` | Ran · 薄荷（薄荷绿） |
| `ran-butter` | Ran · 奶油（奶油黄） |
| `ran-ji` | Ran · 霁（雨后青） |
| `glassmorphism` | Glassmorphism 玻璃拟态整页（默认 **auto 模式**） |
| `glassmorphism-light` | Glassmorphism · 白色模式（浅蓝白玻璃） |
| `glassmorphism-dark` | Glassmorphism · 黑色模式（深蓝黑玻璃） |
| 其他自定义名 | 经典界面 + `theme-{name}` 类（站长自写 CSS 接管） |

> **auto 模式**：主控**不写明暗后缀**（如 `glassmorphism`、`pixel`、`flat`、`anime`、`glass`、`premium`）默认进入 auto——按北京时间自动切换（6:00–18:00 浅色/白金，夜间深色/黑金；premium 为白金↔黑金、glassmorphism 为白色↔黑色、经典主题为浅色↔深色）。访客侧主题内切换按钮为 **auto → 白色 → 黑色** 三态循环（glassmorphism 顶部按钮显示"自动/太阳/月亮"），手动切换后优先于主控下发。

> 主控主题名仅允许字母、数字、下划线、连字符（≤64 字符），上表均为合规写法；大小写不敏感。

优先级：**主控明确下发变体 > 用户手动选过（浏览器记忆）> 本地缓存 > 默认**。探针实时监听主控下发（WS/轮询新帧），切换无需刷新页面。
- 做过性能优化：backdrop-filter 合成层从 50+ 降到 2 层（仅顶部栏和遮罩），低 CPU / 低耗电，手机不发烫

#### Cloudflare 自定义背景

无需修改或重新打包前端。进入 Cloudflare 的 **Workers & Pages → mmwx-probe → Settings → Variables and Secrets**，添加或编辑下列运行时变量，保存并部署后刷新页面即可。支持任意 HTTPS 图片链接；如果希望图片也存放在 Cloudflare，可先上传到 **R2（公开桶/自定义域名）或 Cloudflare Images**，再把生成的 HTTPS 地址填入 `PROBE_BACKGROUND_URL`。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PROBE_BACKGROUND_URL` | 空 | 图片 HTTPS 地址；也支持仓库 `public` 目录中以 `/` 开头的静态资源路径 |
| `PROBE_BACKGROUND_OVERLAY` | `0.32` | 遮罩强度 `0–0.95`，越高文字越清晰、图片越淡 |
| `PROBE_BACKGROUND_POSITION` | `center` | `center` / `top` / `bottom` / `left` / `right` |
| `PROBE_BACKGROUND_THEMES` | `pixel,flat,anime,glass,lumina,premium,ran,glassmorphism,emerald` | 应用主题，英文逗号分隔；删除不需要背景的主题即可 |

完整配置示例：

```text
PROBE_BACKGROUND_URL=https://example.com/background.webp
PROBE_BACKGROUND_OVERLAY=0.32
PROBE_BACKGROUND_POSITION=center
PROBE_BACKGROUND_THEMES=pixel,flat,anime,glass,lumina,premium,ran,glassmorphism,emerald
```

仓库已在 `package.json` 声明这四项配置，并在 Worker 代码中提供默认值和校验。站点自己的图片地址不会硬编码到仓库，避免公开站点配置；`wrangler.jsonc` 启用了 `keep_vars`，因此从 Cloudflare 后台设置的变量不会被普通代码部署删除。背景配置由 Worker 的公开只读接口下发，不包含任何 Secret，请勿在这些变量中填写 token。未设置图片、链接无效或当前主题不在应用范围时，会自动回退到主题原生背景。

<a id="multi-ping-groups"></a>

#### 首页卡片的多组延迟 / 丢包

支持 **pixel、flat、anime、glass、lumina、glassmorphism、emerald** 七个主题。**Premium 和 Ran 不接入**，保留原有显示；列表视图和详情页的布局也不改变。各组纵向排列，中间不加分隔线；目标下拉框直接整合在左侧延迟行，不再单独占用标题行。组内延迟与丢包来自同一测试目标，不会新增探测请求或提高刷新频率。

**直接安装即启用，无需手动添加这三项 CF 变量。** 仓库脚本已内置三组：平均延迟、内地延迟、海外延迟；国际候补依次为 Cloudflare、Google、Telegram DC5。使用 `npm run deploy` / `./scripts/deploy.sh` 时，会自动把缺失的三项创建为 CF 后台可见的 **Text 变量**，已有值原样保留。按下方部署流程完成主控地址和访问密钥配置后，多组延迟自动生效。

**安装与可选调整（Cloudflare 后台）**

1. 先同步本仓库最新代码，并确认 Cloudflare 已成功部署包含此功能的版本。
2. 在探针中使用上述任一支持主题的**首页卡片视图**。主控需要已经向探针下发延迟 / 丢包测试数据；这些变量只控制显示，不会替主控创建测试目标。
3. **新版本默认已经开启三组**：平均延迟、内地延迟、海外延迟。不需要另找功能开关；如需调整，进入 **Workers & Pages → 你的 Worker → Settings → Variables and Secrets**，编辑脚本已创建的 **Text（文本）运行时变量**，不要填到 Build Variables 中。
4. 例如要显示三组，将变量名称填为 `PROBE_PING_GROUP_COUNT`，值单独填 `3`，不要把整行 `PROBE_PING_GROUP_COUNT=3` 填进值输入框。默认目标和备用目标可按下表选填。
5. 点击 **Save / Deploy（保存并部署）**，完成后刷新探针页面。已有后台变量优先：如果以前设置过组数 `1`，更新代码后仍是单组，需要改为 `2` 或 `3`。

**配置项与示例**

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PROBE_PING_GROUP_COUNT` | `3` | 显示 `1`、`2` 或 `3` 组，未设置或无效时使用脚本默认 `3` |
| `PROBE_PING_DEFAULT_TARGETS` | `平均延迟，内地延迟，海外延迟` | 按位置匹配第 1–3 组；只使用组数范围内的目标 |
| `PROBE_PING_INTL_TARGETS` | `intl-web-cloudflare,intl-web-google,intl-tg-dc5` | 依次对应 Cloudflare、Google、Telegram DC5；未命中时按此顺序补位，可通过后台改成其他国际目标 |

脚本默认值集中在 [`src/ping-groups.ts`](src/ping-groups.ts) 顶部的 `PING_GROUP_SCRIPT_VARS`，三个配置名称与 CF 后台变量相同。**不想配置 CF 后台时，保持脚本原样直接安装即可；想改变安装默认值时，只改脚本顶部这三项。** 后台变量优先，后台未设置或留空才使用脚本默认；部署不会覆盖已有的后台变量。卡片下拉菜单始终提供“平均延迟、内地延迟、海外延迟”三个范围选项（范围内没有目标时禁用），并保留各个实际测试目标。

部署脚本只补缺失项，不会把你改成的 `1` / `2` 组、目标名单或其他站点配置重置。读取 CF 配置遇到权限 / 网络错误时会停止，不会把错误当作“全新安装”。如果这里没有设置项，确认部署命令使用 `./scripts/deploy.sh` 或 `npm run deploy`：直接执行 `npx wrangler deploy` 仍能使用代码默认三组，但不会自动创建这些后台设置项；重新运行仓库部署脚本即可补齐。

变量名保持英文，**目标变量的值可以写中文**。支持英文逗号、中文逗号或换行分隔，自动去除首尾空格。例如，三组范围平均配合三个国际候补：

```text
PROBE_PING_GROUP_COUNT=3
PROBE_PING_DEFAULT_TARGETS=平均延迟，内地延迟，海外延迟
PROBE_PING_INTL_TARGETS=intl-web-cloudflare,intl-web-google,intl-tg-dc5
```

只显示内地、海外两组时，设置以下两项，国际候补继续使用默认值即可：

```text
PROBE_PING_GROUP_COUNT=2
PROBE_PING_DEFAULT_TARGETS=内地延迟，海外延迟
```

只显示一组平均延迟时，分别设为 `PROBE_PING_GROUP_COUNT=1`、`PROBE_PING_DEFAULT_TARGETS=平均延迟`。组数只决定显示几个位置，不会自动改写目标顺序。

三个范围均计算平均值：**平均延迟**为全部目标平均，**内地延迟**为内地目标平均，**海外延迟**为国际目标平均，对应丢包率也使用相同范围。兼容旧写法：`平均` / `全部平均` / `avg`、`内地平均` / `国内平均` / `avg-cn`、`海外平均` / `国际平均` / `avg-intl`。普通目标填写主控实际下发的完整名称或 key（例如 `sh-ct-v4`、`intl-web-cloudflare`），不是模糊匹配；同名目标请使用 key 消歧。

- 每台服务器独立匹配：先保留所有命中的默认目标，再给缺失位置补国际目标，同一目标不重复占用两组。
- **超时或高丢包不是“未命中”**，不会换目标掩盖故障；只在没有这个探测目标时回落。没有内地探测点时，“内地延迟”也会回落到国际备用，不需要配置落地机名单。
- 国际备用只接受已明确分类为国际的目标；显式填写名单后不会再擅自选名单外目标。备用不足则显示“未配置”，可在该组下拉菜单中手动选择。
- 所有平均按范围内有效值算术平均，负值等无效延迟不当作 0；丢包按实际有效丢包值平均（包括 100%）。只有超时延迟时显示“超时”；没有有效丢包值显示 `—`。
- 访客可在每张卡片的下拉菜单选择目标，浏览器记忆选择；修改过选择后，点击第一组丢包标题旁的重置图标，可恢复该卡片全部组的后台默认。服务器改名或后台配置变化会启用新的默认配置。
- 保存变量并部署后刷新网页生效，无须修改前端源码。上述三项为公开显示配置，请勿填写密钥。未配置时默认显示三组范围平均；Premium、Ran 仍保持原样。

**没有显示多组时**：先确认最新版本已经部署、当前是支持主题的卡片视图、变量放在运行时设置中且组数不是 `1`。若显示“未配置”，检查主控是否为该服务器下发了相应测试目标，以及备用目标名称 / key 是否匹配；这不是开启更多组数就能补出的数据。

### 数据与交互增强

- **主控公开开关联动**——支持 `show_name` 隐藏服务器名称、`show_forward` 隐藏 Premium 网络状况中的转发链入口、`block_login` 禁止独立探针 `/login` 跳转主控；字段缺省时保持旧版行为
- **多维榜单**——16 个维度 Top 10（CPU / 内存 / 磁盘 / 负载 / 流量 / 流量使用率 / 实时速度 / 在线时长 / 今日流量 / 近7日流量 / 内地丢包率 / 海外丢包率 / 月成本 / 到期时间 / 内地延迟 / 海外延迟），Twemoji 国旗，前三金银铜徽章，点击当前维度切换升降序，到期时间默认升序（最快到期在前）
- **榜单明细展开**——内地/海外延迟与丢包率维度，点击行尾箭头展开查看该节点每条线路的具体值（延迟 ms / 丢包率 %，超时与无数据区分显示）
- **搜索框**——按名称 / 地区 / 服务商即时过滤节点
- **地区筛选下拉**——自定义组件，Twemoji 旗帜图片渲染（原生 `<select>` 在 Windows 下旗帜会显示成字母）
- **地区分布折叠卡**——按地区聚合，全球 SVG 分布图
- **资产总揽**——总剩余价值 / 月均成本 / 覆盖台数（按剩余天数折算，共享同一套算法），大数字垂直居中 + 左右分布
- **服务器详情页**（hash 路由）——剩余价值、负载三值、上行/下行速度对称布局、到期与续费信息、回程线路、延迟/丢包率/日流量/负载趋势图、省市区展示；**健康分徽章**（头部在线状态旁：评分 · 等级，绿=健康/红=告警，悬停显示扣分原因——CPU/内存/硬盘压力、延迟、丢包、流量额度、到期时间综合评分；**跟随主控 `show_health_score` 开关，主控开启才显示**，经典详情页与金工 Premium 卡片/drawer 三处统一受控）；**趋势图鼠标跟随 tooltip 深色化**（跟随主题表面色 `--surface`，黑金/暗色下深底金字，浅色主题保持白底）
- **CPU / 内存历史曲线**——详情页新增"CPU""内存"tab：CPU 使用率 / 内存占用百分比历史（1h/6h/24h 档位 + 缩放适应），数据来自上游 series `metric=system`（主控 beta3 原生支持）
- **剩余价值计算**——日成本 × 剩余天数（含当天口径），支持月/季/半年/年周期多币种
- **三许可证铭牌底栏**——手机端单行横滚，不占空间
- **主控周期字段全面接线**——`traffic_used_up/down`（周期上下行，物理口径，up+down=total 与 daily_traffic 逐日求和精确一致）、`traffic_used_total`（周期总流量，重启不清零）、`period_start/end`（计费周期边界）：卡片/Lumina 卡周期上下行直读物理口径、详情页累计流量改周期统计、Lumina 卡剩余流量后显示重置倒计时 + 重置日
- **表格流量列增强**——列表视图流量格显示 `↑ 上行 · ↓ 下行`（周期物理口径）+ 周期区间（MM-DD — MM-DD），点击弹出日流量趋势图
- **原始上下行日流量趋势弹窗**（照上游 `6221dd1` 重做）——标题/合计/计费说明齐全：**当前周期 / 最近 7 日** 范围切换 + 周期原始合计 + 计费口径说明（"卡片按 XX 计费（公式）"）；图表内**总流量 / 上行流量 / 下行流量**三线独立切换（与二级详情页一致），缩放/适应宽度按钮；手机端弹窗撑满屏幕（`max-height: 100dvh`）+ 图表弹性高度（`min(42vh, 300px)`），三线按钮与缩放按钮免滚动直接可见、缩放按钮 34px 加大便于点击
- **流量计费口径面板**（premium drawer 照主控实测）——本周期计费用量（`traffic_used` 计费口径）/ 计费口径（系统网卡·Xray 节点 × 上行+下行/仅上行/仅下行/取较大值）/ 原始周期 上下行 / 对账调整 / 对账公式（总量 − 调整 = 计费用量）/ 计费周期 / 本次开机网卡，黑金白金双适配
- **单向计费修正**——premium 卡片/计费面板统一优先 `traffic_used`（计费口径）而非 `traffic_used_total`（双向物理值）：`traffic_stats_mode = upload/download/max` 的单向计费机器（如 GoMami 仅上行）不再显示翻倍流量；计费口径 mode 取值统一为上游 `upload / download / max`（`traffic-display.ts` 工具）
- **bytes 格式化去冗余 .0**——`1000.0 GB` → `1000 GB`（含四舍五入后恰为 X.0 的值），非整数精度不变

### ProbeHub 主控降载

- **全局单采集器**——使用固定名称的 Cloudflare Durable Object 聚合所有访客连接；无论同时打开多少页面，主控正常情况下只承受一个 ProbeHub 的定时快照请求，再由 ProbeHub 将实时帧广播给访客
- **3 秒实时刷新**——ProbeHub 默认每 3 秒从主控获取一次完整快照；`/api/probe` 优先复用最近快照并叠加 3 秒边缘微缓存，避免页面首屏和轮询重复触发主控生成数据
- **可配置降载**——运行时变量 `PROBE_POLL_INTERVAL_SECONDS` 默认为 `3`；需要降低主控数据库压力时设为 `5` 即可恢复 5 秒采集，无需修改代码
- **自动恢复与回退**——单次快照失败不会停止后续采集；Hub 异常时 HTTP 请求自动回退原有直连，不牺牲页面可用性
- **按需运行**——首名访客进入时启动采集，最后一名访客离开 30 秒后自动停止，降低 Durable Object 空闲时长
- **零手动配置**——Durable Object 声明已写入 `wrangler.jsonc`，新安装和已有部署更新时均自动创建并绑定；可通过 `X-Probe-Source: hub` / `origin-fallback` 响应头确认运行路径

### 手机端适配

- 宽度断点全局对齐（760px / 640px / 960px），容器宽度一致无偏差
- 紧凑速度徽章、负载区图标化、许可证底栏单行横滚
- 极简卡片手机端专门压缩规则，375px 下无横向溢出
- 趋势弹窗（日流量趋势）手机端撑满屏幕（`100dvh`）、图表高度弹性收缩，三线/缩放按钮免滚动直接可见

## 许可证

本项目采用 [Miaomiaowu X Source Available License v1.0](LICENSE)（官方许可证，未修改）。允许非商业使用、学习、修改和按许可证要求分发；商业使用需取得原作者授权。**本 fork 非官方发布，与妙妙屋 X 无任何关联或背书。**

## 工作方式

```text
多个浏览器 ──HTTPS/WS──> Cloudflare Worker ──> 全局 ProbeHub ──每 3 秒单次快照──> 妙妙屋 X 主控
                                      └──── 故障时自动直连回退 ────┘
```

`ProbeHub` 由 Cloudflare Durable Object 承载。所有访问域名和边缘节点使用同一个固定实例，默认每 3 秒向主控请求一次完整快照，再把快照广播给所有访客；最后一名访客离开 30 秒后停止采集。这样访客数增加时，不再按访客数增加主控实时数据查询。需要降低数据库压力时，将运行时变量 `PROBE_POLL_INTERVAL_SECONDS` 设置为 `5` 即可切回 5 秒。

Worker 只处理固定只读路径和两条 Passkey 鉴权路径，不接受访客指定上游地址，因此不会形成开放代理：

| 对外路径 | 处理方式 | 用途 |
| --- | --- | --- |
| `/api/probe` | ProbeHub 最新帧 + 3 秒边缘微缓存 | 服务器状态 |
| `/api/series` | 直连 `/api/public/probe-series` | 延迟与丢包率历史 |
| `/api/stream` | ProbeHub 共享单条上游 WebSocket | 实时 WebSocket |
| `/api/login/passkey/begin` | 仅允许 POST，不携带 `PROBE_TOKEN` | 获取主控 Passkey 挑战 |
| `/api/login/passkey/finish` | 仅允许 POST，不携带 `PROBE_TOKEN` | 校验断言并跳转回主控 |

ProbeHub 连接或快照异常时会自动回退到原来的主控直连，不影响页面可用性。响应头 `X-Probe-Source: hub` 表示命中 Hub，`origin-fallback` 表示当次使用了回退。

## 准备工作

- 已部署支持独立探针访问密钥的妙妙屋 X 主控
- Cloudflare 账户及可用的 Workers 服务
- Node.js 22 或更高版本、npm 10 或更高版本
- 主控具有可由 Cloudflare 访问的 HTTPS 地址

九套主题的页首均提供 Passkey 登录入口，按钮、键盘焦点和错误提示随当前主题配色；Glassmorphism、Emerald 和 Ran（含各配色变体）使用各自的原生按钮样式。如需从外置探针使用 Passkey 登录，先在主控注册 Passkey，并在主控的 `MMWX_WEBAUTHN_RELATED_ORIGINS` 中加入探针完整来源（例如 `https://tz.example.com`）。探针只提供登录入口，不提供 Passkey 注册。

先进入主控的"系统设置 → 探针"，启用探针、选择展示服务器和指标，然后生成"独立探针访问密钥"。密钥明文只显示一次，请立即保存，切勿提交到 Git。

## Cloudflare 网页部署（推荐）

整个过程由 Cloudflare 从 GitHub 拉取、编译和部署，不需要在本地 clone，也不需要安装 Node.js：

> **推荐先 fork 再导入**：先在 GitHub 上把 `chnnic/jiwo-probe` fork 到自己的账号，然后按下面的步骤导入**自己的 fork**。这样自带 `sync-upstream.yml` 自动同步工作流，上游更新无需手动合并（详见下文"自动同步上游更新"）。
> ⚠️ **不要用页面上的 "Deploy with Workers" 一键部署按钮**（`deploy.workers.cloudflare.com`）：它会在你的 GitHub 生成一个**复制仓库**，且复制时跳过隐藏目录 `.github/`，导致自动同步工作流丢失，之后无法跟随上游更新。请使用 Dashboard 的 **Import a repository** 直接连接你的 fork。

1. 在 GitHub 上 fork `chnnic/jiwo-probe`（页面右上角 **Fork** 按钮）。
2. 在 Cloudflare Dashboard 的 **Workers & Pages → Create application → Import a repository**，选择**你 fork 出来的仓库**（而不是原仓库）。
3. 保持以下构建设置：
   - Production branch：`main`
   - Build command：`npm run build`
   - Deploy command：`./scripts/deploy.sh`
   - Root directory：留空
4. 首次部署后，进入 Worker 的 **Settings → Variables and Secrets**，添加运行时变量。连接主控需要配置 `MMWX_ORIGIN` 和 `PROBE_TOKEN`；**`PROBE_PING_*` 三项均已内置默认值，安装时全部跳过即可显示三组**，仅自定义时需要填写：

   | 名称 | 类型 | 值 |
   | --- | --- | --- |
   | `MMWX_ORIGIN` | Text | 主控 HTTPS 地址，例如 `https://panel.example.com` |
   | `PROBE_TOKEN` | Secret | 主控"系统设置 → 探针"生成的访问密钥 |
   | `PROBE_POLL_INTERVAL_SECONDS` | Text（可选） | 实时快照间隔，默认 `3`；降载时可设为 `5` |
   | `PROBE_NETWORK_SPEED_UNIT` | Text（可选） | 「网络情况」总上下行网速单位：`bytes`（默认，自动显示 B/s、KB/s、MB/s、GB/s、TB/s）或 `bits`（自动显示 bps、Kbps、Mbps、Gbps、Tbps）；未设置或无效值使用 `bytes` |
   | `PROBE_BACKGROUND_URL` | Text（可选） | 自定义背景图片 HTTPS 地址 |
   | `PROBE_BACKGROUND_OVERLAY` | Text（可选） | 背景遮罩强度，默认 `0.32` |
   | `PROBE_BACKGROUND_POSITION` | Text（可选） | 背景位置，默认 `center` |
   | `PROBE_BACKGROUND_THEMES` | Text（可选） | 默认 `pixel,flat,anime,glass,lumina,premium,ran,glassmorphism,emerald`，可删除不需要的主题 |
   | `PROBE_PING_GROUP_COUNT` | Text（可选） | 首页卡片显示 `1` / `2` / `3` 组延迟与丢包，默认 `3`；Premium / Ran 不受影响 |
   | `PROBE_PING_DEFAULT_TARGETS` | Text（可选） | 默认目标，支持中文，如 `平均延迟，内地延迟，海外延迟` |
   | `PROBE_PING_INTL_TARGETS` | Text（可选） | 未命中的国际备用目标，逗号分隔；默认 Cloudflare、Google、Telegram DC5 |

   注意这里是 Worker 的运行时 **Settings → Variables and Secrets**，不是 **Build Variables and Secrets**。保存后点击 Deploy，使变量进入当前部署。`PROBE_BACKGROUND_THEMES` 默认已经包含全部九个内置主题，不需要背景的主题可从列表中删除。
   多组延迟默认已开启；调整组数、中文默认目标及国际候补，参见[首页卡片的多组延迟 / 丢包](#multi-ping-groups)。
   Durable Object 绑定和首次命名空间创建已经写在 `wrangler.jsonc`，构建部署时会自动完成，**不需要在 Dashboard 手动创建或开启 ProbeHub**。
5. 打开 Worker 地址，确认服务器列表、趋势图和实时更新正常。
6. 最后回到主控，开启"仅允许独立探针访问"。此后直接访问主控的探针接口会返回 `404`。

连接 GitHub 后，每次推送到 `main` 分支都会由 Workers Builds 自动构建和部署。

### 自动同步上游更新

fork 自带 `sync-upstream.yml` 工作流（纯 shell git 实现，零 action 依赖）：

- **自动**：每天北京时间 11:23 自动合并 `chnnic/jiwo-probe` 的 `main` 到你的 fork 并推送，推送触发 CF 自动构建部署。
- **手动**：fork 仓库 → **Actions → Sync upstream → Run workflow**（秒级同步）；或 GitHub 网页 **Sync fork → Update branch** 按钮。
- **前提**（公共 fork 需检查一次）：
  - **Actions 已启用**：fork 仓库 → Settings → Actions → General → 勾选 *Allow all actions and reusable workflows*（公共 fork 默认禁用定时任务）。
  - **Workflow permissions = Read and write**：同上页面，*Workflow permissions* 选 *Read and write permissions*，否则工作流推送会被拒绝。
  - 不要修改与上游冲突的文件；若有本地改动冲突，同步工作流会停止并列出冲突文件，需手动处理。

## Wrangler 命令行部署

1. 克隆项目并安装依赖：

   ```bash
   git clone https://github.com/chnnic/jiwo-probe.git
   cd jiwo-probe
   npm ci
   npx wrangler login
   ```

3. 在 Cloudflare Dashboard 的 **Settings → Variables and Secrets** 添加文本变量 `MMWX_ORIGIN`。地址必须是固定的 HTTPS 源站，不要包含路径或结尾斜杠。

4. 将主控生成的密钥保存为 Worker Secret：

   ```bash
   npx wrangler secret put PROBE_TOKEN
   ```

5. 构建并部署：

   ```bash
   npm run deploy
   ```

   `wrangler.jsonc` 会在首次部署时自动创建并绑定 ProbeHub Durable Object，已有部署者更新代码后执行同一条命令即可，无需额外开关。默认采用 3 秒采集；如需恢复 5 秒，在 Worker 运行时变量中设置 `PROBE_POLL_INTERVAL_SECONDS=5`，保存并部署即可。

5. 打开 Wrangler 输出的 `workers.dev` 地址，确认列表、趋势图和实时更新正常。最后回到主控，开启"仅允许独立探针访问"。开启后，未携带 Worker 密钥直接访问主控探针接口会返回 `404`。

### 绑定自定义域名

在 Cloudflare Dashboard 中进入 **Workers & Pages → jiwo-probe → Settings → Domains & Routes**，添加自定义域名。DNS、TLS 和 WebSocket 均由 Cloudflare 处理，无需修改前端代码。

## 本地开发

复制本地环境变量示例，填写主控地址和同一份访问密钥：

```bash
cp .dev.vars.example .dev.vars
```

在 `.dev.vars` 中填写：

```dotenv
MMWX_ORIGIN=https://panel.example.com
PROBE_TOKEN=主控生成的访问密钥
PROBE_POLL_INTERVAL_SECONDS=3
PROBE_NETWORK_SPEED_UNIT=bytes
```

「网络情况」默认复用节点卡片的字节网速格式，按 1024 进位，例如 `3 MB/s`；设为 `bits` 时按 1000 进位显示带宽单位。该配置同时控制展开数值、进度条刻度和折叠摘要，不改变节点卡片。修改 `.dev.vars` 后重启本地 Worker 并刷新页面；线上在 Worker 的 Variables and Secrets 中保存并部署后刷新页面。

分别启动 Worker 和 Vite：

```bash
# 终端 1
npx wrangler dev

# 终端 2
npm run dev
```

访问 `http://localhost:5173`。Vite 会把 `/api/*` 转发到本地 Worker 的 `8787` 端口。

## 常用命令

```bash
npm run dev        # 启动 Vite 开发服务器
npm run typecheck  # TypeScript 类型检查
npm run build      # 生成 dist 生产文件
npm run preview    # 本地预览生产构建
npm run deploy     # 构建并部署到 Cloudflare Workers
```

## 更新与密钥轮换

更新代码后执行 `npm ci && npm run deploy`。首次更新到带 ProbeHub 的版本时，Wrangler 会自动创建和绑定 Durable Object，无需手动配置；Cloudflare 网页部署同样会按仓库中的配置自动处理。轮换密钥时，先在主控生成新密钥，立即执行 `npx wrangler secret put PROBE_TOKEN` 并重新部署；在 Worker 更新完成前，探针可能短暂返回 `404`。主控只保存密钥的 SHA-256 哈希，无法找回旧密钥。

## 故障排查

- `503 Probe access secret is not configured`：尚未设置 `PROBE_TOKEN`。
- Worker 返回 `404`：Worker Secret 与主控生成的密钥不一致，或主控探针未启用。
- 页面无实时更新：检查 Cloudflare 与源站反向代理是否允许 WebSocket；页面会自动使用 HTTP 轮询。
- 想确认 ProbeHub 是否生效：检查 `/api/probe` 响应头是否为 `X-Probe-Source: hub`；`origin-fallback` 表示 Hub 当次异常并已自动直连主控。
- 3 秒采集使 PostgreSQL 压力偏高：将 Worker 运行时变量 `PROBE_POLL_INTERVAL_SECONDS` 设为 `5` 并重新部署，即可回到 5 秒采集。
- `MMWX_ORIGIN must use HTTPS`：生产源站不是 HTTPS。本地调试仅允许 `localhost` 或 `127.0.0.1`。
- 页面没有服务器：在主控探针设置中选择需要展示的服务器。
- Passkey 提示“本域名未被主控承认”：把探针完整 HTTPS 来源加入主控 `MMWX_WEBAUTHN_RELATED_ORIGINS`，重启主控后再试。

## 上游同步

本 fork 的功能基线已提升到上游 `e6f3a11`（2026-09-11）。`ab9233d` 至 `e6f3a11` 的外置探针 Passkey 登录、Premium 续费时间轴点击、移动端双行顶栏和白金三视图对比度修复已按本 fork 架构移植；Passkey Worker 只放行两条固定 POST 鉴权路径，不携带只读 `PROBE_TOKEN`。此前 `d706d7e`、`31f7a4b`、`bd651cb`、`f6fc04b` 的转发链网络状况能力也已移植：优先读取 WS `payload.forward`、HTTP 兜底、按服务器/转发链固定位置切换、浅色主题与布局抖动修复、按组切换的每日流量堆叠柱状图。`6221dd1` 的原始上下行趋势、计费口径工具、`traffic_stats_mode` 修正、服务器旗标和动态地区图同样已吸收；与本地九套主题、Ran/Premium 定制大面积冲突的结构性重构不会直接覆盖，而是逐项移植功能，避免界面回退。更早吸收：`8d82a8b` 移除登录；`ce624cf` twemoji 本地化（public/twemoji/ ~3650 个本地 SVG，零外部依赖）；`3ed41ca` Premium 黑金 PRO 主题；`be3d03c`（表格网速列纵向 + ping-pair 单列）经评估与 fork 三视图布局不兼容，跳过；`5ce90c0` 探针表格优化（表格流量列增强）；基线 `2dc05b3`（2026-08-10）。后续本地迭代：ProbeHub 全局连接聚合、流量计费口径 drawer、趋势弹窗三线切换与手机端免滚动撑满、卡片单向计费修正、白金水印等。若上游有更新，可手动合并（注意 `src/styles.css`、`src/types.ts`、`src/use-probe.ts` 有大量本地定制，合并可能冲突，需逐一确认）：

```bash
git fetch origin
git merge origin/main
```
