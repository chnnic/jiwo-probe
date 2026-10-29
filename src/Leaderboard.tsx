// 多维榜单：经典主题与 LuminaPlus 共用（宽屏并排两张，各自选维度）
import { useMemo, useState, type ReactNode } from 'react'
import { Activity, ArrowDownUp, Cable, Calendar, CalendarClock, ChevronDown, Clock, Cpu, Database, Gauge, Globe2, HardDrive, LockOpen, MemoryStick, Network, PieChart, Server, TrendingUp, Trophy, Wallet, Wifi } from 'lucide-react'
import type { ProbePingSeries, ProbeServer } from './types'
import { LEADERBOARD_ORDER, rankConnectionCounts, rankUnlocks, type LeaderboardKey } from './leaderboards'
import { primaryPing } from './ping-groups'
import { CYCLE_MONTHS, expiryTimestamp, renewalPriceCny } from './renewal'
import { averagePing, bytes, hasLeadingFlag, pct, regionFlag } from './server-format'
import { connectionCount } from './unlocks'
import { useNetworkSpeed } from './use-network-speed'
import { Twemoji } from './Twemoji'

const isCnLabel = (label: string) => /电信|联通|移动/.test(label)

function groupedPingAvg(ping: ProbePingSeries[], cn: boolean): number {
  const list = primaryPing(ping).filter((item) => isCnLabel(item.label) === cn)
  const current = list.filter((item) => item.current_ms >= 0).map((item) => item.current_ms)
  return current.length ? current.reduce((a, b) => a + b, 0) / current.length : -1
}


export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return h > 0 ? `${d}天${h}小时` : `${d}天`
  if (h > 0) return m > 0 ? `${h}小时${m}分` : `${h}小时`
  return `${Math.max(1, m)}分`
}

export function monthlyCost(server: ProbeServer): number {
  const price = renewalPriceCny(server)
  if (price === undefined) return -1
  const months = CYCLE_MONTHS[server.renewal_cycle || 'month']
  return months ? price / months : -1
}

function todayTraffic(server: ProbeServer): number {
  const daily = server.daily_traffic
  return daily?.length ? daily[daily.length - 1].total ?? -1 : -1
}

function weekTraffic(server: ProbeServer): number {
  const daily = server.daily_traffic || []
  const week = daily.slice(-7)
  return week.length ? week.reduce((a, b) => a + (b.total ?? 0), 0) : -1
}

function load1m(server: ProbeServer): number {
  const parts = (server.loadavg || '').split(/\s+/).map(Number).filter((v) => Number.isFinite(v))
  return parts.length ? parts[0] : -1
}

function daysLeft(server: ProbeServer): number {
  const expiry = expiryTimestamp(server)
  return expiry === undefined ? -1 : Math.ceil((expiry - Date.now()) / 86400000)
}

function avgLossPct(server: ProbeServer, cn: boolean): number {
  const losses = primaryPing(server.ping)
    .filter((item) => isCnLabel(item.label) === cn)
    .map((item) => item.loss_pct)
    .filter((value) => value >= 0)
  return losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : -1
}

const LEADERBOARD_META: Record<LeaderboardKey, { label: string; icon: ReactNode }> = {
  cpu: { label: 'CPU', icon: <Cpu size={13} /> },
  mem: { label: '内存', icon: <MemoryStick size={13} /> },
  disk: { label: '磁盘', icon: <HardDrive size={13} /> },
  load: { label: '负载', icon: <Server size={13} /> },
  traffic: { label: '流量', icon: <PieChart size={13} /> },
  usage: { label: '流量使用率', icon: <Database size={13} /> },
  speed: { label: '实时速度', icon: <ArrowDownUp size={13} /> },
  tcp: { label: 'TCP 连接数', icon: <Cable size={13} /> },
  udp: { label: 'UDP 连接数', icon: <Network size={13} /> },
  unlock: { label: '解锁', icon: <LockOpen size={13} /> },
  uptime: { label: '在线时长', icon: <Clock size={13} /> },
  today: { label: '今日流量', icon: <CalendarClock size={13} /> },
  week: { label: '近7日流量', icon: <TrendingUp size={13} /> },
  'loss-cn': { label: '内地丢包率', icon: <Activity size={13} /> },
  'loss-idc': { label: '海外丢包率', icon: <Wifi size={13} /> },
  cost: { label: '月成本', icon: <Wallet size={13} /> },
  expiry: { label: '到期时间', icon: <Calendar size={13} /> },
  'ping-cn': { label: '内地延迟', icon: <Gauge size={13} /> },
  'ping-idc': { label: '海外延迟', icon: <Globe2 size={13} /> },
}
const LEADERBOARD_TABS = LEADERBOARD_ORDER.map(key => ({ key, ...LEADERBOARD_META[key] }))

// 宽屏并排两张榜单（各自选维度，展开收起一起动）；secondary 那张窄屏不显示
export function Leaderboard({ servers, open, onToggle, initialTab = LEADERBOARD_ORDER[0], secondary = false }: { servers: ProbeServer[]; open: boolean; onToggle: () => void; initialTab?: LeaderboardKey; secondary?: boolean }) {
  const networkSpeed = useNetworkSpeed()
  const [tab, setTab] = useState<LeaderboardKey>(initialTab)
  const [desc, setDesc] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const selectTab = (key: LeaderboardKey) => {
    if (key === tab) {
      setDesc((value) => !value)
    } else {
      setTab(key)
      setDesc(key !== 'expiry') // 到期时间默认升序(最快到期在前)
    }
    setExpanded(null)
  }
  const pingTab = tab === 'ping-cn' || tab === 'ping-idc'
  const lossTab = tab === 'loss-cn' || tab === 'loss-idc'
  const connectionTab = tab === 'tcp' || tab === 'udp'
  const unlockTab = tab === 'unlock'
  // 解锁榜：已解锁数 / 有效检测数与分类明细，按服务器对象查找
  const unlockRows = useMemo(() => unlockTab ? new Map(rankUnlocks(servers).map(row => [row.server, row])) : null, [servers, unlockTab])
  const rows = useMemo(() => {
    if (tab === 'tcp' || tab === 'udp') {
      return rankConnectionCounts(servers, tab, desc).slice(0, 10).map(row => ({ ...row, lines: [] }))
    }
    if (tab === 'unlock') {
      return rankUnlocks(servers, desc).slice(0, 10).map(({ server, index, unlocked }) => ({ server, index, value: unlocked, lines: [] }))
    }
    const indexed = servers.map((server, index) => {
      const avg = averagePing(server.ping || [])
      const value =
        tab === 'cpu' ? server.cpu_pct ?? -1
        : tab === 'mem' ? pct(server.mem_used, server.mem_total)
        : tab === 'disk' ? pct(server.disk_used, server.disk_total)
        : tab === 'load' ? load1m(server)
        : tab === 'traffic' ? server.traffic_used ?? -1
        : tab === 'usage' ? pct(server.traffic_used, server.traffic_limit)
        : tab === 'speed' ? (server.download_speed ?? 0) + (server.upload_speed ?? 0)
        : tab === 'uptime' ? server.uptime ?? -1
        : tab === 'today' ? todayTraffic(server)
        : tab === 'week' ? weekTraffic(server)
        : tab === 'loss-cn' ? avgLossPct(server, true)
        : tab === 'loss-idc' ? avgLossPct(server, false)
        : tab === 'cost' ? monthlyCost(server)
        : tab === 'expiry' ? daysLeft(server)
        : tab === 'ping-cn' ? groupedPingAvg(server.ping || [], true)
        : tab === 'ping-idc' ? groupedPingAvg(server.ping || [], false)
        : avg.current_ms
      const lines = pingTab || lossTab
        ? primaryPing(server.ping)
            .filter((item) => isCnLabel(item.label) === (tab === 'ping-cn' || tab === 'loss-cn'))
            .map((item) => ({ label: item.label, ms: item.current_ms, loss: item.loss_pct }))
        : []
      return { server, index, value, lines }
    })
    return indexed
      .filter((row) => row.value >= 0)
      .sort((a, b) => (desc ? b.value - a.value : a.value - b.value))
      .slice(0, 10)
  }, [servers, tab, desc, pingTab, lossTab])
  const format = (value: number, server: ProbeServer) =>
    tab === 'cpu' || tab === 'mem' || tab === 'disk' ? `${value.toFixed(1)}%`
    : tab === 'load' ? value.toFixed(2)
    : tab === 'traffic' ? bytes(value, false)
    : tab === 'usage' ? `${value.toFixed(1)}%`
    : tab === 'speed' ? `↓${networkSpeed(server.download_speed ?? 0)} ↑${networkSpeed(server.upload_speed ?? 0)}`
    : connectionTab ? connectionCount(value)
    : unlockTab ? (() => { const row = unlockRows?.get(server); return row ? `${row.unlocked}/${row.total} · ${Math.round(row.ratio * 100)}%` : String(value) })()
    : tab === 'uptime' ? formatUptime(value)
    : tab === 'today' || tab === 'week' ? bytes(value, false)
    : tab === 'loss-cn' || tab === 'loss-idc' ? `${value.toFixed(2)}%`
    : tab === 'cost' ? `¥${value.toFixed(0)}/月`
    : tab === 'expiry' ? `${Math.round(value)} 天`
    : `${value.toFixed(0)} ms`
  return (
    <section className={['leaderboard-card', open ? 'open' : '', secondary ? 'secondary' : ''].filter(Boolean).join(' ')}>
      <button className="globe-toggle" type="button" aria-expanded={open} onClick={onToggle}>
        <span>
          <Trophy size={18} />
          多维榜单
        </span>
        <span>
          {LEADERBOARD_META[tab].label} · Top 10
          <ChevronDown size={17} />
        </span>
      </button>
      {open && (
        <div className="leaderboard-body">
          <div className="leaderboard-tabs">
            {LEADERBOARD_TABS.map((item) => (
              <button key={item.key} type="button" aria-pressed={tab === item.key} className={tab === item.key ? 'active' : ''} onClick={() => selectTab(item.key)}>
                {item.icon}
                {item.label}
                {tab === item.key && <span className="sort-arrow">{desc ? '↓' : '↑'}</span>}
              </button>
            ))}
          </div>
          {unlockTab && <p className="lb-note">按已解锁项数排名，同数量时比解锁率；与主控解锁徽标同一口径：仅自制剧算解锁，检测失败不计入。无检测数据的节点不参与排名，展开可看各分类。</p>}
          {connectionTab && <p className="lb-note">{tab === 'tcp' ? '整机已建立 TCP 连接数' : '整机 UDP socket 数'}，非代理用户数；未上报不参与排名，离线节点显示最近上报值。</p>}
          <ol
            className="leaderboard-list"
            onClick={(event) => {
              // 事件委托: 轮询刷新等 DOM 时序下子按钮可能被替换, 直接绑定会丢事件(#175)
              // 在稳定父级 ol 上统一处理, 通过 data-idx 定位
              const target = event.target as HTMLElement
              const main = target.closest('.lb-main')
              if (main) {
                const idx = main.getAttribute('data-idx')
                if (idx !== null && idx !== '') location.hash = `#/server/${idx}`
                return
              }
              const expand = target.closest('.lb-expand')
              if (expand) {
                const idx = expand.getAttribute('data-idx')
                if (idx !== null && idx !== '') {
                  const n = Number(idx)
                  setExpanded((prev) => (prev === n ? null : n))
                }
              }
            }}
          >
            {rows.map(({ server, index, value, lines }, rank) => (
              <li key={`${server.name}-${index}`}>
                <div className="lb-row">
                  <button type="button" className="lb-main" data-idx={index}>
                    <span className="rank">{rank + 1}</span>
                    <span className="lb-name">
                      <Twemoji>
                        {regionFlag(server.region) && !hasLeadingFlag(server.name || '') ? `${regionFlag(server.region)} ${server.name}` : server.name}
                      </Twemoji>
                    </span>
                    <span className="lb-value">
                      {format(value, server)}
                      {(pingTab || lossTab) && lines.length > 0 && <em className="lb-lines-count">{lines.filter((l) => l.ms >= 0).length}线</em>}
                    </span>
                  </button>
                  {((pingTab || lossTab) && lines.length > 0 || unlockTab) && (
                    <button
                      type="button"
                      className={`lb-expand${expanded === index ? ' open' : ''}`}
                      aria-label={expanded === index ? (unlockTab ? '收起解锁分类' : '收起线路明细') : (unlockTab ? '展开解锁分类' : '展开线路明细')}
                      data-idx={index}
                    >
                      <ChevronDown size={13} />
                    </button>
                  )}
                </div>
                {unlockTab && expanded === index && (
                  <div className="lb-lines">
                    {(unlockRows?.get(server)?.categories ?? []).map((category) => (
                      <span key={category.key} className={category.unlocked === 0 ? 'timeout' : ''}>
                        {category.label}
                        <b>{category.unlocked}/{category.total}</b>
                      </span>
                    ))}
                  </div>
                )}
                {(pingTab || lossTab) && expanded === index && (
                  <div className="lb-lines">
                    {lines.map((line) => (
                      <span
                        key={line.label}
                        className={lossTab ? (line.loss < 0 ? 'timeout' : '') : line.ms < 0 ? 'timeout' : ''}
                      >
                        {line.label}
                        <b>
                          {lossTab
                            ? line.loss < 0
                              ? '—'
                              : `${line.loss.toFixed(2)}%`
                            : line.ms < 0
                              ? '超时'
                              : `${line.ms.toFixed(0)} ms`}
                        </b>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {!rows.length && (
              <li className="lb-empty">
                {connectionTab || tab === 'uptime' || tab === 'today' ? '等待探针数据上报' : '暂无数据'}
              </li>
            )}
          </ol>
        </div>
      )}
    </section>
  )
}
