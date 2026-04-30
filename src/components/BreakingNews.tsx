import { useState, useEffect, useCallback } from 'react'
import { fetchTavilyNewsCached, getNewsKey, timeAgo } from '../lib/news'
import type { NewsItem } from '../lib/news'

const BREAKING_REFRESH_COST = 12
const BREAKING_CACHE_KEY = 'open-news-breaking-cache-v1'
const AUTO_REFRESH_MS = 60 * 60 * 1000

function isGenericHeadline(title: string): boolean {
    const t = title.toLowerCase().trim()
    const blocked = [
        'breaking news, world news and video',
        'breaking news, us news, world news, videos',
        'international - breaking news',
        'latest news',
        'home',
        'top stories',
        'live updates'
    ]
    const brandish = [
        'the new york times', 'al jazeera', 'bbc', 'reuters', 'ap news',
        'cnn', 'guardian', 'bloomberg', 'wsj', 'economist'
    ]
    const looksLikeBrandBanner =
        brandish.some((b) => t.includes(b)) &&
        (t.includes('breaking news') || t.includes('world news') || t.includes('videos'))
    return blocked.some((phrase) => t.includes(phrase)) || /-\s*breaking news/.test(t) || looksLikeBrandBanner
}

function isLikelyHomepage(url: string): boolean {
    try {
        const u = new URL(url)
        return u.pathname === '/' || u.pathname === ''
    } catch {
        return false
    }
}

function isSectionStyleContent(content: string): boolean {
    const c = content.toLowerCase()
    const minReadCount = (c.match(/\bmin read\b/g) || []).length
    return minReadCount >= 2 || c.includes('what to know about') && c.includes(', report says')
}

function isArticlePath(url: string): boolean {
    try {
        const u = new URL(url)
        const p = u.pathname.toLowerCase()
        if (!p || p === '/') return false
        if (p.split('/').filter(Boolean).length < 2) return false
        const firstSeg = p.split('/').filter(Boolean)[0] || ''
        const blockedTopSegs = ['news', 'world', 'international', 'live', 'video', 'videos', 'latest', 'home']
        if (blockedTopSegs.includes(firstSeg) && p.split('/').filter(Boolean).length < 3) return false
        return /[a-z0-9-]{8,}/.test(p)
    } catch {
        return false
    }
}

function isHeroCandidate(item: NewsItem): boolean {
    return (
        !isGenericHeadline(item.title) &&
        !isLikelyHomepage(item.url) &&
        !isSectionStyleContent(item.content) &&
        isArticlePath(item.url) &&
        item.content.trim().length > 90 &&
        item.title.trim().length > 24
    )
}

function heroScore(item: NewsItem): number {
    let score = 0
    if (isHeroCandidate(item)) score += 12
    if (!isGenericHeadline(item.title)) score += 4
    if (!isLikelyHomepage(item.url)) score += 3
    if (isArticlePath(item.url)) score += 3
    if (!isSectionStyleContent(item.content)) score += 3
    if (item.content.trim().length > 120) score += 2
    if (item.title.trim().length > 30) score += 1
    return score
}

function pickBestHero(items: NewsItem[]): NewsItem | null {
    if (items.length === 0) return null
    let best = items[0]
    let bestScore = heroScore(best)
    for (let i = 1; i < items.length; i++) {
        const score = heroScore(items[i])
        if (score > bestScore) {
            best = items[i]
            bestScore = score
        }
    }
    return best
}

async function fetchBreakingNews(): Promise<{ items: NewsItem[]; fromCache: boolean }> {
    const { items: mapped, fromCache } = await fetchTavilyNewsCached(
        'latest breaking world news headlines today major developments',
        BREAKING_REFRESH_COST,
        BREAKING_CACHE_KEY,
        AUTO_REFRESH_MS,
    )

    // Keep article-like items first so the hero block shows a real story.
    const articleLike = mapped.filter((item) => isHeroCandidate(item))
    const fallback = mapped.filter((item) => !articleLike.includes(item))
    return { items: [...articleLike, ...fallback], fromCache }
}

interface BreakingNewsProps {
    consume: (amount?: number) => boolean
}

const BreakingTagIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 3L14.6 9.4L21 12L14.6 14.6L12 21L9.4 14.6L3 12L9.4 9.4L12 3Z" fill="currentColor" />
    </svg>
)

export default function BreakingNews({ consume }: BreakingNewsProps) {
    const [items, setItems] = useState<NewsItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const { items: news, fromCache } = await fetchBreakingNews()
            const cost = Math.max(1, news.length)

            if (!fromCache && !consume(cost)) {
                setError(`Daily credit limit reached. Breaking news requires ${cost} credits. Open News is currently in beta — please tune in later for updates!`)
                setLoading(false)
                return
            }

            setItems(news)
            setLastUpdated(new Date())
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }, [consume])

    useEffect(() => {
        const t = setTimeout(() => { void load() }, 0)
        const interval = setInterval(load, AUTO_REFRESH_MS)
        return () => { clearTimeout(t); clearInterval(interval) }
    }, [load])

    const hero = pickBestHero(items)
    const restItems = hero ? items.filter((item) => item !== hero) : items

    if (loading && items.length === 0) {
        return (
            <div className="bn-page">
                <div className="bn-loader">
                    <div className="bn-loader-orb">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="9" stroke="url(#logo-grad)" strokeWidth="2" strokeDasharray="4 2 8 2" strokeLinecap="round" />
                            <circle cx="12" cy="12" r="5" stroke="#ffc08a" strokeWidth="1.5" strokeDasharray="10 12" />
                            <defs>
                                <linearGradient id="logo-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#ff7a18" />
                                    <stop offset="1" stopColor="#ff8ed7" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <span className="bn-loader-text">Scanning global wires...</span>
                </div>
            </div>
        )
    }

    if (error && items.length === 0) {
        return (
            <div className="bn-page">
                <div className="bn-error">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 12 }}>
                        <circle cx="12" cy="12" r="9" stroke="url(#bn-limit-grad)" strokeWidth="2" />
                        <circle cx="12" cy="12" r="5" stroke="url(#bn-limit-grad)" strokeWidth="1.5" strokeDasharray="3 2" />
                        <line x1="6" y1="6" x2="18" y2="18" stroke="#ff7a18" strokeWidth="2" strokeLinecap="round" />
                        <defs>
                            <linearGradient id="bn-limit-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#ff7a18" />
                                <stop offset="1" stopColor="#ff8ed7" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span>{error}</span>
                    <button onClick={load}>Retry</button>
                </div>
            </div>
        )
    }

    return (
        <div className="bn-page">
            <div className="bn-header">
                <div className="bn-header-left">
                    <span className="bn-live-dot" />
                    <span className="bn-title">Live Feed</span>
                    <span className="bn-count">{items.length} stories</span>
                </div>
                <div className="bn-header-right">
                    <span className="bn-updated">
                        Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>

            {hero && (
                <a
                    href={hero.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bn-hero-card"
                >
                    <span className="bn-hero-kicker">Breaking</span>
                    <h2 className="bn-hero-title">{hero.title}</h2>
                    {hero.content && (
                        <p className="bn-hero-snippet">
                            {hero.content.slice(0, 170)}
                            {hero.content.length > 170 ? '...' : ''}
                        </p>
                    )}
                    <div className="bn-hero-meta">
                        <span>{hero.source}</span>
                        {hero.published && <span>{timeAgo(hero.published)}</span>}
                    </div>
                </a>
            )}

            {restItems.length > 0 && (
                <section className="bn-live-updates" aria-label="Live updates">
                    <h3 className="bn-live-title">
                        <span className="bn-live-title-dot" />
                        Live Updates
                    </h3>
                    <ul className="bn-live-list">
                        {restItems.slice(0, 4).map((item, i) => (
                            <li key={`live-${getNewsKey(item, i)}`} className="bn-live-item">
                                <a href={item.url} target="_blank" rel="noreferrer" className="bn-live-link">
                                    {item.published && <span className="bn-live-time">{timeAgo(item.published)}</span>}
                                    <span className="bn-live-headline">{item.title}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="bn-grid">
                {restItems.slice(4).map((item, i) => (
                    <a
                        key={getNewsKey(item, i)}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="bn-card"
                    >
                        <div className="bn-card-meta">
                            <span className="bn-card-tag">
                                <BreakingTagIcon />
                                Breaking
                            </span>
                            <span className="bn-card-source">{item.source}</span>
                            {item.published && (
                                <span className="bn-card-time">{timeAgo(item.published)}</span>
                            )}
                        </div>
                        <h3 className="bn-card-title">{item.title}</h3>
                        <p className="bn-card-snippet">{item.content.slice(0, 180)}{item.content.length > 180 ? '...' : ''}</p>
                        <div className="bn-card-arrow">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    )
}
