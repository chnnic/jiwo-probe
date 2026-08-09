# Jiwo Probe（鸡窝状态站）

妙妙屋 X（MiaoMiaoWuX）独立服务器探针的**非官方魔改 fork**，基于 [mmwx-probe](https://github.com/mmwx-group/mmwx-probe)（基线 `2dc05b3`）。

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

### 主题系统（五套，一键切换）

- **Lumina 主题**（第 5 主题，`pixel → flat → anime → glass → lumina` 循环）——复刻 Komari Theme LuminaPlus 卡片：浅色阶分层 + 描边（无阴影），健康区延迟/丢包柱条热力分段（与数值同色）、流量脉冲点击弹日流量趋势图、延迟/丢包柱条点击弹完整趋势图、延迟展示内容可选（平均或任意线路）、上下行箭头图标化（悬停 title 提示）、**三网回程勋章扁平化**（去掉系统金/银拟物动画勋章，改细边框低饱和 chip，CN2 GIA / 9929 / CMIN2 等优质线路金色点缀，详情页同步同款）
- **液态玻璃主题**（第 4 主题）——渐变玻璃面 + 斜向镜面光泽 + 顶部镜面高光 + 4 层光斑背景，真液态玻璃而非毛玻璃
- 做过性能优化：backdrop-filter 合成层从 50+ 降到 2 层（仅顶部栏和遮罩），低 CPU / 低耗电，手机不发烫

### 数据与交互增强

- **多维榜单**——16 个维度 Top 10（CPU / 内存 / 磁盘 / 负载 / 流量 / 流量使用率 / 实时速度 / 在线时长 / 今日流量 / 近7日流量 / 内地丢包率 / 海外丢包率 / 月成本 / 到期时间 / 内地延迟 / 海外延迟），Twemoji 国旗，前三金银铜徽章，点击当前维度切换升降序，到期时间默认升序（最快到期在前）
- **榜单明细展开**——内地/海外延迟与丢包率维度，点击行尾箭头展开查看该节点每条线路的具体值（延迟 ms / 丢包率 %，超时与无数据区分显示）
- **搜索框**——按名称 / 地区 / 服务商即时过滤节点
- **地区筛选下拉**——自定义组件，Twemoji 旗帜图片渲染（原生 `<select>` 在 Windows 下旗帜会显示成字母）
- **地区分布折叠卡**——按地区聚合，全球 SVG 分布图
- **资产总揽**——总剩余价值 / 月均成本 / 覆盖台数（按剩余天数折算，共享同一套算法）
- **服务器详情页**（hash 路由）——剩余价值、负载三值、上行/下行速度对称布局、到期与续费信息、回程线路、延迟/丢包率/日流量/负载趋势图、省市区展示
- **负载历史曲线**——详情页"负载"tab：1/5/15 分钟负载三线趋势（1h/6h/24h 档位 + 缩放适应）；Lumina 主题卡片点击"负载"指标格直接弹出趋势图（与延迟/丢包率弹窗一致）。数据由 Worker 定时任务每 5 分钟采集主控探针数据写入 KV，自建历史，无需依赖上游
- **CPU / 内存历史曲线**——详情页新增"CPU""内存"tab：CPU 使用率 / 内存占用百分比历史（1h/6h/24h 档位 + 缩放适应），数据来自上游 series `metric=system`（主控 beta3 原生支持）
- **剩余价值计算**——日成本 × 剩余天数（含当天口径），支持月/季/半年/年周期多币种
- **三许可证铭牌底栏**——手机端单行横滚，不占空间

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

1. 在 Cloudflare Dashboard 的 **Workers & Pages → Create application → Import a repository**，选择 `chnnic/jiwo-probe`。
2. 保持以下构建设置：
   - Production branch：`main`
   - Build command：`npm run build`
   - Deploy command：`npx wrangler deploy`
   - Root directory：独立仓库留空
3. 首次部署后，进入 Worker 的 **Settings → Variables and Secrets**，添加运行时变量：

   | 名称 | 类型 | 值 |
   | --- | --- | --- |
   | `MMWX_ORIGIN` | Text | 主控 HTTPS 地址，例如 `https://panel.example.com` |
   | `PROBE_TOKEN` | Secret | 主控"系统设置 → 探针"生成的访问密钥 |

   注意这里是 Worker 的运行时 **Variables and Secrets**，不是 **Build Variables and Secrets**。保存后点击 Deploy，使变量进入当前部署。
4. 打开 Worker 地址，确认服务器列表、趋势图和实时更新正常。
5. 最后回到主控，开启"仅允许独立探针访问"。此后直接访问主控的探针接口会返回 `404`。

连接 GitHub 后，每次推送到 `main` 分支都会由 Workers Builds 自动构建和部署。

## Wrangler 命令行部署

1. 克隆项目并安装依赖：

   ```bash
   git clone https://github.com/chnnic/jiwo-probe.git
   cd jiwo-probe
   npm ci
   npx wrangler login
   ```

2. 在 Cloudflare Dashboard 的 **Settings → Variables and Secrets** 添加文本变量 `MMWX_ORIGIN`。地址必须是固定的 HTTPS 源站，不要包含路径或结尾斜杠。

3. 将主控生成的密钥保存为 Worker Secret：

   ```bash
   npx wrangler secret put PROBE_TOKEN
   ```

4. 构建并部署：

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

本 fork 基于上游 `af0d6f0`。若上游有更新，可手动合并（注意 `src/styles.css` 和 `src/types.ts` 有大量本地定制，合并可能冲突，需逐一确认）：

```bash
git fetch origin
git merge origin/main
```
