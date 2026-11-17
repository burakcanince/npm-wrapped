const REGISTRY_URL = 'https://registry.npmjs.org'
const DOWNLOADS_URL = 'https://api.npmjs.org'
const REQUEST_TIMEOUT_MS = 20_000
const SEARCH_PAGE_SIZE = 250
const BULK_SIZE = 128
const PARALLEL_REQUESTS = 3
const MAX_ATTEMPTS = 8

export class NpmError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message)
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let pausedUntil = 0
let throttleListener: (seconds: number) => void = () => {}

export function onThrottle(listener: (seconds: number) => void): void {
  throttleListener = listener
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const delay = pausedUntil - Date.now()
    if (delay > 0) await wait(delay)
    try {
      return await fetchOnce<T>(url)
    } catch (error) {
      if ((error as NpmError).status !== 429 || attempt >= MAX_ATTEMPTS) throw error
      const pause = Math.min(60_000, 4_000 * 2 ** (attempt - 1))
      if (Date.now() + pause > pausedUntil) {
        pausedUntil = Date.now() + pause
        throttleListener(Math.round(pause / 1000))
      }
    }
  }
}

async function fetchOnce<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (response.status === 429) throw new NpmError('npm is rate limiting requests right now. Try again in a minute.', 429)
    if (!response.ok) throw new NpmError(`npm returned ${response.status} for ${url}`, response.status)
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof NpmError) throw error
    if ((error as Error).name === 'AbortError') throw new NpmError('The request to npm timed out. Check your connection and try again.')
    throw new NpmError('Could not reach npm. Check your connection and try again.')
  } finally {
    clearTimeout(timeout)
  }
}

async function runLimited<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const run = async () => {
    while (next < items.length) await worker(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL_REQUESTS, items.length) }, run))
}

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size))

const downloadsPath = (name: string): string => name.split('/').map(encodeURIComponent).join('/')

interface SearchResponse {
  total?: number
  objects?: { package?: { name?: string } }[]
}

export async function fetchMaintainerPackages(username: string): Promise<string[]> {
  const names: string[] = []
  const query = encodeURIComponent(`maintainer:${username}`)
  for (let from = 0; ; from += SEARCH_PAGE_SIZE) {
    const page = await fetchJson<SearchResponse>(`${REGISTRY_URL}/-/v1/search?text=${query}&size=${SEARCH_PAGE_SIZE}&from=${from}`)
    const pageNames = (page.objects ?? []).map((entry) => entry.package?.name).filter((name): name is string => Boolean(name))
    names.push(...pageNames)
    if (pageNames.length < SEARCH_PAGE_SIZE || names.length >= (page.total ?? 0)) break
  }
  return Array.from(new Set(names))
}

interface RangeEntry {
  downloads?: { day: string; downloads: number }[]
}

type DailySeries = Map<string, number>

const toSeries = (entry: RangeEntry | null | undefined): DailySeries | null =>
  entry && Array.isArray(entry.downloads) ? new Map(entry.downloads.map((point) => [point.day, point.downloads ?? 0])) : null

export async function fetchDailyDownloads(names: string[], start: string, end: string): Promise<Record<string, DailySeries>> {
  const result: Record<string, DailySeries> = {}
  const unscoped = names.filter((name) => !name.startsWith('@'))
  const singles = names.filter((name) => name.startsWith('@'))

  await runLimited(chunk(unscoped, BULK_SIZE), async (batch) => {
    if (batch.length === 1) return void singles.push(batch[0])
    const raw = await fetchJson<Record<string, RangeEntry | null>>(
      `${DOWNLOADS_URL}/downloads/range/${start}:${end}/${batch.map(encodeURIComponent).join(',')}`,
    )
    for (const name of batch) {
      const series = toSeries(raw[name])
      if (series) result[name] = series
    }
  })

  await runLimited(singles, async (name) => {
    const raw = await fetchJson<RangeEntry>(`${DOWNLOADS_URL}/downloads/range/${start}:${end}/${downloadsPath(name)}`).catch(
      (error: NpmError) => {
        if (error.status === 404) return null
        throw error
      },
    )
    const series = toSeries(raw)
    if (series) result[name] = series
  })

  return result
}
