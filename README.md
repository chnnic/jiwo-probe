# Jiwo Probe（鸡窝状态站）

妙妙屋 X（MiaoMiaoWuX）独立服务器探针的**非官方魔改 fork**，基于 [mmwx-probe](https://github.com/mmwx-group/mmwx-probe)（基线 `2dc05b3`，2026-08-10 已吸收上游探针表格优化 `5ce90c0`）。

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
- **Lumina 主题**（第 5 主题，`pixel → flat → anime → glass → lumina → ran` 循环）——复刻 Komari Theme LuminaPlus 卡片：浅色阶分层 + 描边（无阴影），健康区延迟/丢包柱条热力分段（与数值同色）、流量脉冲点击弹日流量趋势图、延迟/丢包柱条点击弹完整趋势图、延迟展示内容可选（平均或任意线路）、上下行箭头图标化（悬停 title 提示）、**三网回程勋章扁平化**（去掉系统金/银拟物动画勋章，改细边框低饱和 chip，CN2 GIA / 9929 / CMIN2 等优质线路金色点缀，详情页同步同款）
  - **三态配色循环**（Gem 图标切换：浅 → 暗 → 黑金）——黑金为 Lumina 专属配色：深墨绿黑底 + 金色描边/光晕 + 米白文字，顶部金色光晕；切换记忆在浏览器（localStorage），刷新保持
  - **黑金金色体系**——非语义色全部收敛金色：进度条/脉冲条/剩余流量条/延迟与丢包率数值与柱条/资产总揽金额（`--accent`）/许可证徽章/spark 星光统一金色（暗金 `#a8843f` → 金 `#c9a255` → 亮金 `#d8b46a` → 最亮金 `#f2d28b` 亮度分档）；进度条轨道用详情页同款 `color-mix(border 70%)` 暗轨道（全主题自适应）；状态语义色保留（绿在线/红离线/黄到期），趋势图多线区分色保留
- **液态玻璃主题**（第 4 主题）——渐变玻璃面 + 斜向镜面光泽 + 顶部镜面高光 + 4 层光斑背景，真液态玻璃而非毛玻璃
- **主控自定义主题**——主控后台可下发任意主题名，探针原样挂 `theme-{name}` CSS 类（站长可在探针 CSS 里写 `:root.theme-{name}` 覆盖，无对应样式自动回退默认）；内置主题名大小写不敏感归一化（主控下发 `Lumina` 正确应用本地 lumina 主题）；用户手动切换主题优先于主控下发

#### 主控后台切换主题（核心能力）

**主控后台 → 主题设置 → 输入主题名**，全站访客实时跟随：

| 主控输入 | 访客看到 |
|---|---|
| `pixel` / `flat` / `anime` / `glass` / `lumina` / `premium` | 经典界面 + 对应主题 |
| `lumina-gold` | Lumina 黑金配色（默认黑金，访客手动切换仍优先） |
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
| `glassmorphism` | Glassmorphism 玻璃拟态整页（默认夜间） |
| `glassmorphism-light` | Glassmorphism · 白天模式（浅蓝白玻璃） |
| `glassmorphism-dark` | Glassmorphism · 夜间模式（深蓝黑玻璃） |
| 其他自定义名 | 经典界面 + `theme-{name}` 类（站长自写 CSS 接管） |

> 主控主题名仅允许字母、数字、下划线、连字符（≤64 字符），上表均为合规写法；大小写不敏感。

优先级：**主控明确下发变体 > 用户手动选过（浏览器记忆）> 本地缓存 > 默认**。探针实时监听主控下发（WS/轮询新帧），切换无需刷新页面。
- 做过性能优化：backdrop-filter 合成层从 50+ 降到 2 层（仅顶部栏和遮罩），低 CPU / 低耗电，手机不发烫

### 数据与交互增强

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
- **bytes 格式化去冗余 .0**——`1000.0 GB` → `1000 GB`（含四舍五入后恰为 X.0 的值），非整数精度不变

### 手机端适配

- 宽度断点全局对齐（760px / 640px / 960px），容器宽度一致无偏差
- 紧凑速度徽章、负载区图标化、许可证底栏单行横滚
- 极简卡片手机端专门压缩规则，375px 下无横向溢出

## 许可证

本项目采用 [Miaomiaowu X Source Available License v1.0](LICENSE)（官方许可证，未修改）。允许非商业使用、学习、修改和按许可证要求分发；商业使用需取得原作者授权。**本 fork 非官方发布，与妙妙屋 X 无任何关联或背书。**

## 工作方式

```text
浏览器 ──HTTPS/WS──> Cloudflare Worker ──携带 PROBE_TOKEN──> 妙妙屋 X 主控
```

Worker 仅代理三个固定路径，不接受访客指定上游地址，因此不会形成开放代理：

| 对外路径 | 主控路径 | 用途 |
| --- | --- | --- |
| `/api/probe` | `/api/public/probe-servers` | 服务器状态 |
| `/api/series` | `/api/public/probe-series` | 延迟与丢包率历史 |
| `/api/stream` | `/api/public/probe-ws` | 实时 WebSocket |

## 准备工作

- 已部署支持独立探针访问密钥的妙妙屋 X 主控
- Cloudflare 账户及可用的 Workers 服务
- Node.js 22 或更高版本、npm 10 或更高版本
- 主控具有可由 Cloudflare 访问的 HTTPS 地址

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
4. 首次部署后，进入 Worker 的 **Settings → Variables and Secrets**，添加运行时变量：

   | 名称 | 类型 | 值 |
   | --- | --- | --- |
   | `MMWX_ORIGIN` | Text | 主控 HTTPS 地址，例如 `https://panel.example.com` |
   | `PROBE_TOKEN` | Secret | 主控"系统设置 → 探针"生成的访问密钥 |

   注意这里是 Worker 的运行时 **Variables and Secrets**，不是 **Build Variables and Secrets**。保存后点击 Deploy，使变量进入当前部署。
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
```

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

更新代码后执行 `npm ci && npm run deploy`。轮换密钥时，先在主控生成新密钥，立即执行 `npx wrangler secret put PROBE_TOKEN` 并重新部署；在 Worker 更新完成前，探针可能短暂返回 `404`。主控只保存密钥的 SHA-256 哈希，无法找回旧密钥。

## 故障排查

- `503 Probe access secret is not configured`：尚未设置 `PROBE_TOKEN`。
- Worker 返回 `404`：Worker Secret 与主控生成的密钥不一致，或主控探针未启用。
- 页面无实时更新：检查 Cloudflare 与源站反向代理是否允许 WebSocket；页面会自动使用 HTTP 轮询。
- `MMWX_ORIGIN must use HTTPS`：生产源站不是 HTTPS。本地调试仅允许 `localhost` 或 `127.0.0.1`。
- 页面没有服务器：在主控探针设置中选择需要展示的服务器。

## 上游同步

本 fork 基于上游 `2dc05b3`，已吸收 `5ce90c0`（探针表格优化：表格流量列增强）；`be3d03c`（表格网速列改纵向 + ping-pair 单列）经评估与 fork 三视图布局不兼容，已跳过；2026-08-11 吸收 `3ed41ca`（**Premium 黑金 PRO 主题**：PremiumProbePage / premium-probe.css / BlackGoldGlobe 球体 / country-flag + server-name 工具 + OPlusSans3 字体 + `/login` 重定向），并接入主题下拉体系（右上角主题下拉 + 经典界面下拉均可双向切换）、右上角登录按钮改为主题/水印切换、底部本地勋章（git filter 剥离，公开版零私人数据）；上游同 commit 的表格"上传/下载"文字标签与 metric-hover-detail 与本地定制冲突，跳过。后续迭代：网络状况页行高 280px/曲线加高、多目标 tooltip 上限 32rem（27 行全显 + 矮视口滚动）、内网/海外目标划分；Lumina 三态配色（黑金）+ 黑金金色体系（进度/脉冲/剩余流量/延迟/丢包/资产金额/许可证徽章全金色，语义状态色保留）；趋势图 tooltip 主题化深色；健康分徽章（详情页头部评分·等级，悬停显示扣分原因）；2026-08-12 吸收 `ce624cf`（**twemoji 本地化**：public/twemoji/ ~3650 个本地 SVG，Twemoji 组件从 jsdelivr CDN 改 `/twemoji/` 加载，零外部依赖；PremiumNetworkView 默认显示全部目标；`show_health_score` 字段对接主控 v0.4.8-beta.1 探针开关）。2026-08-10 完整移植 Komari-Ran-Theme（`src/ran/` 原版 125 文件 + mmwx-adapter 数据适配层，参考 [eutopiazen/mmwx-probe](https://github.com/eutopiazen/mmwx-probe) 的集成方式）。若上游有更新，可手动合并（注意 `src/styles.css`、`src/types.ts`、`src/use-probe.ts` 有大量本地定制，合并可能冲突，需逐一确认）：

```bash
git fetch origin
git merge origin/main
```
