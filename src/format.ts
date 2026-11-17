import type { Wrapped } from './wrapped.js'

export const formatNumber = (value: number): string => Math.round(value).toLocaleString('en-US')

export function formatPercent(ratio: number): string {
  const percent = ratio * 100
  const fixed = percent.toFixed(Math.abs(percent) >= 100 ? 0 : 1)
  return `${fixed.replace(/\.0+$/, '')}%`
}

export const formatSigned = (ratio: number): string => `${ratio >= 0 ? '+' : '-'}${formatPercent(Math.abs(ratio))}`

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const monthLabel = (isoDay: string): string => MONTHS[Number(isoDay.slice(5, 7)) - 1] ?? ''

export function resample(values: number[], count: number): number[] {
  if (values.length <= count) return values
  return Array.from({ length: count }, (_, index) => {
    const from = Math.floor((index * values.length) / count)
    const to = Math.floor(((index + 1) * values.length) / count)
    return values.slice(from, to).reduce((sum, value) => sum + value, 0) / (to - from)
  })
}

export const topShare = (wrapped: Wrapped): number => (wrapped.total > 0 ? wrapped.packages[0].downloads / wrapped.total : 0)

export function toJson(wrapped: Wrapped): string {
  return JSON.stringify(
    {
      username: wrapped.username,
      year: wrapped.year,
      period: { start: wrapped.start, end: wrapped.end },
      totalDownloads: wrapped.total,
      topPackage: wrapped.packages[0] ? { ...wrapped.packages[0], share: topShare(wrapped) } : null,
      weeklyDownloads: wrapped.weekly,
      averageWeeklyGrowth: wrapped.weeklyGrowth,
      packages: wrapped.packages,
    },
    null,
    2,
  )
}
