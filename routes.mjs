import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const pageExtension = /(?:\.(?:server|client))?\.(?:vue|mjs|jsx?|tsx?)$/
const routeGroup = /^\([^()]+\)$/
const parameter = /\[\[([^\][/.]+)\]\]|\[\.\.\.([^\][/.]+)\]|\[([^\][/.]+)\]/g

function routeSegment(segment, useParameterNames) {
  const normalized = useParameterNames ? segment : segment.toLowerCase()
  return normalized.replace(parameter, (_, optional, catchAll, required) => {
    const name = useParameterNames ? optional ?? catchAll ?? required : '_'
    if (optional) return ':' + name + '?'
    if (catchAll) return ':' + name + '(.*)*'
    return ':' + name
  })
}

// Keep sources relative to the pages directory so reports work across checkouts.
export function pageRoute(file) {
  const parts = file.replace(pageExtension, '').split('/')
  const [name, view = ''] = parts.pop().split('@', 2)
  const component = [...parts, name].join('/')
  const segments = parts.filter(part => !routeGroup.test(part))
  if (name !== 'index') segments.push(name)
  return {
    path: '/' + segments.map(part => routeSegment(part, true)).join('/'),
    matcher: '/' + segments.map(part => routeSegment(part, false)).join('/'),
    component, view,
    file,
  }
}

async function readPages(root, parents = []) {
  const entries = await readdir(join(root, ...parents), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (/^[.-]/.test(entry.name)) continue
    const parts = [...parents, entry.name]
    if (entry.isDirectory()) {
      files.push(...await readPages(root, parts))
    } else if (entry.isFile() && pageExtension.test(entry.name)) {
      files.push(parts.join('/'))
    }
  }
  return files.sort()
}

function matchingGroups(pages, key) {
  const groups = new Map()
  for (const page of pages) {
    const id = page[key]
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(page)
  }
  return groups
}

function shareRoute(a, b) {
  return a.path === b.path && (
    (a.component === b.component && a.view !== b.view) ||
    a.component + '/index' === b.component || b.component + '/index' === a.component
  )
}

export async function scanRoutes(pagesDirectory) {
  const pages = (await readPages(pagesDirectory)).map(pageRoute)
  const byPath = matchingGroups(pages, 'path')
  const byMatcher = matchingGroups(pages, 'matcher')
  const routes = [...byPath.keys()].sort().map(path => ({
    path, files: byPath.get(path).map(page => page.file),
  }))
  const collisions = []
  for (const matcher of [...byMatcher.keys()].sort()) {
    const group = byMatcher.get(matcher)
    const conflicted = group.filter(a => group.some(b => a !== b && !shareRoute(a, b)))
    if (conflicted.length) {
      collisions.push({
        matcher,
        paths: [...new Set(conflicted.map(page => page.path))].sort(),
        files: conflicted.map(page => page.file),
      })
    }
  }
  return { routes, collisions }
}

export function diffRoutes(before, after) {
  const oldRoutes = new Map(before.routes.map(route => [route.path, route]))
  const newRoutes = new Map(after.routes.map(route => [route.path, route]))
  const added = []
  const removed = []
  const changed = []
  for (const route of after.routes) {
    const old = oldRoutes.get(route.path)
    if (!old) added.push(route)
    else if (JSON.stringify(old.files) !== JSON.stringify(route.files)) {
      changed.push({ path: route.path, before: old.files, after: route.files })
    }
  }
  for (const route of before.routes) {
    if (!newRoutes.has(route.path)) removed.push(route)
  }
  return { added, removed, changed, collisions: after.collisions }
}
