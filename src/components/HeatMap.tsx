import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchTavilyNews, getNewsKey, timeAgo } from '../lib/news'
import type { NewsItem } from '../lib/news'

interface HeatMapProps {
  consume: (amount?: number) => boolean
  credits: number
  limit: number
}

interface RegionConfig {
  id: string
  label: string
  center: [number, number]
  keywords: string[]
}

const REGION_CONFIGS: RegionConfig[] = [
  { id: 'north-america', label: 'North America', center: [-102, 43], keywords: ['united states', 'u.s.', 'us ', 'canada', 'mexico', 'washington', 'new york'] },
  { id: 'south-america', label: 'South America', center: [-58, -16], keywords: ['brazil', 'argentina', 'chile', 'colombia', 'peru'] },
  { id: 'europe', label: 'Europe', center: [18, 51], keywords: ['europe', 'uk', 'britain', 'france', 'germany', 'italy', 'spain', 'brussels', 'russia', 'ukraine'] },
  { id: 'africa', label: 'Africa', center: [20, 7], keywords: ['africa', 'nigeria', 'egypt', 'ethiopia', 'kenya', 'south africa', 'sudan'] },
  { id: 'middle-east', label: 'Middle East', center: [45, 30], keywords: ['middle east', 'israel', 'gaza', 'iran', 'iraq', 'saudi', 'uae', 'qatar'] },
  { id: 'asia', label: 'Asia', center: [97, 33], keywords: ['china', 'japan', 'india', 'pakistan', 'taiwan', 'korea', 'asia', 'beijing', 'tokyo', 'delhi'] },
  { id: 'oceania', label: 'Oceania', center: [135, -25], keywords: ['australia', 'new zealand', 'oceania', 'sydney', 'melbourne'] },
]

const HEATMAP_REFRESH_COST = 14
const HEATMAP_CACHE_KEY = 'open-news-heatmap-cache-v1'
const HEATMAP_CACHE_TTL_MS = 60 * 60 * 1000

interface HeatMapCachePayload {
  savedAt: number
  items: NewsItem[]
}

function readHeatMapCache(): HeatMapCachePayload | null {
  try {
    const raw = localStorage.getItem(HEATMAP_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HeatMapCachePayload
    if (!parsed || !Array.isArray(parsed.items) || typeof parsed.savedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writeHeatMapCache(items: NewsItem[]) {
  try {
    const payload: HeatMapCachePayload = { savedAt: Date.now(), items }
    localStorage.setItem(HEATMAP_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage failures
  }
}

function MapSizeStabilizer({ watch }: { watch: number }) {
  const map = useMap()

  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 0)
    const t2 = setTimeout(() => map.invalidateSize(), 220)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [map, watch])

  useEffect(() => {
    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [map])

  return null
}

async function fetchHeatMapNews(): Promise<NewsItem[]> {
  return fetchTavilyNews('breaking world news by region and country today', HEATMAP_REFRESH_COST)
}

function classifyRegion(item: NewsItem): string {
  const text = `${item.title} ${item.content}`.toLowerCase()
  const match = REGION_CONFIGS.find((r) => r.keywords.some((k) => text.includes(k)))
  return match ? match.id : 'europe'
}

export default function HeatMap({ consume, credits, limit }: HeatMapProps) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [selectedRegion, setSelectedRegion] = useState<string>('europe')
  const [lastRefreshCost, setLastRefreshCost] = useState(0)
  const [tileFailed, setTileFailed] = useState(false)
  const [tileLoaded, setTileLoaded] = useState(false)

  const hydrateFromItems = (news: NewsItem[]) => {
    setItems(news)
    setLastUpdated(new Date())
    const counts = new Map<string, number>()
    for (const item of news) {
      const r = classifyRegion(item)
      counts.set(r, (counts.get(r) || 0) + 1)
    }
    let topId = 'europe'
    let topCount = -1
    for (const region of REGION_CONFIGS) {
      const c = counts.get(region.id) || 0
      if (c > topCount) {
        topCount = c
        topId = region.id
      }
    }
    setSelectedRegion((prev) => (counts.get(prev) ? prev : topId))
  }

  const load = useCallback(async (forceRefresh = false) => {
    const cached = readHeatMapCache()
    const cacheFresh = Boolean(cached && (Date.now() - cached.savedAt) < HEATMAP_CACHE_TTL_MS)

    if (!forceRefresh && cached && cacheFresh) {
      setError(null)
      setLoading(false)
      setLastRefreshCost(0)
      hydrateFromItems(cached.items)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const news = await fetchHeatMapNews()
      const cost = Math.max(1, news.length)
      if (!consume(cost)) {
        setError(`Daily credit limit reached. Heat Map refresh requires ${cost} credits.`)
        setLoading(false)
        return
      }
      setLastRefreshCost(cost)
      hydrateFromItems(news)
      writeHeatMapCache(news)
    } catch (e) {
      if (cached && cached.items.length > 0) {
        // Network failed: fall back to stale cache without consuming extra credits.
        setLastRefreshCost(0)
        hydrateFromItems(cached.items)
        setError(null)
        setLoading(false)
        return
      }
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [consume])

  useEffect(() => {
    const t = setTimeout(() => { void load(false) }, 0)
    const interval = setInterval(() => { void load(false) }, HEATMAP_CACHE_TTL_MS)
    return () => { clearTimeout(t); clearInterval(interval) }
  }, [load])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!tileLoaded) setTileFailed(true)
    }, 3500)
    return () => clearTimeout(t)
  }, [tileLoaded])

  const byRegion = useMemo(() => {
    const grouped: Record<string, NewsItem[]> = {}
    for (const region of REGION_CONFIGS) grouped[region.id] = []
    for (const item of items) grouped[classifyRegion(item)]?.push(item)
    return grouped
  }, [items])

  const hotspotData = useMemo(() => {
    return REGION_CONFIGS.map((region) => {
      const regionItems = byRegion[region.id] || []
      return {
        ...region,
        score: regionItems.length,
        items: regionItems,
      }
    })
  }, [byRegion])
  const projectedCost = Math.max(1, items.length || HEATMAP_REFRESH_COST)
  const hasEnoughCredits = credits >= projectedCost
  const isCreditError = Boolean(error && error.toLowerCase().includes('credit'))

  return (
    <div className="bn-page heatmap-page">
      <div className="bn-header">
        <div className="bn-header-left">
          <span className="bn-live-dot" />
          <span className="bn-title">Heat Map</span>
          <span className="bn-count">{items.length} stories mapped</span>
        </div>
        <div className="bn-header-right">
          <span className="bn-updated">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button className="bn-refresh" onClick={() => { void load(true) }} disabled={loading} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      <div className="radar-panel heatmap-credits-panel">
        <div className="radar-credits-row">
          <span className="radar-credits-pill">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M9 10h6M9 14h6" strokeWidth="1.4" />
            </svg>
            Credits {credits}/{limit}
          </span>
          <span className={`radar-credits-meta${hasEnoughCredits ? '' : ' low'}`}>
            Next refresh: ~{projectedCost} credits
            {lastRefreshCost > 0 ? ` • last used ${lastRefreshCost}` : ''}
          </span>
        </div>
        {!hasEnoughCredits && (
          <div className="radar-credit-warning">
            Not enough credits for another heat map refresh. Try again after daily reset.
          </div>
        )}
      </div>

      {error && (
        <div className="bn-error">
          {isCreditError && (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 12 }}>
              <circle cx="12" cy="12" r="9" stroke="url(#heatmap-limit-grad)" strokeWidth="2" />
              <circle cx="12" cy="12" r="5" stroke="url(#heatmap-limit-grad)" strokeWidth="1.5" strokeDasharray="3 2" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="#ff7a18" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="heatmap-limit-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ff7a18" />
                  <stop offset="1" stopColor="#ff8ed7" />
                </linearGradient>
              </defs>
            </svg>
          )}
          <span>{error}</span>
          <button onClick={() => { void load(true) }}>Retry</button>
        </div>
      )}

      <div className="heatmap-shell">
        <div className="heatmap-world">
          <div className="heatmap-grid-overlay" />
          <MapContainer
            center={[18, 10]}
            zoom={2}
            minZoom={2}
            maxZoom={6}
            zoomControl={false}
            scrollWheelZoom
            className="heatmap-world-map"
          >
            <MapSizeStabilizer watch={items.length} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              eventHandlers={{
                tileerror: () => setTileFailed(true),
                tileload: () => setTileLoaded(true),
              }}
            />
            {tileFailed && (
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            )}

            {hotspotData.map((spot) => {
              const isActive = spot.id === selectedRegion
              const intensity = Math.max(0.35, Math.min(1, spot.score / 4))
              const radius = 5 + spot.score * 1.4
              return (
                <CircleMarker
                  key={spot.id}
                  center={[spot.center[1], spot.center[0]]}
                  radius={radius}
                  pathOptions={{
                    color: isActive ? '#ffd166' : '#ff7a18',
                    weight: isActive ? 2 : 1.4,
                    fillColor: '#ff7a18',
                    fillOpacity: intensity * 0.65,
                  }}
                  eventHandlers={{ click: () => setSelectedRegion(spot.id) }}
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={1} className="heatmap-tooltip" permanent={isActive}>
                    {spot.label} ({spot.score})
                  </Tooltip>
                  {isActive && spot.items.length > 0 && (
                    <Popup
                      className="heatmap-point-popup"
                      autoPan
                      closeButton={false}
                      offset={[0, -12]}
                    >
                      <div className="heatmap-popover-cards">
                        {spot.items.slice(0, 3).map((item, idx) => (
                          <a key={`${spot.id}-${getNewsKey(item, idx)}`} href={item.url} target="_blank" rel="noreferrer" className="heatmap-pop-card">
                            <span className="heatmap-pop-source">{item.source}</span>
                            <p>{item.title}</p>
                            {item.published && <span className="heatmap-pop-time">{timeAgo(item.published)}</span>}
                          </a>
                        ))}
                      </div>
                    </Popup>
                  )}
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
