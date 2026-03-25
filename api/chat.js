module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    res.status(503).json({ error: 'GROQ_API_KEY is not configured on server' })
    return
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(req.body || {})
    })

    const text = await response.text()
    if (!response.ok) {
      res.status(response.status).send(text)
      return
    }

    res.setHeader('Content-Type', 'application/json')
    res.status(200).send(text)
  } catch (error) {
    res.status(500).json({ error: 'Proxy request failed', detail: String(error?.message || error) })
  }
}
