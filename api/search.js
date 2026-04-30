const TRUSTED_NEWS_DOMAINS = [
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

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY
  if (!apiKey) {
    response.status(500).json({ error: 'Tavily API key is not configured' })
    return
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body || {}
  const tavilyResponse = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: body.query,
      search_depth: body.search_depth || 'advanced',
      max_results: Math.min(Number(body.max_results) || 8, 20),
      include_domains: Array.isArray(body.include_domains) ? body.include_domains : TRUSTED_NEWS_DOMAINS,
      include_answer: false,
      sort_by: body.sort_by || 'date',
    }),
  })

  const data = await tavilyResponse.json()
  response.status(tavilyResponse.status).json(data)
}
