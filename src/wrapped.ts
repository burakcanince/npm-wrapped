import { fetchDailyDownloads, fetchMaintainerPackages, NpmError, onThrottle } from './npm.js'

export interface PackageTotal {
  name: string
  downloads: number
}

export interface Wrapped {
  username: string
  year: number
  start: string
  end: string
  total: number
  packages: PackageTotal[]
  weekly: number[]
  weeklyGrowth: number | null
}

const DAY_MS = 86_400_000
const FIRST_DATA_YEAR = 2015

const isoDay = (date: Date): string => date.toISOString().slice(0, 10)

function periodFor(year: number): { start: Date; end: Date } {
  const now = new Date()
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY_MS)
  if (year < FIRST_DATA_YEAR) throw new NpmError(`npm has no download data before ${FIRST_DATA_YEAR}.`)
  if (year > yesterday.getUTCFullYear()) throw new NpmError(`${year} has not started yet.`)
  const start = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year, 11, 31))
  return { start, end: yearEnd < yesterday ? yearEnd : yesterday }
}

function weeklyTotals(daily: number[]): number[] {
  const weeks: number[] = []
  for (let index = 0; index + 7 <= daily.length; index += 7) weeks.push(daily.slice(index, index + 7).reduce((sum, value) => sum + value, 0))
  return weeks
}

function averageWeeklyGrowth(weeks: number[]): number | null {
  const firstActive = weeks.findIndex((value) => value > 0)
  if (firstActive === -1) return null
  const active = weeks.slice(firstActive)
  const window = Math.min(4, Math.floor(active.length / 3))
  if (window < 1) return null
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const first = mean(active.slice(0, window))
  const last = mean(active.slice(-window))
  const steps = active.length - window
  if (first <= 0 || steps <= 0) return null
  return Math.pow(last / first, 1 / steps) - 1
}

export async function buildWrapped(username: string, year: number, onProgress: (text: string) => void): Promise<Wrapped> {
  const { start, end } = periodFor(year)
  onThrottle((seconds) => onProgress(`npm is throttling requests, waiting ${seconds}s...`))

  onProgress(`Finding packages maintained by ${username}...`)
  const names = await fetchMaintainerPackages(username)
  if (names.length === 0) throw new NpmError(`npm has no public packages maintained by "${username}".`)

  onProgress(`Counting downloads for ${names.length} ${names.length === 1 ? 'package' : 'packages'}...`)
  const daily = await fetchDailyDownloads(names, isoDay(start), isoDay(end))

  const days: string[] = []
  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) days.push(isoDay(new Date(time)))

  const combined = days.map(() => 0)
  const packages: PackageTotal[] = names.map((name) => {
    const series = daily[name]
    let downloads = 0
    days.forEach((day, index) => {
      const value = series?.get(day) ?? 0
      combined[index] += value
      downloads += value
    })
    return { name, downloads }
  })
  packages.sort((first, second) => second.downloads - first.downloads || first.name.localeCompare(second.name))

  const weekly = weeklyTotals(combined)

  return {
    username,
    year,
    start: isoDay(start),
    end: isoDay(end),
    total: packages.reduce((sum, entry) => sum + entry.downloads, 0),
    packages,
    weekly,
    weeklyGrowth: averageWeeklyGrowth(weekly),
  }
}
