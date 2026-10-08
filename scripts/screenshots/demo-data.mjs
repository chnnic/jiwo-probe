// README 截图用的虚拟探针数据：服务器名、商家、价格、链接全部虚构，只复用接口字段结构。
// 使用固定随机种子，每次生成的数据完全一致，截图可以稳定复现。

const GB = 1024 ** 3
const DAY = 86400_000

function random(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NODES = [
  ['HKG-Edge-01', 'HK', '香港', 'Hong Kong', 'Example Cloud', ['CN2GIA', 'CUG', 'CMI']],
  ['TYO-Core-02', 'JP', 'Tokyo', 'Tokyo', 'Demo VPS', ['CN2GIA', '4837', 'CMIN2']],
  ['SIN-Relay-03', 'SG', 'Singapore', 'Singapore', 'Acme Hosting', ['163', '4837', 'CMI']],
  ['LAX-Main-04', 'US', 'California', 'Los Angeles', 'Sample Networks', ['CN2GIA', '9929', 'CMIN2']],
  ['FRA-Store-05', 'DE', 'Hesse', 'Frankfurt', 'Placeholder Host', ['163', '4837', 'CMI']],
  ['LON-Edge-06', 'GB', 'England', 'London', 'Example Cloud', ['163', '4837', 'CMI']],
  ['SEL-Game-07', 'KR', 'Seoul', 'Seoul', 'Demo VPS', ['CN2', '4837', 'CMI']],
  ['TPE-Line-08', 'TW', 'Taipei', 'Taipei', 'Acme Hosting', ['CN2GIA', '4837', 'CMI']],
  ['AMS-Back-09', 'NL', 'North Holland', 'Amsterdam', 'Sample Networks', ['163', '4837', 'CMI']],
  ['PAR-Test-10', 'FR', 'Île-de-France', 'Paris', 'Placeholder Host', ['163', '4837', 'CMI']],
  ['SYD-Edge-11', 'AU', 'New South Wales', 'Sydney', 'Example Cloud', ['163', '4837', 'CMI']],
  ['YVR-Lab-12', 'CA', 'British Columbia', 'Vancouver', 'Demo VPS', ['163', '9929', 'CMI']],
]

const PING_TARGETS = [
  ['sh-ct-v4', '上海电信', 'telecom', 38],
  ['sh-cu-v4', '上海联通', 'unicom', 42],
  ['sh-cm-v4', '上海移动', 'mobile', 46],
  ['gd-ct-v4', '广东电信', 'telecom', 30],
  ['gd-cu-v4', '广东联通', 'unicom', 34],
  ['gd-cm-v4', '广东移动', 'mobile', 28],
  ['intl-web-cloudflare', 'Cloudflare', 'intl', 3],
  ['intl-web-google', 'Google', 'intl', 4],
  ['intl-tg-dc5', 'Telegram DC5', 'intl', 60],
]

const UNLOCKS = ['netflix', 'disneyplus', 'youtube_premium', 'prime_video', 'openai', 'claude', 'gemini', 'tvb_anywhere', 'bing', 'steam', 'reddit', 'wikipedia']

// 地区离华东越远，基础延迟越高
const REGION_LATENCY = { HK: 0, TW: 10, JP: 25, KR: 20, SG: 45, US: 130, CA: 140, DE: 190, NL: 185, FR: 190, GB: 180, AU: 120 }

const OS = ['Debian GNU/Linux 13 (trixie)', 'Ubuntu 24.04.3 LTS', 'Debian GNU/Linux 12 (bookworm)', 'Alpine Linux v3.22', 'Rocky Linux 9.6']
const CPUS = ['AMD EPYC 9654 96-Core Processor', 'Intel(R) Xeon(R) Gold 6148 CPU @ 2.40GHz', 'AMD Ryzen 9 7950X 16-Core Processor', 'AMD EPYC 7B13 64-Core Processor']
const CYCLES = [['month', 'USD', 7.99], ['quarter', 'USD', 19.9], ['year', 'USD', 59], ['year', 'EUR', 39], ['month', 'CNY', 45], ['two_year', 'USD', 99]]

const isoDay = (time) => new Date(time).toISOString().slice(0, 10)

export function buildDemoPayload({ theme = 'luminaplus', now = Date.now() } = {}) {
  const rand = random(20261003)
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const between = (min, max) => min + rand() * (max - min)

  const servers = NODES.map(([name, country, regionName, city, provider, routes], index) => {
    const online = index !== 9
    const base = REGION_LATENCY[country] ?? 80
    const limit = [1000, 2000, 500, 3000, 1000, 800][index % 6] * GB
    const used = limit * between(0.12, 0.86)
    const up = used * between(0.35, 0.5)
    const days = Array.from({ length: 7 }, (_, d) => {
      const total = (used / 18) * between(0.6, 1.4)
      const uplink = total * between(0.3, 0.5)
      return { date: isoDay(now - (6 - d) * DAY), uplink: Math.round(uplink), downlink: Math.round(total - uplink), total: Math.round(total) }
    })
    const [cycle, currency, price] = CYCLES[index % CYCLES.length]
    const expires = now + Math.round(between(-2, 340)) * DAY
    const memTotal = [1, 2, 4, 8, 16][index % 5] * GB
    const diskTotal = [20, 40, 80, 160][index % 4] * GB
    const tcp = Math.round(between(40, 900))
    const udp = Math.round(between(5, 120))
    return {
      name,
      region: country,
      region_country: country,
      region_name: regionName,
      region_city: city,
      online,
      upload_speed: online ? Math.round(between(0.2, 40) * 125_000) : 0,
      download_speed: online ? Math.round(between(0.5, 120) * 125_000) : 0,
      traffic_used: Math.round(used),
      traffic_used_up: Math.round(up),
      traffic_used_down: Math.round(used - up),
      traffic_used_total: Math.round(used),
      traffic_limit: limit,
      traffic_source: 'system',
      traffic_stats_mode: 'both',
      traffic_adjustment: 0,
      traffic_used_scope: 'configured_period',
      period_start: isoDay(now - 12 * DAY),
      period_end: isoDay(now + 18 * DAY),
      daily_traffic: days,
      daily_traffic_scope: 'configured_period_and_recent_7d',
      daily_traffic_start: days[0].date,
      daily_traffic_end: days[6].date,
      boot_traffic_up: Math.round(up * 1.4),
      boot_traffic_down: Math.round((used - up) * 1.4),
      boot_traffic_scope: 'current_boot',
      cumulative_up: Math.round(up * 1.4),
      cumulative_down: Math.round((used - up) * 1.4),
      cumulative_traffic_scope: 'current_boot',
      cpu_pct: online ? Math.round(between(2, 68) * 10) / 10 : 0,
      loadavg: `${between(0, 1.5).toFixed(2)} ${between(0, 1.2).toFixed(2)} ${between(0, 1).toFixed(2)} 1/180 4096`,
      mem_used: Math.round(memTotal * between(0.18, 0.78)),
      mem_total: memTotal,
      disk_used: Math.round(diskTotal * between(0.1, 0.7)),
      disk_total: diskTotal,
      uptime: Math.round(between(1, 120) * 86400),
      cpu_model: pick(CPUS),
      cpu_cores: [1, 2, 4, 8][index % 4],
      cpu_threads: [1, 2, 4, 8][index % 4],
      os: pick(OS),
      kernel: '6.12.0-demo-amd64',
      arch: 'amd64',
      tcp_connections: online ? tcp : 0,
      udp_connections: online ? udp : 0,
      conn_history: {
        tcp: Array.from({ length: 12 }, () => Math.round(tcp * between(0.7, 1.2))),
        udp: Array.from({ length: 12 }, () => Math.round(udp * between(0.6, 1.3))),
      },
      ping: PING_TARGETS.map(([key, label, isp, offset]) => {
        const ms = isp === 'intl' ? offset + between(0, 6) : base + offset + between(-4, 8)
        const buckets = Array.from({ length: 12 }, () => ({
          ms: Math.round(ms + between(-3, 12)),
          loss: rand() < 0.15 ? Math.round(between(0.5, 3) * 10) / 10 : 0,
        }))
        return { key, label, isp, current_ms: online ? Math.round(ms) : -1, loss_pct: online ? Math.round(between(0, 1.2) * 10) / 10 : 100, buckets }
      }),
      unlocks: UNLOCKS.map((service) => ({
        service,
        status: rand() < 0.82 ? 'yes' : 'no',
        region: country,
        tested_at: new Date(now - 3 * 3600_000).toISOString(),
      })),
      return_routes: ['telecom', 'unicom', 'mobile'].map((carrier, i) => ({
        carrier,
        region: ['上海', '广东', '北京'][i],
        route_type: routes[i],
        tested_at: new Date(now - 6 * 3600_000).toISOString(),
      })),
      expires_at: isoDay(expires),
      renewal_price: price,
      renewal_cycle: cycle,
      renewal_currency: currency,
      renewal_price_cny: Math.round(price * (currency === 'EUR' ? 7.8 : currency === 'USD' ? 7.1 : 1) * 100) / 100,
      provider_name: provider,
      provider_url: 'https://example.com/',
    }
  })

  // 转发链：与主控接口一致，近一小时 13 个 5 分钟段 + 7 天逐节点流量
  const bucket = 300
  const trendStart = Math.floor(now / 1000 / bucket) * bucket - 12 * bucket
  const trend = (ms, at = () => [ms, 0]) => Array.from({ length: 13 }, (_, i) => {
    const [e2e, loss] = at(i)
    return { ts: trendStart + i * bucket, e2e_ms: Math.round(e2e + rand() * 2), loss }
  })
  const days = Array.from({ length: 7 }, (_, d) => isoDay(now - (6 - d) * DAY))
  const traffic = (rows) => {
    const list = rows.map(([name, group, role, scale]) => {
      const daily_gb = days.map((_, d) => Math.round(scale * between(0.4, 1.6) * (d >= 2 ? 1 : 0) * 100) / 100)
      return { name, group, role, daily_gb, total_gb: Math.round(daily_gb.reduce((a, b) => a + b, 0) * 100) / 100 }
    })
    return { days, servers: list, total_gb: Math.round(list.reduce((a, s) => a + s.total_gb, 0) * 100) / 100 }
  }
  const node = (name, to_next_ms, healthy = true) => ({ name, to_next_ms, healthy })
  // 近 24 小时状态条（主控 v0.5.6-beta.6 起）：72 格，默认正常，按 [起, 止, 编码] 覆盖区段
  const day24 = (...spans) => {
    const cells = Array(72).fill('o')
    for (const [from, to, code] of spans) cells.fill(code, from, to)
    return cells.join('')
  }
  const forward = [
    {
      name: 'HKG → TYO 主线',
      end_to_end_ms: 46, loss_pct: 0, bucket_sec: bucket,
      groups: [
        { name: '入口组', role: 'entry', to_next_ms: 3, servers: [node('HKG-Edge-01', 3), node('TPE-Line-08', 18)] },
        { name: '中转组', role: 'mid', to_next_ms: 41, servers: [node('SEL-Game-07', 41), node('SIN-Relay-03', 44)] },
        { name: '出口组', role: 'exit', to_next_ms: 0, servers: [node('TYO-Core-02', 0, false)] },
      ],
      trend: trend(46),
      speed_up: 1_820_000, speed_down: 9_640_000, jitter_ms: 1.4,
      availability_24h: 0.9986, cells: day24([18, 19, 'w']),
      traffic: traffic([['HKG-Edge-01', '入口组', 'entry', 18], ['TPE-Line-08', '入口组', 'entry', 7], ['SEL-Game-07', '中转组', 'mid', 15], ['SIN-Relay-03', '中转组', 'mid', 6], ['TYO-Core-02', '出口组', 'exit', 0]]),
    },
    {
      // 选路段（主控 v0.5.6-beta.4 起的结构）：入口之后分叉成直连 / 经组 3 / 经组 4 三条路，按最低延迟择一
      name: 'HKG → LAX 选路',
      end_to_end_ms: 132, loss_pct: 0, bucket_sec: bucket,
      groups: [
        { name: '入口', role: 'entry', to_next_ms: 6, loss_pct: 0, servers: [{ ...node('HKG-Edge-01', 5), loss_pct: 0, route: '路2' }, { ...node('TPE-Line-08', 7), loss_pct: 1.2, route: '路1' }] },
        { name: '组 2', role: 'exit', to_next_ms: 0, loss_pct: 0, servers: [node('LAX-Main-04', 0, false)] },
      ],
      route_hop: 0, route_policy: 'lowest_latency', failover_ms: 150,
      routes: [
        { name: '路1', via: [], latency_ms: 138, loss_pct: 0, selected: true, selected_by: ['TPE-Line-08'] },
        { name: '路2', via: ['组 3'], latency_ms: 126, loss_pct: 0, selected: true, selected_by: ['HKG-Edge-01'] },
        { name: '路3', via: ['组 4'], latency_ms: 171, loss_pct: 2.5, selected: false },
      ],
      trend: trend(132, (i) => [i === 7 ? 283 : 132, 0]),
      speed_up: 96_000, speed_down: 412_000, jitter_ms: 6.8,
      availability_24h: 1, cells: day24(),
      traffic: traffic([['HKG-Edge-01', '入口', 'entry', 3], ['TYO-Core-02', '组 3', 'mid', 1], ['SEL-Game-07', '组 4', 'mid', 0.4], ['LAX-Main-04', '组 2', 'exit', 0]]),
    },
    {
      // 偏慢：入口组 1/3 台探测异常，近半小时出现丢包
      name: 'SIN → FRA 备线',
      end_to_end_ms: 168, loss_pct: 8.3, bucket_sec: bucket,
      groups: [
        { name: '入口组', role: 'entry', to_next_ms: 6, servers: [node('SIN-Relay-03', 6), node('HKG-Edge-01', 38), node('SYD-Edge-11', 0, false)] },
        { name: '出口组', role: 'exit', to_next_ms: 0, servers: [node('FRA-Store-05', 0, false)] },
      ],
      trend: trend(162, (i) => [i >= 7 ? 168 : 158, i >= 7 ? 8.3 : 0]),
      speed_up: 41_000, speed_down: 188_000, jitter_ms: 12.6,
      availability_24h: 0.9583, cells: day24([40, 43, 'd'], [64, 72, 'w']),
      traffic: traffic([['SIN-Relay-03', '入口组', 'entry', 4], ['HKG-Edge-01', '入口组', 'entry', 2], ['FRA-Store-05', '出口组', 'exit', 0]]),
    },
    {
      // 异常：中转组唯一一台离线（PAR-Test-10 在演示数据里就是离线机）
      name: 'AMS → PAR 测试',
      end_to_end_ms: 0, loss_pct: 100, bucket_sec: bucket,
      groups: [
        { name: '入口组', role: 'entry', to_next_ms: 9, servers: [node('AMS-Back-09', 9)] },
        { name: '中转组', role: 'mid', to_next_ms: 0, servers: [node('PAR-Test-10', 0, false)] },
        { name: '出口组', role: 'exit', to_next_ms: 0, servers: [node('LON-Edge-06', 0, false)] },
      ],
      trend: trend(0, (i) => (i < 5 ? [24, 0] : [0, 100])),
      speed_up: 0, speed_down: 0, jitter_ms: 0,
      availability_24h: 0.3125, cells: day24([0, 6, 'n'], [28, 72, 'd']),
      traffic: traffic([['AMS-Back-09', '入口组', 'entry', 0.2], ['PAR-Test-10', '中转组', 'mid', 0], ['LON-Edge-06', '出口组', 'exit', 0]]),
    },
  ]
  return {
    enabled: true,
    title: 'Jiwo Probe Demo',
    show_name: true,
    show_globe: true,
    show_forward: true,
    show_daily_trend: true,
    show_traffic_hotspots: true,
    show_traffic_7d: true,
    show_resource_heatmap: true,
    show_traffic_quota: true,
    show_renewal_timeline: true,
    show_health_score: true,
    history_days: 7,
    appearance: { theme, revision: `demo-${theme}` },
    license_badge: { name: 'demo', display_name: '演示数据' },
    forward,
    servers,
  }
}
