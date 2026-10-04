import { ZH_EXACT, ZH_PATTERNS } from './zh.ts'

// Ran 界面汉化：渲染后替换文本节点与 title / placeholder / aria-label，并用 MutationObserver 跟进实时刷新。
// React 只按自己的虚拟节点比较，不会读回 DOM，所以替换后的中文不会被覆盖，数值变化时再次替换即可。
// localStorage 设 ran-lang=en 可恢复英文原版。

const ATTRS = ['title', 'placeholder', 'aria-label'] as const
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE'])
const SHORT_LABEL = /^[\u4e00-\u9fff（）·/ ]{1,6}$/

export function translateText(raw: string): string | null {
  const text = raw.trim()
  if (!text || !/[A-Za-z]/.test(text)) return null
  const exact = ZH_EXACT[text]
  let out: string | undefined = exact
  if (out === undefined) {
    for (const [pattern, replacer] of ZH_PATTERNS) {
      if (!pattern.test(text)) continue
      out = typeof replacer === 'string' ? text.replace(pattern, replacer) : text.replace(pattern, replacer as (...args: string[]) => string)
      break
    }
  }
  if (out === undefined || out === text) return null
  // 保留原文首尾空白，避免相邻文本挤在一起
  const lead = raw.match(/^\s*/)![0]
  const trail = raw.match(/\s*$/)![0]
  return lead + out + trail
}

function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement
    if (!parent || SKIP.has(parent.tagName) || parent.closest('[data-no-translate]')) return
    const next = translateText(node.nodeValue || '')
    if (next === null) return
    node.nodeValue = next
    // 英文单词不会从中间断开，中文却能在任意两字间换行：窄方框里的短标签（如「紧急」）会被挤成竖排。
    // 独占元素的短中文标签一律不换行。
    if (SHORT_LABEL.test(next.trim()) && parent.childNodes.length === 1 && !parent.style.whiteSpace) parent.style.whiteSpace = 'nowrap'
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const element = node as Element
  if (SKIP.has(element.tagName) || element.closest('[data-no-translate]')) return
  translateAttributes(element)
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode()) {
    const current = walker.currentNode
    if (current.nodeType === Node.ELEMENT_NODE) translateAttributes(current as Element)
    else translateNode(current)
  }
}

function translateAttributes(element: Element) {
  for (const name of ATTRS) {
    const value = element.getAttribute(name)
    if (value === null) continue
    const next = translateText(value)
    if (next !== null) element.setAttribute(name, next)
  }
}

export function ranTranslationEnabled(): boolean {
  try { return localStorage.getItem('ran-lang') !== 'en' } catch { return true }
}

/** 开始汉化 root 及其后代（含 body 里的弹层），返回停止函数。 */
export function startRanTranslation(root: Element = document.body): () => void {
  if (!ranTranslationEnabled()) return () => {}
  translateNode(root)
  const title = translateText(document.title)
  if (title !== null) document.title = title
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') translateNode(record.target)
      else if (record.type === 'attributes') translateAttributes(record.target as Element)
      else record.addedNodes.forEach(translateNode)
    }
  })
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
  const titleElement = document.querySelector('title')
  const titleObserver = new MutationObserver(() => {
    const next = translateText(document.title)
    if (next !== null) document.title = next
  })
  if (titleElement) titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true })
  return () => { observer.disconnect(); titleObserver.disconnect() }
}
