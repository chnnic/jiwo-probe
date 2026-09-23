import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, CircleHelp, LockKeyhole, ShieldCheck, X } from 'lucide-react'
import type { ProbeServer, ProbeUnlock } from './types'
import { connectionCount, normalizeUnlocks, unlockCategories, unlockCategorySummaries, unlockService, unlockStatus, unlockSummary, type UnlockCategory } from './unlocks'
import { unlockBrandIcon } from './unlock-icons'

function UnlockServiceIcon({ service }: { service: string }) {
  const icon = unlockBrandIcon(service)
  const [failed, setFailed] = useState(false)
  if (!icon || failed) return <span className="probe-unlock-brand probe-unlock-brand-fallback" aria-hidden="true">{unlockService(service).label.slice(0, 2)}</span>
  if ('path' in icon) return <svg className="probe-unlock-brand" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d={icon.path} /></svg>
  if (icon.mask) return <span className="probe-unlock-brand probe-unlock-brand-mask" style={{ maskImage: `url("${icon.src}")`, WebkitMaskImage: `url("${icon.src}")` }} aria-hidden="true" />
  return <img className="probe-unlock-brand" src={icon.src} width={20} height={20} alt="" aria-hidden="true" onError={() => setFailed(true)} />
}

export function ConnectionCounts({ server, variant = 'detail' }: { server: Pick<ProbeServer, 'tcp_connections' | 'udp_connections'>; variant?: 'detail' | 'card' | 'inline' }) {
  const help = 'TCP：整机已建立连接；UDP：整机 socket。非代理用户数；未上报显示 —。'
  return (
    <div className={`probe-connections${variant !== 'detail' ? ` probe-connections--${variant}` : ''}`} aria-label="整机连接数" title={help}>
      {variant === 'detail' && <span>连接数</span>}
      <span title={`整机 TCP ESTABLISHED 连接数：${connectionCount(server.tcp_connections)}；不等于代理用户数`}>TCP <strong>{connectionCount(server.tcp_connections)}</strong></span>
      <span title={`整机 UDP socket 数：${connectionCount(server.udp_connections)}；不等于代理用户数`}>UDP <strong>{connectionCount(server.udp_connections)}</strong></span>
      {variant === 'detail' && <span className="probe-connection-help" tabIndex={0} aria-label="TCP 为整机已建立连接数，UDP 为整机 socket 数；不是代理用户数。未上报显示横线。" title={help}><CircleHelp size={13} /></span>}
    </div>
  )
}

function checkedAt(value?: string) {
  const timestamp = value ? Date.parse(value) : NaN
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false }) : '时间未提供'
}

export function UnlockPanel({ unlocks }: { unlocks?: ProbeUnlock[] }) {
  const items = normalizeUnlocks(unlocks)
  const [selected, setSelected] = useState<UnlockCategory | null>(null)
  const category = selected ?? unlockCategories.find(cat => items.some(item => unlockService(item.service).category === cat.key))?.key ?? 'streaming'
  const summary = unlockSummary(items)
  const id = useId()
  if (!items.length) return <p className="probe-unlock-empty">暂无解锁检测数据，等待主控上报。</p>
  return (
    <div className="probe-unlock-panel">
      <div className="probe-unlock-summary">
        <ShieldCheck size={16} />
        <strong>{summary.total ? `已解锁 ${summary.unlocked} / ${summary.total}` : '服务信息'}</strong>
        {summary.partial > 0 && <span>{summary.partial} 项仅自制剧</span>}
        {summary.info > 0 && <span>{summary.info} 项信息</span>}
      </div>
      <div className="probe-unlock-tabs" role="group" aria-label="解锁服务分类">
        {unlockCategories.map(cat => <button key={cat.key} type="button" aria-pressed={category === cat.key} aria-controls={id} onClick={() => setSelected(cat.key)}>{cat.label}<small>{items.filter(item => unlockService(item.service).category === cat.key).length}</small></button>)}
      </div>
      <div className="probe-unlock-results" id={id} role="region" aria-label="解锁检测结果">
        {unlockCategories.map(cat => {
          const rows = items.filter(item => unlockService(item.service).category === cat.key)
          const active = cat.key === category
          return <div key={cat.key} className="probe-unlock-category" aria-hidden={!active}>
            <ul className="probe-unlock-list" aria-label={`${cat.label}检测结果`}>
              {rows.map(item => {
                const service = unlockService(item.service)
                const status = unlockStatus(item)
                return (
                  <li key={item.service} className="probe-unlock-row" title={`检测时间：${checkedAt(item.tested_at)}`}>
                    <span className="probe-unlock-service"><UnlockServiceIcon service={item.service} /><span>{service.label}</span></span>
                    <span className="probe-unlock-result" data-tone={status.tone}>
                      <span>{status.tone === 'ok' && <Check size={13} />}{status.label}</span>
                      {item.region && <small>{item.region}</small>}
                      {service.info && item.status === 'yes' && !item.region && <small>—</small>}
                    </span>
                  </li>
                )
              })}
            </ul>
            {!rows.length && <p className="probe-unlock-empty">此分类暂无检测结果</p>}
          </div>
        })}
      </div>
      <p className="probe-unlock-note">上次检测结果，非实时测试。地区、CDN、货币信息不计入解锁数量。</p>
    </div>
  )
}

// 详情页默认收起；原生 details 保留键盘操作，数据刷新不会重置展开状态。
export function UnlockDetails({ unlocks }: { unlocks?: ProbeUnlock[] }) {
  const categories = unlockCategorySummaries(unlocks)
  const countsId = useId()
  return (
    <details className="probe-unlock-panel probe-unlock-details">
      <summary aria-label="解锁检测" aria-describedby={countsId}>
        <h3>解锁检测</h3>
        <span className="probe-unlock-category-counts" id={countsId}>
          {categories.map(category => <span key={category.key} title={category.total
            ? `${category.label}：已解锁 ${category.unlocked} / ${category.total} 项${category.partial ? `，${category.partial} 项仅自制剧` : ''}；不含信息查询`
            : `${category.label}：暂无可统计的解锁结果${category.info ? `，${category.info} 项信息查询不计入解锁数` : ''}`}>
            {category.label}<strong>{category.total ? `${category.unlocked}/${category.total}` : '—'}</strong>
          </span>)}
        </span>
        <span className="probe-unlock-disclosure-hint" aria-hidden="true">
          <span className="probe-unlock-expand-label">展开</span>
          <span className="probe-unlock-collapse-label">收起</span>
          <ChevronDown size={16} />
        </span>
      </summary>
      <UnlockPanel unlocks={unlocks} />
    </details>
  )
}

function UnlockDialog({ name, unlocks, close }: { name: string; unlocks: ProbeUnlock[]; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  // 原生 modal dialog 提供焦点约束、Esc、恢复焦点；不叠加新的毛玻璃层。
  useLayoutEffect(() => {
    const dialog = ref.current!
    const focused = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => { dialog.close(); focused?.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  return createPortal(
    <dialog ref={ref} className="probe-unlock-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); close() }} onKeyDown={event => {
      event.stopPropagation()
      if (event.key !== 'Tab') return
      const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }} onMouseDown={event => event.stopPropagation()} onClick={event => {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close()
    }}>
      <header className="probe-unlock-dialog-head">
        <div><h2 id={title}>解锁检测</h2><p>{name}</p></div>
        <button type="button" className="probe-unlock-close" aria-label="关闭解锁检测" onClick={close} autoFocus><X size={18} /></button>
      </header>
      <UnlockPanel unlocks={unlocks} />
    </dialog>, document.body,
  )
}

export function UnlockButton({ server }: { server: Pick<ProbeServer, 'name' | 'unlocks'> }) {
  const [open, setOpen] = useState(false)
  if (!normalizeUnlocks(server.unlocks).length) return null
  const name = server.name || '服务器'
  return <>
    <button type="button" className="probe-unlock-button" aria-label={`查看 ${name} 解锁检测`} aria-haspopup="dialog" aria-expanded={open} title="查看解锁检测" onKeyDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setOpen(true) }}><LockKeyhole size={15} /></button>
    {open && <UnlockDialog name={name} unlocks={server.unlocks!} close={() => setOpen(false)} />}
  </>
}
