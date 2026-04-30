export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) {
    response.status(500).json({ error: 'OpenRouter API key is not configured' })
    return
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body || {}

  if (!body.messages || !Array.isArray(body.messages)) {
    response.status(400).json({ error: 'Invalid request: messages array required' })
    return
  }

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': request.headers.referer || '',
      'X-Title': 'Open News',
    },
    body: JSON.stringify(body),
  })

  response.status(upstream.status)
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-type') response.setHeader(key, value)
  })
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.setHeader('Pragma', 'no-cache')
  response.send(await upstream.text())
}
