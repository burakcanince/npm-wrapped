import { formatNumber, formatPercent, formatSigned, monthLabel, topShare } from './format.js'
import { color, padEnd, padStart, truncate } from './terminal.js'
import type { Wrapped } from './wrapped.js'

const VISIBLE_PACKAGES = 5

const heading = (text: string): string => color.gray(text.toUpperCase())

function bar(ratio: number, width: number, track = true): string {
  const filled = Math.max(ratio > 0 ? 1 : 0, Math.round(Math.min(1, ratio) * width))
  return color.coral('█'.repeat(filled)) + (track ? color.dim('░'.repeat(width - filled)) : '')
}

export function renderReport(wrapped: Wrapped, width: number): string {
  const indent = '  '
  const inner = width - indent.length * 2
  const nameWidth = Math.min(24, Math.max(12, ...wrapped.packages.slice(0, VISIBLE_PACKAGES).map((entry) => entry.name.length)))
  const countWidth = formatNumber(wrapped.packages[0]?.downloads ?? 0).length
  const barWidth = Math.max(8, Math.min(28, inner - nameWidth - countWidth - 16))
  const lines: string[] = []
  const add = (line = '') => lines.push(line ? indent + line : '')

  add(heading('total packages'))
  add(color.bold(color.white(wrapped.packages.length)))
  add()

  add(heading(`total downloads ${wrapped.year}`))
  add(color.bold(color.coral(formatNumber(wrapped.total))))
  add()

  const top = wrapped.packages[0]
  if (top && wrapped.total > 0) {
    add(heading('top package'))
    add(
      `${padEnd(color.bold(color.white(truncate(top.name, nameWidth))), nameWidth)}  ${padStart(formatNumber(top.downloads), countWidth)}  ${bar(topShare(wrapped), barWidth)}  ${color.white(formatPercent(topShare(wrapped)))}`,
    )
    add()
  }

  if (wrapped.weeklyGrowth !== null) {
    add(heading('weekly growth'))
    add(`${color.lime(formatSigned(wrapped.weeklyGrowth))} ${color.gray(`avg / week · ${monthLabel(wrapped.start)} - ${monthLabel(wrapped.end)}`)}`)
    add()
  }

  add(heading('all packages'))
  const rankWidth = String(Math.min(VISIBLE_PACKAGES, wrapped.packages.length)).length
  const max = Math.max(1, top?.downloads ?? 1)
  wrapped.packages.slice(0, VISIBLE_PACKAGES).forEach((entry, index) => {
    if (index > 0) add()
    add(
      `${color.gray(padStart(String(index + 1), rankWidth))}  ${padEnd(truncate(entry.name, nameWidth), nameWidth)}  ${padStart(formatNumber(entry.downloads), countWidth)}  ${entry.downloads > 0 ? bar(entry.downloads / max, barWidth, false) : ''}`,
    )
  })
  const rest = wrapped.packages.slice(VISIBLE_PACKAGES)
  if (rest.length > 0) {
    const restTotal = rest.reduce((sum, entry) => sum + entry.downloads, 0)
    add(color.gray(`${' '.repeat(rankWidth)}  + ${rest.length} more · ${formatNumber(restTotal)} downloads`))
  }
  add()
  add(`${color.lime('→')} ${color.gray('share it')}  ${color.bold(`npx npm-wrapped ${wrapped.username} --share`)}`)

  return '\n' + lines.join('\n') + '\n'
}
