export interface NewsItem {
  title: string
  url: string
  content: string
  source: string
  published?: string
}

interface TavilyResult {
  title?: string
  url?: string
  content?: string
  published_date?: string
}

export const TRUSTED_NEWS_DOMAINS = [
  'reuters.com',
  'bbc.com',
  'apnews.com',
  'bloomberg.com',
  'ft.com',
  'theguardian.com',
  'nytimes.com',
  'wsj.com',
  'aljazeera.com',
  'economist.com',
]

export function extractSource(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const then = new Date(dateStr)
  if (Number.isNaN(then.getTime())) return ''

  const diff = Math.floor((Date.now() - then.getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  const hours = Math.floor(diff / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function getNewsKey(item: Pick<NewsItem, 'url' | 'title'>, index: number): string {
  return item.url || `${item.title}-${index}`
}

interface FetchTavilyNewsOptions {
  includeDomains?: string[]
  searchDepth?: 'basic' | 'advanced'
}

interface CachedPayload {
  savedAt: number
  items: NewsItem[]
}

export async function fetchTavilyNews(
  query: string,
  maxResults: number,
  options: FetchTavilyNewsOptions = {},
): Promise<NewsItem[]> {
  const apiKey = import.meta.env.VITE_TAVILY_API_KEY
  if (!apiKey) {
    throw new Error('Tavily API key is missing. Add VITE_TAVILY_API_KEY to your environment.')
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: options.searchDepth || 'advanced',
      max_results: maxResults,
      include_domains: options.includeDomains || TRUSTED_NEWS_DOMAINS,
      include_answer: false,
      sort_by: 'date',
    }),
  })

  if (!response.ok) {
    throw new Error(`News search failed (${response.status})`)
  }

  const data = await response.json()
  const results = Array.isArray(data.results) ? data.results as TavilyResult[] : []

  return results
    .filter((result) => result.title && result.url)
    .map((result) => ({
      title: result.title || 'Untitled story',
      url: result.url || '#',
      content: result.content || '',
      source: extractSource(result.url || ''),
      published: result.published_date,
    }))
}

function readCache(cacheKey: string): CachedPayload | null {
  try {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedPayload
    if (!parsed || !Array.isArray(parsed.items) || typeof parsed.savedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(cacheKey: string, items: NewsItem[]) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items }))
  } catch {
    // ignore storage errors
  }
}

export async function fetchTavilyNewsCached(
  query: string,
  maxResults: number,
  cacheKey: string,
  cacheTtlMs: number,
  options: FetchTavilyNewsOptions & { forceRefresh?: boolean } = {},
): Promise<{ items: NewsItem[]; fromCache: boolean }> {
  const cached = readCache(cacheKey)
  const fresh = Boolean(cached && Date.now() - cached.savedAt < cacheTtlMs)

  if (!options.forceRefresh && cached && fresh) {
    return { items: cached.items, fromCache: true }
  }

  try {
    const items = await fetchTavilyNews(query, maxResults, options)
    writeCache(cacheKey, items)
    return { items, fromCache: false }
  } catch (error) {
    if (cached && cached.items.length > 0) {
      return { items: cached.items, fromCache: true }
    }
    throw error
  }
}
