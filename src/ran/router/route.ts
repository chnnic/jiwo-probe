import { useEffect, useState } from 'react'

export type Route =
  | { name: 'overview' }
  | { name: 'nodes'; uuid?: string }
  | { name: 'hub'; uuid?: string }
  | { name: 'traffic' }
  | { name: 'map' }
  | { name: 'billing' }
  | { name: 'v2' }
  | { name: 'v2-overview' }
  | { name: 'v2-nodes' }
  | { name: 'v1-overview' }
  | { name: 'v1-nodes' }
  | { name: '404'; raw: string }

/** Parse the hash portion of the URL into a Route. Defaults to overview. */
export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').trim()
  if (!clean) return { name: 'overview' }

  const parts = clean.split('/').filter(Boolean)
  const head = parts[0]

  switch (head) {
    case 'overview':
      return { name: 'overview' }
    case 'nodes':
      return { name: 'nodes', uuid: parts[1] }
    case 'hub':
      return { name: 'hub', uuid: parts[1] }
    case 'traffic':
      return { name: 'traffic' }
    case 'map':
    case 'geo':
      return { name: 'map' }
    case 'billing':
      return { name: 'billing' }
    case 'v2':
      // /v2          → demo page (component showcase)
      // /v2/overview → v2 Overview
      // /v2/nodes    → v2 Nodes
      if (parts[1] === 'overview') return { name: 'v2-overview' }
      if (parts[1] === 'nodes') return { name: 'v2-nodes' }
      return { name: 'v2' }
    case 'v1':
      // /v1/overview → v1 Overview (force)
      // /v1/nodes    → v1 Nodes (force)
      if (parts[1] === 'overview') return { name: 'v1-overview' }
      if (parts[1] === 'nodes') return { name: 'v1-nodes' }
      return { name: 'overview' } // /v1 alone → just overview
    default:
      return { name: '404', raw: clean }
  }
}

/** Build a hash URL string for a route. */
export function hashFor(route: Route): string {
  switch (route.name) {
    case 'nodes':
      return route.uuid ? `#/nodes/${route.uuid}` : '#/nodes'
    case 'hub':
      return route.uuid ? `#/hub/${route.uuid}` : '#/hub'
    case 'v2-overview':
      return '#/v2/overview'
    case 'v2-nodes':
      return '#/v2/nodes'
    case 'v1-overview':
      return '#/v1/overview'
    case 'v1-nodes':
      return '#/v1/nodes'
    case '404':
      return `#/${route.raw}`
    default:
      return `#/${route.name}`
  }
}

/** Hook returning the current route. Updates on hashchange. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { name: 'overview' } : parseHash(window.location.hash),
  )

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

/** Programmatic navigation. */
export function navigate(route: Route): void {
  if (typeof window === 'undefined') return
  const next = hashFor(route)
  if (window.location.hash !== next) {
    window.location.hash = next
  }
}
