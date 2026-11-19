#!/usr/bin/env node
import { scanRoutes, diffRoutes } from '../routes.mjs'

const help = [
  'Nuxt Route Diff',
  '',
  '  nuxt-route-diff scan <pages-directory> [--json | --markdown]',
  '  nuxt-route-diff diff <before-pages> <after-pages> [--json | --markdown] [--check]',
  '',
  '--check exits with status 1 on route changes or possible collisions in the new tree.',
].join('\n')

function report(result, markdown) {
  const sections = [
    ['Routes', result.routes, route => route.path + '  ←  ' + route.files.join(', ')],
    ['Added', result.added, route => route.path + '  ←  ' + route.files.join(', ')],
    ['Removed', result.removed, route => route.path + '  ←  ' + route.files.join(', ')],
    ['Changed sources', result.changed, route => route.path + '  ←  ' + route.before.join(', ') + '  →  ' + route.after.join(', ')],
    ['Possible collisions', result.collisions, route => route.matcher + '  ←  ' + route.files.join(', ')],
  ]
  const lines = sections.filter(([, entries]) => entries?.length).map(([title, entries, describe]) => {
    const heading = (markdown ? '### ' : '') + title + ' (' + entries.length + ')'
    const rows = entries.map(entry => {
      const text = describe(entry)
      if (!markdown) return '  ' + text
      const tick = String.fromCharCode(96)
      const runs = text.match(/`+/g) ?? []
      const fence = tick.repeat(1 + Math.max(0, ...runs.map(run => run.length)))
      return '- ' + fence + ' ' + text.replace(/\n/g, '\\n') + ' ' + fence
    })
    return [heading, ...rows].join('\n')
  })
  return lines.length ? lines.join('\n\n') : result.routes ? 'No pages found.' : 'No route changes.'
}

async function main(args) {
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log(help)
    return
  }
  const [command, ...tail] = args
  const flags = new Set(tail.filter(value => value.startsWith('--')))
  const paths = tail.filter(value => !value.startsWith('--'))
  if (![...flags].every(flag => ['--json', '--markdown', '--check'].includes(flag))) {
    throw new Error('Unknown option. Run with --help for usage.')
  }
  if (flags.has('--json') && flags.has('--markdown')) {
    throw new Error('Choose one output format.')
  }

  let result
  if (command === 'scan' && paths.length === 1 && !flags.has('--check')) {
    result = await scanRoutes(paths[0])
  } else if (command === 'diff' && paths.length === 2) {
    const [before, after] = await Promise.all(paths.map(scanRoutes))
    result = diffRoutes(before, after)
  } else {
    throw new Error('Invalid command or arguments. Run with --help for usage.')
  }

  console.log(flags.has('--json') ? JSON.stringify(result, null, 2) : report(result, flags.has('--markdown')))
  if (flags.has('--check') && Object.values(result).some(entries => entries.length)) {
    process.exitCode = 1
  }
}

try {
  await main(process.argv.slice(2))
} catch (error) {
  console.error('nuxt-route-diff: ' + error.message)
  process.exitCode = 2
}
