# Jiwo Probe（鸡窝状态站）

妙妙屋 X（MiaoMiaoWuX）独立服务器探针的**非官方魔改 fork**，基于 [mmwx-probe](https://github.com/mmwx-group/mmwx-probe)（功能基线 `e6f3a11`，2026-09-11；后续按本 fork 架构选择性移植。截至 2026-10-03，已接入主控多天历史、两年／三年／永久续费周期，并适配 Premium 白金可读性与筛选栏修复；保留 Jiwo 自定义布局与功能，不等同于完整合并上游）。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chnnic/jiwo-probe)

## 界面预览

> 截图全部使用**虚拟演示数据**（服务器名、服务商、价格均为虚构），由 `npm run screenshots` 生成，不连接任何主控。点击图片查看原图。

| LuminaPlus · 浅色 | LuminaPlus · 炭黑 |
|---|---|
| [<img src="docs/screenshots/luminaplus-light.png" alt="LuminaPlus 浅色" width="100%">](docs/screenshots/luminaplus-light.png) | [<img src="docs/screenshots/luminaplus-dark.png" alt="LuminaPlus 炭黑" width="100%">](docs/screenshots/luminaplus-dark.png) |
| **LuminaPlus · Paper** | **Lite · 浅色** |
| [<img src="docs/screenshots/luminaplus-paper.png" alt="LuminaPlus Paper" width="100%">](docs/screenshots/luminaplus-paper.png) | [<img src="docs/screenshots/lite.png" alt="Lite 浅色" width="100%">](docs/screenshots/lite.png) |
| **Premium · 黑金** | **Premium · 白金** |
| [<img src="docs/screenshots/premium.png" alt="Premium 黑金" width="100%">](docs/screenshots/premium.png) | [<img src="docs/screenshots/premium-platinum.png" alt="Premium 白金" width="100%">](docs/screenshots/premium-platinum.png) |
| **Lumina** | **Glassmorphism** |
| [<img src="docs/screenshots/lumina.png" alt="Lumina" width="100%">](docs/screenshots/lumina.png) | [<img src="docs/screenshots/glassmorphism.png" alt="Glassmorphism" width="100%">](docs/screenshots/glassmorphism.png) |
| **Emerald** | **岚 · Ran** |
| [<img src="docs/screenshots/emerald.png" alt="Emerald" width="100%">](docs/screenshots/emerald.png) | [<img src="docs/screenshots/ran.png" alt="Ran" width="100%">](docs/screenshots/ran.png) |
| **经典 · 扁平（浅色）** | **手机端 · LuminaPlus Paper** |
| [<img src="docs/screenshots/flat.png" alt="经典扁平主题" width="100%">](docs/screenshots/flat.png) | <p align="center"><a href="docs/screenshots/mobile-luminaplus.png"><img src="docs/screenshots/mobile-luminaplus.png" alt="手机端 LuminaPlus Paper" width="220"></a></p> |

与原版的差异（定制增强）：

### 解锁排行（2026-10-04）

- 经典界面「多维榜单」新增「解锁」标签页，Emerald 侧栏新增「解锁排行」面板
- 与主控解锁徽标同一口径：按已解锁项数排名，同数量比解锁率；仅自制剧算解锁，检测失败不计入分母，无检测数据的节点不参与排名。经典界面可展开查看流媒体 / AI / 交易所 / 其他各分类解锁数，Emerald 在副标题显示分类明细
- 排名逻辑为共用的 `rankUnlocks`（[`src/leaderboards.ts`](src/leaderboards.ts)），两处界面一致

### 岚 · Ran 中文界面（2026-10-04）

- Ran 全部页面（总览 V1/V2、节点、驾驶舱、流量、账单、地图、节点抽屉、访客信息浮卡等）显示为中文；CPU、RAM、TCP、UDP、IP、UUID、单位、主题名与面板编号（如 `H01`、`CON · 10`）保留原样
- 词典集中在 [`src/ran/i18n/zh.ts`](src/ran/i18n/zh.ts)（精确词条 + 带数字的模板），由 `translate-dom.ts` 在渲染后替换文本与 `title` / `placeholder` / `aria-label`，原版组件源码不改，便于同步 Komari-Ran-Theme；独立地图页 `map.html` 同样生效
- 短中文标签自动不换行，避免窄方框里被挤成竖排；配色变体按钮显示中文名（夜、雾、烬……）
- 浏览器 `localStorage` 设 `ran-lang=en` 可切回英文原版

### 转发链状态总览（2026-10-04）

与主控转发链列表、主控 CSS 同一口径，基于接口已下发的数据增强各主题共用的转发链视图（Premium 保留自己的转发页）：

- **状态汇总**——标题栏显示「共 N 条 · 正常 · 偏慢 · 异常」；全部链路以卡片列出，异常置顶、偏慢其次，卡片按状态描边并写明原因（如「入口组 1/4 台探测异常」「中转组无可用服务器」）
- **判断口径**——无有效延迟、入口或中转组无可用服务器、丢包 ≥ 50% 为异常；部分服务器探测异常、端到端 ≥ 160 ms、丢包 ≥ 5% 为偏慢。出口组不探测下一跳，不计入健康判断。延迟色阶沿用上游 Premium（<80 / <160 / ≥160 ms）。规则在 [`src/forward-model.ts`](src/forward-model.ts)
- **拓扑着色**——组框显示「可用台数」并按状态描边，组间连线按延迟着色并标注毫秒，组内无可用服务器时显示红色虚线「中断」；手机端改为竖排，连线变为左侧竖条
- **流动连线与实时网速**——组间连线显示沿转发方向流动的光点：速度按到下一组的延迟，密度按本组服务器的实时流量（来自快照的上下行），无流量时只留轨道，中断时红色虚线闪烁；拓扑中每台服务器下方显示实时 ⇅ 网速（悬停看上下行）。系统开启「减少动态效果」时停止动画
- **链路卡片状态条**——每张卡片底部一排色块，每格一个 5 分钟探测段（正常 / 偏慢 / 异常 / 无数据），悬停看当时延迟与丢包，不用展开即可看出何时抖动
- **选路段**——主控 v0.5.6-beta.4 起（#1136）接口下发 `routes` / `route_hop` / `route_policy` / `failover_ms`：分叉处并列各条路（绕经的组或直连、到出口延迟、丢包），在用的路高亮流动并标出哪几台在走，备用路变淡；入口成员标出当前走的路，服务器显示逐台丢包。旧版主控不含选路结构时，连续多个中转组仍提示可能是并行路线、端到端按各段相加可能偏高
- **延迟与丢包同图**——端到端趋势图左轴为延迟（ms），右轴为丢包率（%，至少显示到 10%），红色虚线为每 5 分钟一段的丢包，悬停同时显示两项，便于看出丢包何时开始、何时恢复
- **7 天流量**——展示接口一直下发但此前未使用的 `traffic`：每日合计柱状图与流量最多的 3 个节点；点击某天的柱子查看当天合计与各节点（入口 / 中转 / 出口及所属组）用量，再点一次或点「返回 7 天汇总」恢复，切换链路时自动回到汇总
- **放在页首、默认折叠**——经典界面位于「地区分布 / 多维榜单」下方；LuminaPlus、Lite、Glassmorphism 位于概览下方；Emerald 位于左列概览下方（窄屏排在多维榜单之后）。折叠时标题栏仍显示状态汇总，访客展开或折叠后记在本浏览器
- **深色可读性**——转发链与连接数历史的文字色改读 `--foreground`，修复 Lumina 黑金及经典主题深色模式下文字为深蓝、看不清的问题

### 加载速度与实时连接（2026-10-03～04）

- **首屏更轻**——趋势图、服务器详情、转发链视图（recharts）与经典主题回程勋章动画（lottie）改为用到时加载，首屏数据渲染后在浏览器空闲时预取；首屏 JS 从约 331 KB 降到约 120 KB（gzip）。入口统一在 [`src/deferred.tsx`](src/deferred.tsx)，测试会拦截首屏重新静态引入这两个库
- **静态资源长缓存**——[`public/_headers`](public/_headers) 让带内容哈希的 `/assets/*` 缓存一年（`immutable`），表情、字体、解锁图标缓存 7 天
- **实时推送只发变化**——ProbeHub 对声明 `/api/stream?delta=1` 的连接发送增量帧：解锁、回程、日流量与每条延迟线路的历史桶只传「不变 / 换最后一项 / 左移一格」，其余字段照常完整发送。线上 56 台实测每帧 472 KB → 约 112 KB（压缩后 57 KB → 18 KB）。新连接总是先收完整帧；旧页面与主控直连兜底仍收完整帧。编解码见 [`src/probe-delta.ts`](src/probe-delta.ts)
- **后台暂停**——页面在后台超过 1 分钟即断开实时连接并停止轮询，避免遗忘的标签页让 ProbeHub 一直拉取主控；回到前台立即补帧并重连
- **断线自动重连**——WebSocket 断开后按 2 / 5 / 15 / 30 秒退避重连，期间以 HTTP 轮询兜底，连上后自动停止轮询
- **主控断联提示**——连接出错且数据超过 20 秒未更新时，经典界面各主题顶部提示「主控连接中断，正在显示 N 分钟前的数据，自动重试中」，恢复后自动消失（Ran 保留自身连接状态）
- **减少动态效果**——系统开启「减少动态效果」时，许可证铭牌直接显示静态终态

### 统一新版 Premium 地球仪（2026-10-02）

- 所有已有地球视图统一复用上游 `7d8d8ef` 的 Premium 地球组件：Premium、Glassmorphism、Emerald 和通用主题不再各自保留旧版渲染器。原本没有地球的主题不新增地球入口。
- 地区标签按真实经纬度排布，拖动时随地球重新定位；背面地区降亮度，标签限制在视口内。保留轨道流动光点、地区高亮与服务器数量，以及各主题的明暗配色和主控 `show_globe` 开关。不改许可证、卡片与历史数据。

### 主控连接数折线与转发链（2026-10-01）

- 主控「连接数折线图（TCP / UDP 近 1 小时）」开启后，首页卡片读取快照中的 `conn_history`，显示 TCP / UDP 同轴小折线。12 个五分钟均值从旧到新排列，悬停或键盘左右键可查看整数显示的均值；缺失桶断开，不补零。字段未下发时不显示小折线；空历史显示等待采样，不伪造数据。
- 点击小折线打开主控连接数历史，支持主控开放的 1 小时至多天范围。首页不新增逐卡轮询，也不再进行当前会话采样。Ran 保持原样；列表和普通极简行保持紧凑布局。
- **CF 独立显示开关**：Worker → 设置 → 变量和机密（运行时）中的文本变量 `PROBE_SHOW_CONNECTION_CHART`，`true` 开启（默认）、`false` 关闭。关闭只隐藏所有已支持主题的首页 TCP/UDP 小折线及其点击入口，TCP/UDP 数字、二级详情历史、转发链和主控采集不变。开启仍须主控下发 `conn_history`，不会伪造曲线。保存并部署后刷新页面生效；也支持 `1` / `0`、`on` / `off`、`开启` / `关闭`，英文忽略大小写，未设置或非法值回退开启。`npm run deploy` 会自动创建缺失的 CF 设置项，后续部署保留已设置的值（包括 `false`）。
- 「转发链拓扑与延迟」跟随 `show_forward`，读取快照的 `forward` 数据。经典主题、Lumina、LuminaPlus、Lite、Glassmorphism、Emerald 在节点列表下方提供可折叠区域，支持选择链路、查看入口／中转／出口拓扑、节点健康状态、组间与端到端延迟、丢包及趋势。Premium 保留网络视图内的转发链页面；Ran 不变。

### 视图模式（三套，一键切换）

- **极简卡片模式**（`Rows3` 图标）——单行扁平卡，状态点 + 旗帜 + 名字 + 核心指标，手机一屏看 20+ 台服务器（普通卡片模式仅 ~4 台）
- **极简卡片展开模式**——再点一下极简卡片图标，卡片变高为 **3 行信息**：
  - 第一行：状态点 + 旗帜名字 + 在线/离线 + 到期天数
  - 第二行：CPU / 内存 / 硬盘 / 流量 + 续费价格
  - 第三行：平均延迟 + 丢包率 + 实时上下行速度 + **三网回程线路**（无回程数据自动隐藏，`Unknown` 运营商自动过滤，CN2 GIA / 9929 / CMIN2 等优质线路金色高亮）
  - 展开状态持久化，刷新后保持
- **卡片模式**——带 Ping 趋势、回程勋章、到期续费链接的完整卡片
- **列表模式**——可排序表格（CPU/内存/流量/延迟等列点击排序），带迷你趋势按钮

### LuminaPlus（独立主题）

Lumina 的普通浅色／暗色使用 Claude Paper 纸面布局与莫兰迪配色：米灰／灰炭底色，雾蓝流量柱，鼠尾草绿、灰紫和柔陶粉资源条；异常提示保留绿／黄／红语义，文字采用更深或更亮的同色系保证可读性。主控仍填 `lumina`，用现有配色按钮切换；黑金、白金保持原样。样式与版本日期见 [lumina-paper.css](src/lumina-paper.css)，不改变卡片布局、监控数据或许可证动画。

除 Ran 外，主题切换使用统一的双列色标面板：调色盘和展开箭头固定位置，各主题保留自己的配色。普通高度下完整显示全部主题，低矮窗口才滚动；支持方向键、Home/End、Enter 选择和 Esc 关闭，手机菜单自动避开屏幕边缘。Ran 的主题菜单保持原样。

参考 [Komari-Theme-LuminaPlus](https://github.com/shanyang242/Komari-Theme-LuminaPlus) 的圆角卡片、彩色分段资源条与网速排版，使用 Jiwo 已有数据接口实现；不替换 Lumina、Lite 或其他主题。来源与 MIT 声明见 [NOTICE](src/luminaplus/NOTICE.md)。

- 主题菜单仍选择 **LuminaPlus**，内部包含 **Light（原浅色）／Carbon（炭黑）／Paper（陶纸暖纸）** 三套配色，不增加独立主题。页首单个配色图标按浅色 → 炭黑 → Paper → 浅色循环，悬停可查看当前及下一套名称；浏览器独立记忆 `jiwo-luminaplus-color-mode`，不改变其他主题的明暗选择。
- 主控填写 `luminaplus` 自动明暗（北京时间 06:00–18:00 浅色），`luminaplus-light` / `luminaplus-dark` 固定明暗，**`luminaplus-paper` 固定 Paper 暖纸配色**，名称忽略大小写。访客手动配色优先；在 LuminaPlus 的主题菜单选择「跟随主控」可同时恢复主控主题与配色。Paper 使用米白背景、暖白实色卡片、陶土强调色与低饱和资源条；布局、脉冲、详情、排行榜和许可证不变。
- **大卡片 / 小卡片 / 迷你卡片 / 列表** 四种独立布局，以四个图标切换，浏览器独立记忆；旧 `card` 选择自动兼容为 `large`，不覆盖其他主题的偏好。支持搜索、在线／离线／临期、服务商与排序。大卡片在视口宽度 ≥1540px 时显示四列，较窄屏幕自动变为三／二／一列；迷你卡片宽屏最多五列，手机单列。
- 首页以四张概览大卡片显示在线节点、实时带宽、周期流量、资产概览，并支持独立地区筛选。资产按主控换算后的人民币优先汇总，无汇率时分币种列出，不直接相加；剩余价值按真实价格、周期与到期日估算，缺少价格或期限不会补零。
- 点击首页「实时带宽」卡片打开实时速度排行榜小窗，默认按上行 + 下行合计降序，也可切换上行／下行排序；只纳入在线且有对应有效数据的节点，不将未上报当成零。排名复用当前快照与全局速度单位，点击节点进入对应详情；鼠标或键盘操作榜单时保持当前顺序，避免刷新时点错节点，移出后恢复实时排序。
- 点击首页「周期流量」卡片打开同款排行榜，默认按主控计费用量降序，可切换本周期上行／下行；包含有已上报用量的离线节点，缺失不补零。计费排名使用 `traffic_used`（兼容 `traffic_used_total`），不重新相加上下行、不对单向计费乘二、不混用网卡累计或七日流量；流量单位固定为 B／GB／TB 等，不受 bits／bytes 网速单位设置影响。每行注明计费周期与口径（各节点周期可能不同），点击进入对应服务器详情。
- 大卡片展示 CPU、内存、磁盘、负载、网速、周期流量、计费额度、TCP/UDP、多组延迟／丢包、回程与续费；压缩区块留白，金额放入顶部标签栏，移除与资源说明重复的底部硬件标签，保留底部运行时间／到期日期／剩余天数。小卡片采用连续四栏信息区：**实时速率／周期流量／剩余天数与费用／TCP、UDP**，运行时间放在额度区，日期可在剩余天数提示及详情中查看；不重复添加费用标签或底部到期栏。迷你卡片采用独立密集布局，只展示一组平均延迟／丢包，不改写其他模式已保存的测试目标；保留资源、网速、周期流量、TCP/UDP、三网回程、费用及到期信息。列表保留核心资源、网速、连接数和平均延迟。卡片名称进入六标签详情，解锁按钮保留官方品牌图标。
- 四种视图的图表按钮均打开**流量悬浮小窗**：顶部显示今日总流量／上行／下行，底部仅展示今天及前六天的日流量柱图，可悬停、点击或键盘选择日期查看上下行明细。电脑悬停预览、点击固定，手机点击打开；点击外部或按 Esc 关闭。复用快照中的 `daily_traffic`，不新增请求；普通日记录按浏览器本地日期选取，Worker 累计流量估算记录沿用 UTC 日期并标明估算。未上报保留空白，真实零正常显示，不拿历史末日冒充今天。
- 详情复用 Jiwo 已有的概览／延迟／系统／流量／回程／解锁功能和每月每 TB 费用，独立配色。各标签按最高内容统一高度，超出屏幕时滚动整个浮层，没有卡片内部滚动条。
- 网速跟随全局 bits／bytes，延迟跟随 `PROBE_PING_*`。只读取现有 API，不新增轮询、检测或 CF 变量。没有数据时显示 `—`，真实零值保留；计费用量采用主控口径，不对单向流量乘二。重置时间只取流量周期结束日，不从续费到期日推算。
- 首页概览和四种显示模式的上下行数值，按原版的 B/s／KB/s／MB/s／GB/s 四档显示绿／金／橙／红色（1024 进制阈值）；切换 bits／bytes 不改变同一实际速度的颜色。TCP、UDP 均带图标，继续区分真实零和未上报。
- 页首采用 Lite 式紧凑布局，仅保留登录、主题选择、单个明暗切换按钮，手机下标题与操作区保持单行，过长标题省略。未手动覆盖时仍按主控主题名的默认明暗规则显示。四种显示模式使用图标按钮，保留悬停名称、键盘操作和选中状态。LuminaPlus 与 Lite 的详情页「系统」提供 TCP／UDP 双线图，直接读取主控 `probe-series?metric=system` 返回的 `tcp_connections`／`udp_connections` 历史，与 CPU／内存／网速复用同一次请求。基础范围为 1／6／24 小时，主控下发 `history_days` 后自动增加可用的多天范围（最多 7 天，详见下方「主控多天历史」）。连接数显示时四舍五入为整数，原始历史精度不变；刷新后重新读取主控历史，**不再使用浏览器当前会话采样**。缺失数据和缺桶保留空档，真实零正常展示，不新增后台请求或本地持久化。需要主控 v0.5.5-beta.12 或更新版本并开启连接数采集；多天保留需支持 `history_days` 的新版主控（如 v0.5.5）。旧主控或未上报时显示暂无历史，不用实时值伪造曲线；升级后历史需逐步积累。
- 大卡片在上下行速度下分别显示原版风格的脉冲点，小卡片在两行速率下显示一条上下行合计脉冲：仅记录本次页面实际收到的最近 18 个速度快照，颜色与大小跟随真实速率；任一方向未上报时合计点留空，离线停止显示实时状态，不用随机动画、补零或插值伪造变化。它不是历史曲线；TCP/UDP 等详情历史仍来自主控。滚动时延后 LuminaPlus 卡片快照更新，停止约 160ms 后显示最新快照；不改变共享采集频率或增加请求。
- 卡片始终保留电信／联通／移动三格回程，缺失线路保持 Unknown；三组延迟、四类解锁／金色全解锁、TCP/UDP 图标与历史、全局速度单位、原币续费及每 TB 费用继续使用 Jiwo 现有实现。没有 V4/V6 状态或自定义套餐标签时不伪造，硬件标签仅使用真实配置。
- `v0.3.7` 增加独立 Paper 配色开关；保留 `v0.3.6` 周期流量排行榜与实时速度排行榜。许可证仍放在整页内容最下方（与 Premium 一致，不悬浮遮挡卡片）；旁边的动画开关默认开启，浏览器独立记忆 `jiwo-luminaplus-license-anim`，关闭后停止动画并完整显示静态铭牌，保留原有许可证内容和样式。手机许可证单行横滑，开关独立占位；其他主题的位置与动画设置不变。样式版本与日期标记在 [luminaplus.css](src/luminaplus/luminaplus.css) 顶部。

### Lite（独立主题）

借鉴 [tz.8787.de](https://tz.8787.de/) 的紧凑信息布局，使用 Jiwo 自己的数据接口和组件实现，不复制站点数据或品牌素材，也不替换已有主题。

各主题现有的 TCP／UDP 连接数展示统一使用连接／网络图标；保留原来的配色、位置和零值／缺失值规则，不调整许可证信息。

- 从右上角主题菜单选择 **Lite**；主控主题名填 `lite`（北京时间 06:00–18:00 浅色，其余深色），`lite-light` / `lite-dark` 可固定明暗。前端选择“跟随主控”时接收主控主题，手动配色优先。旧 `mini` 配置和浏览器选择自动兼容。卡片、详细、列表三种视图独立记忆，不影响其他主题的视图偏好。
- 顶部四块概览展示在线节点、实时上行、实时下行、已用流量；支持搜索、在线／离线／临期筛选、服务商筛选及资源／延迟／到期排序。临期包含已到期和未来 30 天到期的节点。
- 卡片保留 TCP/UDP、解锁检测和 Passkey 登录；卡片视图只显示一组平均延迟与丢包，详细视图保留多组延迟目标选择，切换不改动已保存的目标。点击节点名称进入 Lite 独立详情页。详细视图以三列摘要展示周期上下行流量、剩余天数与到期日期、续费价格，并保留三网回程。
- Lite 的详情页采用六项标签切换：**概览 / 延迟 / 系统 / 流量 / 回程 / 解锁**，默认概览，只展示当前项目。概览顶部 CPU、内存、硬盘、平均延迟以单行四列紧凑展示，窄屏保持四列；下方保留续费、每 TB 费用和 TCP/UDP。解锁独立展示流媒体、AI、交易所、其他分类与数量，无需再次展开。六页按最高内容统一外框高度，没有内部滚动区或滚动条；超过屏幕时整张详情上下滑动，内容不裁切。其他主题不变。
- 延迟页提供目标标签多选、全选／全不选、延迟／丢包切换和各目标数值；系统页展示 CPU、内存、下行／上行速度和 TCP／UDP 四张趋势卡片，全部读取主控历史。两页支持 1／6／24 小时及主控允许的多天范围，图表自动适应宽度；网络速度跟随全局 bits／bytes 设置。系统信息仍在概览，缺失数据不补零。
- 网速跟随 `PROBE_NETWORK_SPEED_UNIT`；延迟组数和默认目标跟随现有 `PROBE_PING_*` 设置。仅消费现有快照，不新增轮询。
- 默认使用纯色面板、浅色进度条和轻量静态阴影，不使用卡片毛玻璃。TCP / UDP 分别采用上行绿色 / 下行蓝色，字号与字重跟随网速。**Lite 不显示许可证信息、名牌或许可证动画**；其他主题的许可证保持原样。若需要给 Lite 设置自定义背景，请在 `PROBE_BACKGROUND_THEMES` 中显式加入 `lite`（旧 `mini` 名单保持兼容，默认名单不包含 Lite）。

### 主题系统（一键切换）

- **Ran 主题**（第 6 主题）——**完整复刻 Komari-Ran-Theme「岚」**（精密金工质感，原版整体移植 + 数据适配层，非换皮）：
  - 完整界面：Sidebar 导航（Overview / Nodes / Hub / Traffic / Billing / Geo Map）+ Topbar（⌘K 搜索 / V1·V2 布局切换 / 主题下拉）+ Footer
  - V1 经典卡片网格 / V2 信息盘式仪表盘（Cluster Health Score、24h 吞吐大图、Top Talkers、Alerts/Incidents 面板）
  - HeroStats 顶部 4 大数（在线 / 上行速率 / 下行速率 / 累计流量，带 sparkline）
  - 节点卡：金工质感全套（双 hairline 倒角、凹陷读数窗、蚀刻铭牌字、BlockMeter 分段条、状态扫光），出站/入站显示**当前周期流量**（周期上行/下行，物理口径）
  - NodeDetail 详情页、Traffic 全网流量、Billing 订阅汇总（月成本 / 年估算 / 到期提醒 / 多币种 + 汇率）、访客信息浮卡（每会话一次）
  - **10 个主题变体**：墨石深（night）/ 雾色浅（mist）/ 烬枣红（ember）/ 樱粉（sakura）/ 薰衣草（lavender）等，右上角切换
  - 懒加载分包（Ran 独立分包，不增加其他主题的首屏体积），访客接口走 CF 请求头（零第三方依赖）
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
| `emerald` | Emerald 整页主题 |
| `lite` / `lite-light` / `lite-dark` | Lite 自动明暗 / 固定浅色 / 固定深色 |
| `luminaplus` / `luminaplus-light` / `luminaplus-dark` | LuminaPlus 自动明暗 / 固定浅色 / 固定深色 |
| `luminaplus-paper` | LuminaPlus 内的 Paper 陶纸暖纸配色（固定，不随时间变暗） |
| 其他自定义名 | 经典界面 + `theme-{name}` 类（站长自写 CSS 接管） |

> **auto 模式**：主控**不写明暗后缀**（如 `glassmorphism`、`pixel`、`flat`、`anime`、`glass`、`premium`、`lite`、`luminaplus`）默认进入 auto——按北京时间自动切换（6:00–18:00 浅色/白金，夜间深色/黑金；premium 为白金↔黑金、glassmorphism 为白色↔黑色）。访客手动明暗选择优先；Lite 使用单个太阳／月亮按钮，LuminaPlus 使用太阳／月亮／纸卷图标切换原浅色、炭黑、Paper 三套配色，其他主题保留各自的配色控件。

> 主控主题名仅允许字母、数字、下划线、连字符（≤64 字符），上表均为合规写法。所有内置主题、明暗后缀和 Ran 变体均忽略大小写，例如 `LuminaPlus`、`LUMINAPLUS`、`luminaplus` 等效；浏览器保存的内置主题选择也统一归一化。未知自定义主题仍保留原名，避免破坏站长现有的 CSS 类名。

主题选择优先级：**访客手动选择（浏览器记忆）> 主控下发 > 默认**。要让主控设置生效，请先在探针主题菜单选择 **跟随主控**。探针实时监听主控下发（WS/轮询新帧），切换无需刷新页面。
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

#### 全局网速单位（Ran 除外）

默认使用 **bits**（bps / Kbps / Mbps / Gbps），也可统一切换为 **bytes**（B/s / KB/s / MB/s / GB/s）。适用于 pixel、flat、anime、glass、lumina、glassmorphism、emerald、premium 八个主题中的实时网速显示，包括网速概览、卡片、迷你/列表视图、网速榜单、二级详情页，以及网速历史图表的提示。**Ran 完全保持原样，不跟随这项设置。**

| CF 运行时变量 | 默认值 | 可选值 |
| --- | --- | --- |
| `PROBE_NETWORK_SPEED_UNIT` | `bits` | `bits` 或 `bytes`（不区分大小写） |

使用 `npm run deploy` / `./scripts/deploy.sh` 时，会自动创建缺失的 `PROBE_NETWORK_SPEED_UNIT=bits` **Text 变量**；后台已设为 `bytes` 时，后续更新不会覆盖。该项和三项延迟配置使用同一个部署流程，但彼此独立。默认值集中在 `src/network-speed.ts` 的 `DEFAULT_NETWORK_SPEED_UNIT`。

修改路径：**Cloudflare → Workers & Pages → 你的 Worker → Settings → Variables and Secrets → `PROBE_NETWORK_SPEED_UNIT`**，将值改为 `bytes` 或 `bits`，**保存并部署后刷新探针页面**。不要填到 Build Variables 中。直接运行 `npx wrangler deploy` 也会使用代码默认值，但不会自动补出后台设置项。

这只是显示单位切换，不改变原始采集值、刷新频率或排序：原始网速始终是字节/秒，bits 显示时乘以 8、按 1000 进位，bytes 沿用 1024 进位。**累计/周期/每日流量仍显示 GB/TB，内存和磁盘容量也不受影响。** 未设置、留空或填入无效值时回退到 `bits`。

#### 连接数与解锁检测

pixel、flat、anime、glass、lumina、glassmorphism、emerald、premium 八个主题接入主控的新字段；Ran 本轮保持不变。无需新增 CF 变量或访问密钥，也不会额外发起检测或提高刷新频率。

- **TCP / UDP**：首页卡片显示整机连接数，沿用各主题配色。像素、扁平、动漫、玻璃与 Lumina 卡片将下行、上行速度放在左侧，同一行右侧分为 `TCP 数量`、`UDP 数量` 两组并留出间距。Lumina 去掉速度旁的周期流量，今日流量与剩余额度保留。Glassmorphism、Emerald 将第三个到期/剩余价值小格替换为上下两排 TCP、UDP，并移除重复连接数行；页首总剩余价值和二级详情页保持不变。Premium 与极简卡片保留独立连接数行。TCP 是整机 `ESTABLISHED` 连接数，UDP 是整机 socket 数，**不是代理用户数**；真实零显示 `0`，旧版主控未上报显示 `—`。复用现有快照，不新增请求或提高刷新频率。
- **TCP / UDP 榜单**：通用主题与 Emerald 的多维榜单新增两个独立维度，默认连接数从高到低排序；未上报或无效数值不参与排名，真实零保留，离线节点使用最近上报值。通用榜单可再次点击当前维度切换升降序；Emerald 支持从前三名展开全部节点。榜单优先展示实时网络、流量与连接数，再展示网络质量、资源占用和资产信息。Glassmorphism、Premium 本轮不新增多维榜单模块，Ran 不变。
- **解锁检测**：有数据的首页节点显示小锁按钮，点击后按“流媒体 / AI / 交易所 / 其他”查看服务、状态和地区。交易所包含 **Bybit、Binance、OKX**，使用本地官方品牌图标；OKX 是信息查询，成功时直接显示地区，缺少地区显示 `—`，不会误标为“已解锁”。二级详情页的解锁区域默认折叠，折叠栏显示四类的「已解锁数/检测服务数」（无检测结果显示 `—`），点击标题展开/收起；首页弹窗仍直接展示结果。手机可直接点击，不依赖悬停；弹窗沿用主题配色，不新增毛玻璃层。
- **主控新版统计口径**：`yes` 与 `originals_only` 均计为已解锁，包括地区、CDN、Steam 货币等信息查询成功项。总徽标和面板总计的分母排除 `failed` 及未知状态，单独提示失败数；`no` / `banned` 是有效未解锁结果，仍计入分母。分类按钮与折叠栏的分母保留所有返回项（包含失败项），因此四类分母之和 = 总计分母 + 失败数。单项失败结果始终保留，不隐藏。
- 首页锁图标有效结果全部解锁为金色、部分解锁为绿色、零解锁为灰色。例如 24 项中 23 项成功、1 项检测失败，显示金色 `23/23` 并提示 `1 项检测失败`；全部检测失败的 `0/0` 不算全解锁。无数据时不显示按钮。兼容旧主控缺少交易所的情况及旧版 Spotify 检测。
- 四个解锁分类按内容最多的分类（通常为流媒体）的完整高度统一占位，取消列表内部滚动；切换分类不会移动分类按钮。首页弹窗与展开后的二级详情页统一生效，窄屏分类名称与数量上下排列，四个标签仍在同一行；矮屏仍可滚动外层窗口查看完整内容。
- 数据来自主控上报的 `unlocks` 最近检测结果，不是实时发起测试。无数据时首页不显示按钮，详情显示等待上报；请先在主控启用相应检测并等待结果。

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
- **多维榜单**——18 个维度 Top 10，按优先级排列：实时速度 → 今日流量 → 流量 → 流量使用率 → 近7日流量 → TCP 连接数 → UDP 连接数 → 内地丢包率 → 海外丢包率 → 内地延迟 → 海外延迟 → CPU → 内存 → 负载 → 磁盘 → 在线时长 → 到期时间 → 月成本。默认打开实时速度；Twemoji 国旗，前三金银铜徽章，点击当前维度切换升降序，到期时间默认升序（最快到期在前）。Emerald 对应顺序为：实时网速 → 流量消耗 → TCP 连接数 → UDP 连接数 → 网络质量 → 在线时长。
- **榜单明细展开**——内地/海外延迟与丢包率维度，点击行尾箭头展开查看该节点每条线路的具体值（延迟 ms / 丢包率 %，超时与无数据区分显示）
- **搜索框**——按名称 / 地区 / 服务商即时过滤节点
- **地区筛选下拉**——自定义组件，Twemoji 旗帜图片渲染（原生 `<select>` 在 Windows 下旗帜会显示成字母）
- **地区分布折叠卡**——按地区聚合，全球 SVG 分布图
- **资产总揽**——总剩余价值 / 月均成本 / 覆盖台数（按剩余天数折算，共享同一套算法），大数字垂直居中 + 左右分布
- **服务器详情页**（hash 路由）——剩余价值、负载三值、上行/下行速度对称布局、到期与续费信息、回程线路、延迟/丢包率/日流量/负载趋势图、省市区展示；**健康分徽章**（头部在线状态旁：评分 · 等级，绿=健康/红=告警，悬停显示扣分原因——CPU/内存/硬盘压力、延迟、丢包、流量额度、到期时间综合评分；**跟随主控 `show_health_score` 开关，主控开启才显示**，经典详情页与金工 Premium 卡片/drawer 三处统一受控）；**趋势图鼠标跟随 tooltip 深色化**（跟随主题表面色 `--surface`，黑金/暗色下深底金字，浅色主题保持白底）
- **系统历史曲线**——通用二级详情页（像素、扁平、动漫、玻璃、Lumina、Glassmorphism、Emerald）的趋势栏提供「CPU」「内存」「TCP/UDP」：连接数以 TCP／UDP 双线显示，支持分别隐藏曲线、主控允许的小时／多天范围与缩放适应。直接读取主控 series `metric=system`，连接数显示时四舍五入为整数，原始桶平均精度不变，缺失不补零；未配置 Ping 的服务器也可查看。Lite、LuminaPlus 保留「系统」页中的连接数双线图。
- **主控多天历史**——通用趋势弹窗、详情趋势、Lite／LuminaPlus 延迟与系统页、Premium 网络历史共用范围规则：保留 1／6／24 小时；根据 `/api/probe` 的 `history_days`（1–7）增加不超出保留期的 3 天、7 天及实际配置天数。例如设为 5 天显示 1h／6h／24h／3d／5d，设为 7 天显示 1h／6h／24h／3d／7d。旧主控缺省为 1 天，不主动请求多天。桶宽优先取 API 的 `bucket_sec`，后备分别为 5／10／30 分钟、2–3 天 1 小时、4–7 天 2 小时；多天横坐标显示日期。无需新增 CF 变量，历史不足保留空档，不拼接浏览器采样、不增加后台采集频率。Ran 保持原样。
- **续费与剩余价值**——支持月／季／半年／年／两年／三年，月均成本分别按 1／3／6／12／24／36 月折算，剩余价值按日成本 × 剩余天数估算（含当天口径），保持已有多币种规则。`permanent` 显示「永久」和买断价格，不进入临期／逾期、续费时间线或月续费预算；不推算剩余价值，每月每 TB 费用显示不适用。即使永久服务器带有旧到期字段也忽略。Ran 适配层未改动。
- **三许可证铭牌底栏**——手机端单行横滚，不占空间
- **主控周期字段全面接线**——`traffic_used_up/down`（周期上下行，物理口径，up+down=total 与 daily_traffic 逐日求和精确一致）、`traffic_used_total`（周期总流量，重启不清零）、`period_start/end`（计费周期边界）：卡片/Lumina 卡周期上下行直读物理口径、详情页累计流量改周期统计、Lumina 卡剩余流量后显示重置倒计时 + 重置日
- **表格流量列增强**——列表视图流量格显示 `↑ 上行 · ↓ 下行`（周期物理口径）+ 周期区间（MM-DD — MM-DD），点击弹出日流量趋势图
- **原始上下行日流量趋势弹窗**（照上游 `6221dd1` 重做）——标题/合计/计费说明齐全：**当前周期 / 最近 7 日** 范围切换 + 周期原始合计 + 计费口径说明（"卡片按 XX 计费（公式）"）；图表内**总流量 / 上行流量 / 下行流量**三线独立切换（与二级详情页一致），缩放/适应宽度按钮；手机端弹窗撑满屏幕（`max-height: 100dvh`）+ 图表弹性高度（`min(42vh, 300px)`），三线按钮与缩放按钮免滚动直接可见、缩放按钮 34px 加大便于点击
- **流量计费口径面板**（premium drawer 照主控实测）——本周期计费用量（`traffic_used` 计费口径）/ 计费口径（系统网卡·Xray 节点 × 上行+下行/仅上行/仅下行/取较大值）/ 原始周期 上下行 / 对账调整 / 对账公式（总量 − 调整 = 计费用量）/ 计费周期 / 本次开机网卡，黑金白金双适配
- **单向计费修正**——premium 卡片/计费面板统一优先 `traffic_used`（计费口径）而非 `traffic_used_total`（双向物理值）：`traffic_stats_mode = upload/download/max` 的单向计费机器（如 GoMami 仅上行）不再显示翻倍流量；计费口径 mode 取值统一为上游 `upload / download / max`（`traffic-display.ts` 工具）
- **bytes 格式化去冗余 .0**——`1000.0 GB` → `1000 GB`（含四舍五入后恰为 X.0 的值），非整数精度不变

### ProbeHub 主控降载

- **全局单采集器**——使用固定名称的 Cloudflare Durable Object 聚合所有访客连接；无论同时打开多少页面，主控正常情况下只承受一个 ProbeHub 的定时快照请求，再由 ProbeHub 将实时帧广播给访客
- **3 秒实时刷新**——ProbeHub 默认每 3 秒从主控获取一次完整快照，向支持的页面广播增量帧（见上文「实时推送只发变化」）；`/api/probe` 优先复用最近快照并叠加 3 秒边缘微缓存，避免页面首屏和轮询重复触发主控生成数据
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
| `/api/series` | 直连 `/api/public/probe-series` | 延迟、丢包与系统历史（CPU／内存／网速／TCP／UDP），范围跟随主控保留天数 |
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
   | `PROBE_NETWORK_SPEED_UNIT` | Text（可选） | 全局网速单位，默认 `bits`，可改 `bytes`；Ran 和累计流量不受影响 |
   | `PROBE_SHOW_CONNECTION_CHART` | Text（可选） | 首页 TCP/UDP 小折线，默认 `true`，`false` 关闭；连接数数字与详情页历史不受影响 |
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
```

分别启动 Worker 和 Vite：

```bash
# 终端 1
npx wrangler dev

# 终端 2
npm run dev
```

访问 `http://localhost:5173`。Vite 会把 `/api/*` 转发到本地 Worker 的 `8787` 端口。

### 公共模块与主题边界

- `src/server-format.ts`：共用流量格式、地区显示、到期判断及图表格式化。
- `src/server-health.ts`：健康评分与相关资源/延迟计算，不依赖 Premium 页面。
- `src/charts/`：共用流量、延迟、系统历史图及横轴交互容器。
- `src/components/`：共用系统图标、回程标签、Lumina 状态条与许可证页尾；许可证内容仍只从原配置读取。
- 主题和详情页直接引用公共模块，不从 `App.tsx` 或 `PremiumProbePage.tsx` 导入工具或组件。Premium 保持动态加载，样式随主题加载。

`npm test` 包含公共计算边界与静态依赖检查，防止重新引入页面反向引用和循环依赖。调整模块后还需执行 `npm run build`，并检查桌面/手机下的主题切换、详情弹窗与图表。此阶段仅整理依赖，不改变主控数据、计费口径、许可证内容或 Ran。

## 常用命令

```bash
npm run dev        # 启动 Vite 开发服务器
npm run typecheck  # TypeScript 类型检查
npm test           # 业务逻辑与模块依赖回归测试
npm run build      # 生成 dist 生产文件
npm run preview    # 本地预览生产构建
npm run deploy     # 构建并部署到 Cloudflare Workers
npm run screenshots # 用虚拟数据重新生成 README 截图（需本机安装 Chrome，可用 CHROME_PATH 指定）
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

本 fork 的功能基线已提升到上游 `e6f3a11`（2026-09-11）。`ab9233d` 至 `e6f3a11` 的外置探针 Passkey 登录、Premium 续费时间轴点击、移动端双行顶栏和白金三视图对比度修复已按本 fork 架构移植；Passkey Worker 只放行两条固定 POST 鉴权路径，不携带只读 `PROBE_TOKEN`。2026-10-03 继续跟进上游 10-01 的提交：`d26cf7b` 已移植（环上标签上限改为 `MAX_ORBIT_LABELS`，按最小间隔计算，Premium「地区状态」列出全部地区并在超高时滚动；拖动时标签平滑过渡，引线一直画到标签框；白金主题下引线和背面标签加深）；`a677a42` 的连接数折线悬停在本 fork 中已有竖线和提示框，这次补上 TCP/UDP 两个圆点；`343e258` 跳过：本 fork 卡片没有被裁切的悬停说明，并且有意保留「1000 GB」写法；`6834eb6` 跳过：`RegionGlobe` 已统一复用 Premium 地球组件。此前 `d706d7e`、`31f7a4b`、`bd651cb`、`f6fc04b` 的转发链网络状况能力也已移植：优先读取 WS `payload.forward`、HTTP 兜底、按服务器/转发链固定位置切换、浅色主题与布局抖动修复、按组切换的每日流量堆叠柱状图。`6221dd1` 的原始上下行趋势、计费口径工具、`traffic_stats_mode` 修正、服务器旗标和动态地区图同样已吸收；与本地九套主题、Ran/Premium 定制大面积冲突的结构性重构不会直接覆盖，而是逐项移植功能，避免界面回退。更早吸收：`8d82a8b` 移除登录；`ce624cf` twemoji 本地化（public/twemoji/ ~3650 个本地 SVG，零外部依赖）；`3ed41ca` Premium 黑金 PRO 主题；`be3d03c`（表格网速列纵向 + ping-pair 单列）经评估与 fork 三视图布局不兼容，跳过；`5ce90c0` 探针表格优化（表格流量列增强）；基线 `2dc05b3`（2026-08-10）。后续本地迭代：ProbeHub 全局连接聚合、流量计费口径 drawer、趋势弹窗三线切换与手机端免滚动撑满、卡片单向计费修正、白金水印等。若上游有更新，可手动合并（注意 `src/styles.css`、`src/types.ts`、`src/use-probe.ts` 有大量本地定制，合并可能冲突，需逐一确认）：

```bash
git fetch origin
git merge origin/main
```
