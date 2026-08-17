export type ServerDetailRoute =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'server'; index: number }

export function readServerDetailRoute(
  hash = window.location.hash
): ServerDetailRoute {
  if (!hash.startsWith('#/server')) return { kind: 'none' }
  const match = /^#\/server\/([^/?#]+)$/.exec(hash)
  if (!match || !/^\d+$/.test(match[1])) return { kind: 'invalid' }
  const index = Number(match[1])
  return Number.isSafeInteger(index)
    ? { kind: 'server', index }
    : { kind: 'invalid' }
}

export function openServerDetail(index: number) {
  window.location.hash = `/server/${index}`
}

export function clearServerDetail() {
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`
  )
}
